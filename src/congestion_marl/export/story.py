"""Assemble deterministic population-specific browser bundles and manifest."""

from __future__ import annotations

import hashlib
from itertools import pairwise
from pathlib import Path
from typing import cast

import numpy as np

from congestion_marl import __version__
from congestion_marl.analysis.enumeration import analyze_scenario, weak_compositions
from congestion_marl.config import (
    BASE_SEED,
    POPULATION,
    SUPPORTED_POPULATIONS,
    ExperimentConfig,
    experiment_config_for_population,
)
from congestion_marl.export.json_writer import deterministic_json_bytes, write_deterministic_json
from congestion_marl.export.schema import (
    MODEL_IDENTIFIER,
    ROUTE_CODES,
    SCHEMA_VERSION,
    exact_number,
)
from congestion_marl.games.braess import BraessGame
from congestion_marl.games.network import EDGES, NODES, ROUTE_EDGES
from congestion_marl.learners.best_response import strict_best_response_count_path
from congestion_marl.simulation.experiments import run_experiment_matrix, run_q_learning_study
from congestion_marl.simulation.seeds import seed_policy
from congestion_marl.types import ExactScenarioAnalysis, Route, Scenario

LANDSCAPE_RESOLUTION = {100: 100, 1_000: 64, 10_000: 64}
MAX_DISPLAY_PATH_POINTS = 144


def _exact_analysis_payload(analysis: ExactScenarioAnalysis, population: int) -> dict[str, object]:
    game = BraessGame(analysis.scenario, population)

    def profile(state: tuple[int, ...]) -> dict[str, object]:
        return {
            "routeCounts": list(state),
            "physicalSocialCost": exact_number(game.social_cost(state)),
            "averagePhysicalLatency": exact_number(game.social_cost(state) / population),
            "rosenthalPotential": exact_number(game.rosenthal_potential(state)),
            "perceivedPotential": exact_number(game.perceived_potential(state)),
            "exploitability": exact_number(game.exploitability(state)),
        }

    return {
        "countStateCount": analysis.count_states,
        "pureNashEquilibria": [profile(state) for state in analysis.equilibria],
        "socialOptima": [profile(state) for state in analysis.social_optima],
        "priceOfAnarchy": exact_number(analysis.price_of_anarchy),
        "priceOfStability": exact_number(analysis.price_of_stability),
        "potentialIdentity": {
            "validated": True,
            "feasibleDeviationChecks": analysis.potential_identity_checks,
            "arithmetic": "exact rational",
            "method": "closed-form identity, exhaustively cross-checked on small populations",
        },
        "tolledPotentialIdentity": {
            "validated": analysis.scenario is Scenario.TOLLED,
            "countStateChecks": analysis.tolled_potential_checks,
        },
    }


def _shared_model_payload() -> dict[str, object]:
    return {
        "identifier": MODEL_IDENTIFIER,
        "nodes": [
            {"id": node.identifier, "label": node.label, "position": list(node.position)}
            for node in NODES
        ],
        "edges": [
            {
                "id": edge.identifier,
                "source": edge.source,
                "target": edge.target,
                "physicalLatency": edge.latency_kind,
                "toll": "40(load - 1) / N" if edge.identifier in {"SU", "VT"} else "0",
            }
            for edge in EDGES
        ],
        "routes": [
            {
                "id": route.value,
                "numericCode": code,
                "label": {
                    Route.UPPER: "Upper",
                    Route.LOWER: "Lower",
                    Route.SHORTCUT: "Shortcut",
                }[route],
                "edges": list(ROUTE_EDGES[route]),
            }
            for code, route in enumerate((Route.UPPER, Route.LOWER, Route.SHORTCUT))
        ],
        "routeCodeMapping": ROUTE_CODES,
        "latencyRule": "c_N(x) = 40x/N on SU and VT; 45 on UT and SV; 0 on UV",
        "units": "authored latency units per episode",
        "conventions": {
            "cost": "lower is better",
            "reward": "negative perceived route cost, so higher is better",
            "exploitability": "largest available unilateral perceived-cost reduction",
            "socialObjective": "physical travel latency only; toll payments are transfers",
            "unusedEdgeColor": "green because no traveler experiences its latency",
        },
        "scenarios": [
            {
                "id": Scenario.OPEN.value,
                "shortcutOpen": True,
                "tollsActive": False,
                "routeCodes": [0, 1, 2],
            },
            {
                "id": Scenario.CLOSED.value,
                "shortcutOpen": False,
                "tollsActive": False,
                "routeCodes": [0, 1],
            },
            {
                "id": Scenario.TOLLED.value,
                "shortcutOpen": True,
                "tollsActive": True,
                "routeCodes": [0, 1, 2],
            },
        ],
    }


def _largest_remainder_counts(
    parts: tuple[int, int, int], resolution: int, population: int
) -> tuple[int, int, int]:
    numerators = [part * population for part in parts]
    floors = [value // resolution for value in numerators]
    remaining = population - sum(floors)
    order = sorted(range(3), key=lambda index: (-(numerators[index] % resolution), index))
    for index in order[:remaining]:
        floors[index] += 1
    return floors[0], floors[1], floors[2]


def _barycentric_coordinates(counts: tuple[int, int, int], population: int) -> list[float]:
    root_three = 3.0**0.5
    corners = ((-1.0, -root_three / 3), (1.0, -root_three / 3), (0.0, 2 * root_three / 3))
    upper, lower, shortcut = counts
    return [
        (upper * corners[0][0] + lower * corners[1][0] + shortcut * corners[2][0]) / population,
        (upper * corners[0][1] + lower * corners[1][1] + shortcut * corners[2][1]) / population,
    ]


def _downsample_path(path: tuple[tuple[int, ...], ...]) -> tuple[tuple[int, ...], ...]:
    if len(path) <= MAX_DISPLAY_PATH_POINTS:
        return path
    indices = np.linspace(0, len(path) - 1, num=MAX_DISPLAY_PATH_POINTS, dtype=np.int64)
    unique = tuple(dict.fromkeys(int(index) for index in indices))
    return tuple(path[index] for index in unique)


def build_potential_landscape(
    population: int = POPULATION,
    learning: dict[str, object] | None = None,
) -> dict[str, object]:
    """Build a complete default lattice or fixed-resolution exact-function sample."""

    if population not in SUPPORTED_POPULATIONS:
        raise ValueError("landscape population is not a public preset")
    resolution = LANDSCAPE_RESOLUTION[population]
    game = BraessGame(Scenario.OPEN, population)
    exact = analyze_scenario(Scenario.OPEN, population)
    sampled_grid = weak_compositions(resolution, 3)
    sample_states = [
        state
        if resolution == population
        else _largest_remainder_counts(cast(tuple[int, int, int], state), resolution, population)
        for state in sampled_grid
    ]
    if len(set(sample_states)) != len(sample_states):
        raise AssertionError("sampled landscape mapping produced duplicate exact states")
    potentials = [game.rosenthal_potential(state) for state in sample_states]
    social_costs = [game.social_cost(state) for state in sample_states]
    original_minimum = min(game.rosenthal_potential(state) for state in exact.equilibria)
    tolled_minimum = exact.optimum_social_cost
    shared_scale = max(
        max(value - original_minimum for value in potentials),
        max(value - tolled_minimum for value in social_costs),
    )
    vertices = []
    grid_index: dict[tuple[int, int, int], int] = {}
    for index, (grid_state, exact_state, potential, social) in enumerate(
        zip(sampled_grid, sample_states, potentials, social_costs, strict=True)
    ):
        grid_index[cast(tuple[int, int, int], grid_state)] = index
        vertices.append(
            {
                "routeCounts": list(exact_state),
                "displayCoordinates": _barycentric_coordinates(
                    cast(tuple[int, int, int], grid_state), resolution
                ),
                "originalPotential": float(potential),
                "physicalSocialCost": float(social),
                "tolledPotential": float(social),
                "displayHeightOriginal": float((potential - original_minimum) / shared_scale),
                "displayHeightTolled": float((social - tolled_minimum) / shared_scale),
            }
        )
    triangles: list[list[int]] = []
    for upper in range(resolution):
        for lower in range(resolution - upper):
            shortcut = resolution - upper - lower
            triangles.append(
                [
                    grid_index[(upper, lower, shortcut)],
                    grid_index[(upper + 1, lower, shortcut - 1)],
                    grid_index[(upper, lower + 1, shortcut - 1)],
                ]
            )
            if upper + lower <= resolution - 2:
                triangles.append(
                    [
                        grid_index[(upper + 1, lower, shortcut - 1)],
                        grid_index[(upper + 1, lower + 1, shortcut - 2)],
                        grid_index[(upper, lower + 1, shortcut - 1)],
                    ]
                )
    path, potential_path = strict_best_response_count_path(game, BASE_SEED + population)

    def trajectory_point(state: tuple[int, ...]) -> dict[str, object]:
        canonical = cast(tuple[int, int, int], state)
        return {
            "routeCounts": list(state),
            "displayCoordinates": _barycentric_coordinates(canonical, population),
            "displayHeightOriginal": float(
                (game.rosenthal_potential(state) - original_minimum) / shared_scale
            ),
            "displayHeightTolled": float((game.social_cost(state) - tolled_minimum) / shared_scale),
        }

    learning_trajectories: dict[str, object] = {}
    if learning is not None:
        for scenario in (Scenario.OPEN, Scenario.TOLLED):
            block = cast(dict[str, object], learning[scenario.value])
            representative = cast(dict[str, object], block["representative"])
            snapshots = cast(list[dict[str, object]], representative["snapshots"])
            learning_trajectories[f"{scenario.value}-q-learning"] = [
                trajectory_point(tuple(cast(list[int], snapshot["routeCounts"])))
                for snapshot in snapshots
            ]
    return {
        "sampling": {
            "mode": "complete-count-lattice"
            if population == 100
            else "deterministic-barycentric-sample",
            "resolution": resolution,
            "sampledVertexCount": len(vertices),
            "fullCountStateCount": exact.count_states,
            "statement": (
                "Every count state is displayed."
                if population == 100
                else (
                    "The surface samples the exact potential formula; markers and metrics "
                    "use exact integer states."
                )
            ),
        },
        "vertices": vertices,
        "triangles": triangles,
        "markers": {
            "equilibria": [
                {
                    "routeCounts": list(state),
                    "displayCoordinates": _barycentric_coordinates(
                        cast(tuple[int, int, int], state), population
                    ),
                    "originalPotential": float(game.rosenthal_potential(state)),
                    "tolledPotential": float(game.social_cost(state)),
                }
                for state in exact.equilibria
            ],
            "optima": [
                {
                    "routeCounts": list(state),
                    "displayCoordinates": _barycentric_coordinates(
                        cast(tuple[int, int, int], state), population
                    ),
                    "originalPotential": float(game.rosenthal_potential(state)),
                    "tolledPotential": float(game.social_cost(state)),
                }
                for state in exact.social_optima
            ],
        },
        "heightTransform": {
            "formula": "(field - exact field minimum) / sharedScale",
            "sharedScale": float(shared_scale),
            "originalMinimum": float(original_minimum),
            "tolledMinimum": float(tolled_minimum),
            "meaning": "affine display height; raw exact formula values remain attached",
        },
        "cornerLabels": ["all Upper", "all Lower", "all Shortcut"],
        "trajectories": {
            **learning_trajectories,
            "braess-open-best-response": [
                trajectory_point(state) for state in _downsample_path(path)
            ],
        },
        "bestResponseAudit": {
            "rawStepCount": len(path),
            "renderedPointCount": min(len(path), MAX_DISPLAY_PATH_POINTS),
            "rawPathValidated": True,
            "everyMoveIsOneAgent": True,
            "strictlyDecreasingPotential": all(
                left > right for left, right in pairwise(potential_path)
            ),
            "renderedDescription": (
                "complete strict-improvement sequence"
                if len(path) <= MAX_DISPLAY_PATH_POINTS
                else "downsampled strict-improvement sequence"
            ),
        },
    }


def _configuration_payload(config: ExperimentConfig) -> dict[str, object]:
    scale = config.population != POPULATION
    return {
        "profile": "canonical-64-seed-study" if not scale else "deterministic-scale-study",
        "agents": config.population,
        "qLearning": {
            "episodes": config.q_learning.episodes,
            "initialQ": config.q_learning.initial_q,
            "alpha": config.q_learning.alpha,
            "epsilonStart": config.q_learning.epsilon_start,
            "epsilonDecay": config.q_learning.epsilon_decay,
            "epsilonFloor": config.q_learning.epsilon_floor,
            "finalEvaluationEpsilon": 0.0,
            "simultaneousActions": True,
            "separateQTables": True,
            "implementation": "vectorized NumPy arrays",
        },
        "seedCount": config.seeds,
        "studyScope": (
            "64 deterministic seeds per scenario"
            if not scale
            else (
                "one deterministic audited run per scenario; uncertainty is not compared "
                "with the 100-agent study"
            )
        ),
        "snapshotStrategy": "population-aware deterministic adaptive thinning",
        "normalizedCountDistance": "L1 route-count distance divided by 2N",
    }


def _presentation_profile(game: BraessGame, state: tuple[int, ...]) -> dict[str, object]:
    physical = game.route_physical_costs(state)
    perceived = game.route_perceived_costs(state)
    social = game.social_cost(state)
    return {
        "routeCounts": list(state),
        "edgeLoads": game.edge_loads(state),
        "edgePhysicalLatencies": {
            edge: float(value) for edge, value in game.edge_physical_latencies(state).items()
        },
        "routePhysicalCosts": [float(physical[route]) for route in game.routes],
        "routePerceivedCosts": [float(perceived[route]) for route in game.routes],
        "physicalSocialCost": float(social),
        "averagePhysicalLatency": float(social / game.population),
        "totalTollPayment": float(game.total_toll_payment(state)),
        "rosenthalPotential": float(game.rosenthal_potential(state)),
        "perceivedPotential": float(game.perceived_potential(state)),
        "exploitability": float(game.exploitability(state)),
    }


def _comparison_payload(matrix: dict[str, object]) -> dict[str, object]:
    scenarios: dict[str, object] = {}
    for scenario, raw_block in matrix.items():
        block = cast(dict[str, object], raw_block)
        learners: dict[str, object] = {}
        for key in ("qLearning", "bestResponse", "hedge"):
            learner = cast(dict[str, object], block[key])
            representative = cast(dict[str, object], learner["representative"])
            learners[key] = {
                "learner": learner["learner"],
                "seedCount": len(cast(list[int], learner["seedList"])),
                "representativeSelection": learner["representativeSelection"],
                "representativeSummary": representative["summary"],
                "aggregate": learner["aggregate"],
            }
        scenarios[scenario] = learners
    return {
        "population": POPULATION,
        "scope": (
            "fully replicated 100-agent study; larger presets are not mixed into this comparison"
        ),
        "scenarios": scenarios,
    }


def build_population_bundle(
    population: int, config: ExperimentConfig | None = None
) -> dict[str, object]:
    controls = config or experiment_config_for_population(population)
    if controls.population != population:
        raise ValueError("bundle and experiment populations differ")
    comparison = None
    if population == POPULATION:
        matrix = run_experiment_matrix(controls)
        learning = {
            scenario.value: cast(dict[str, object], matrix[scenario.value])["qLearning"]
            for scenario in Scenario
        }
        comparison = _comparison_payload(matrix)
    else:
        learning = run_q_learning_study(controls)
    configuration = _configuration_payload(controls)
    configuration_hash = hashlib.sha256(deterministic_json_bytes(configuration)).hexdigest()[:16]
    bundle: dict[str, object] = {
        "schemaVersion": SCHEMA_VERSION,
        "modelIdentifier": MODEL_IDENTIFIER,
        "population": population,
        "waitingState": {
            "kind": "preExperiment",
            "waitingCount": population,
            "edgeLoads": {"SU": 0, "UT": 0, "SV": 0, "VT": 0, "UV": 0},
            "metricsAvailable": False,
        },
        "exactAnalysis": {
            scenario.value: _exact_analysis_payload(
                analyze_scenario(scenario, population), population
            )
            for scenario in Scenario
        },
        "scenarioStates": {
            scenario.value: {
                "equilibrium": _presentation_profile(
                    BraessGame(scenario, population),
                    analyze_scenario(scenario, population).equilibria[0],
                ),
                "optimum": _presentation_profile(
                    BraessGame(scenario, population),
                    analyze_scenario(scenario, population).social_optima[0],
                ),
            }
            for scenario in Scenario
        },
        "learning": {"configuration": configuration, "scenarios": learning},
        "potentialLandscape": build_potential_landscape(population, learning),
        "provenance": {
            "packageVersion": __version__,
            "generator": "NumPy Generator with PCG64",
            "generationCommand": "congestion-marl export --output web/public/data",
            "configurationHash": configuration_hash,
            "deterministicGeneration": "same source and configuration produce byte-identical JSON",
            "wallClockValuesIncluded": False,
        },
    }
    if comparison is not None:
        bundle["comparison"] = comparison
    return bundle


def build_manifest() -> dict[str, object]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "model": _shared_model_payload(),
        "defaultPopulation": POPULATION,
        "comparisonPopulation": POPULATION,
        "populations": [
            {
                "agents": population,
                "label": f"{population:,}",
                "bundle": f"population-{population}-v2.json",
                "visualBeadBudget": 100 if population == 100 else 180,
                "study": (
                    "64-seed canonical study"
                    if population == 100
                    else "one deterministic audited scale run per scenario"
                ),
            }
            for population in SUPPORTED_POPULATIONS
        ],
        "seedPolicy": seed_policy(),
    }


def export_population_data(output_directory: Path) -> dict[int, Path]:
    """Generate, validate upstream, and write every deterministic public bundle."""

    paths: dict[int, Path] = {}
    for population in SUPPORTED_POPULATIONS:
        path = output_directory / f"population-{population}-v2.json"
        write_deterministic_json(path, build_population_bundle(population))
        paths[population] = path
    write_deterministic_json(output_directory / "manifest-v2.json", build_manifest())
    return paths


# Compatibility name for focused tests. The public export is now population-specific.
def build_story(config: ExperimentConfig | None = None) -> dict[str, object]:
    controls = config or experiment_config_for_population(POPULATION)
    return build_population_bundle(controls.population, controls)
