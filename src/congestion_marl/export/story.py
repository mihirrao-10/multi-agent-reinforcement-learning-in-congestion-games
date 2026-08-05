"""Assemble the complete authoritative browser data bundle."""

from __future__ import annotations

import hashlib
import json
import platform
from pathlib import Path
from typing import cast

import numpy as np

from congestion_marl import __version__
from congestion_marl.analysis.enumeration import analyze_scenario, enumerate_count_states
from congestion_marl.config import ExperimentConfig
from congestion_marl.export.json_writer import deterministic_json_bytes
from congestion_marl.export.schema import (
    MODEL_IDENTIFIER,
    ROUTE_CODES,
    SCHEMA_VERSION,
    exact_number,
)
from congestion_marl.games.braess import BraessGame
from congestion_marl.games.network import EDGES, NODES, ROUTE_EDGES
from congestion_marl.simulation.engine import counts_from_action_indices
from congestion_marl.simulation.experiments import run_experiment_matrix
from congestion_marl.simulation.seeds import seed_policy
from congestion_marl.types import ExactScenarioAnalysis, Route, Scenario


def _exact_analysis_payload(analysis: ExactScenarioAnalysis) -> dict[str, object]:
    game = BraessGame(analysis.scenario)
    equilibria = []
    for state in analysis.equilibria:
        equilibria.append(
            {
                "routeCounts": list(state),
                "physicalSocialCost": exact_number(game.social_cost(state)),
                "averagePhysicalLatency": exact_number(game.social_cost(state) / game.population),
                "rosenthalPotential": exact_number(game.rosenthal_potential(state)),
                "perceivedPotential": exact_number(game.perceived_potential(state)),
                "exploitability": exact_number(game.exploitability(state)),
            }
        )
    optima = []
    for state in analysis.social_optima:
        optima.append(
            {
                "routeCounts": list(state),
                "physicalSocialCost": exact_number(game.social_cost(state)),
                "averagePhysicalLatency": exact_number(game.social_cost(state) / game.population),
                "rosenthalPotential": exact_number(game.rosenthal_potential(state)),
                "exploitability": exact_number(game.exploitability(state)),
            }
        )
    return {
        "countStateCount": analysis.count_states,
        "pureNashEquilibria": equilibria,
        "socialOptima": optima,
        "priceOfAnarchy": exact_number(analysis.price_of_anarchy),
        "priceOfStability": exact_number(analysis.price_of_stability),
        "potentialIdentity": {
            "validated": True,
            "feasibleDeviationChecks": analysis.potential_identity_checks,
            "arithmetic": "exact rational",
        },
        "tolledPotentialIdentity": {
            "validated": analysis.scenario is Scenario.TOLLED,
            "countStateChecks": analysis.tolled_potential_checks,
        },
    }


def _model_payload() -> dict[str, object]:
    return {
        "identifier": MODEL_IDENTIFIER,
        "agentCount": 80,
        "nodes": [
            {
                "id": node.identifier,
                "label": node.label,
                "position": list(node.position),
            }
            for node in NODES
        ],
        "edges": [
            {
                "id": edge.identifier,
                "source": edge.source,
                "target": edge.target,
                "physicalLatency": edge.latency_kind,
                "toll": "(load - 1) / 2" if edge.identifier in {"SU", "VT"} else "0",
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
        "units": "authored latency units per episode",
        "conventions": {
            "cost": "lower is better",
            "reward": "negative perceived route cost, so higher is better",
            "exploitability": "largest available unilateral perceived-cost reduction",
            "socialObjective": "physical travel latency only; toll payments are transfers",
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


def build_potential_landscape() -> dict[str, object]:
    """Build all 3,321 barycentric states and the known 6,400-triangle topology."""

    game = BraessGame(Scenario.OPEN)
    states = enumerate_count_states(game)
    equilibrium = (0, 0, 80)
    optimum = (35, 35, 10)
    potentials = [game.rosenthal_potential(state) for state in states]
    social_costs = [game.social_cost(state) for state in states]
    minimum_potential = min(potentials)
    minimum_social = min(social_costs)
    shared_scale = max(
        max(value - minimum_potential for value in potentials),
        max(value - minimum_social for value in social_costs),
    )
    vertices = []
    state_index: dict[tuple[int, int, int], int] = {}
    root_three = 3.0**0.5
    corners = ((-1.0, -root_three / 3), (1.0, -root_three / 3), (0.0, 2 * root_three / 3))
    for index, state in enumerate(states):
        upper, lower, shortcut = state
        state_index[(upper, lower, shortcut)] = index
        x = (upper * corners[0][0] + lower * corners[1][0] + shortcut * corners[2][0]) / 80
        y = (upper * corners[0][1] + lower * corners[1][1] + shortcut * corners[2][1]) / 80
        potential = game.rosenthal_potential(state)
        social = game.social_cost(state)
        vertices.append(
            {
                "routeCounts": list(state),
                "displayCoordinates": [x, y],
                "originalPotential": float(potential),
                "physicalSocialCost": float(social),
                "tolledPotential": float(social),
                "exploitability": float(game.exploitability(state)),
                "isUntolledEquilibrium": state == equilibrium,
                "isPhysicalOptimum": state == optimum,
                "displayHeightOriginal": float((potential - minimum_potential) / shared_scale),
                "displayHeightTolled": float((social - minimum_social) / shared_scale),
            }
        )
    triangles: list[list[int]] = []
    for upper in range(80):
        for lower in range(80 - upper):
            shortcut = 80 - upper - lower
            triangles.append(
                [
                    state_index[(upper, lower, shortcut)],
                    state_index[(upper + 1, lower, shortcut - 1)],
                    state_index[(upper, lower + 1, shortcut - 1)],
                ]
            )
            if upper + lower <= 78:
                triangles.append(
                    [
                        state_index[(upper + 1, lower, shortcut - 1)],
                        state_index[(upper + 1, lower + 1, shortcut - 2)],
                        state_index[(upper, lower + 1, shortcut - 1)],
                    ]
                )
    if len(vertices) != 3321 or len(triangles) != 6400:
        raise AssertionError("potential landscape topology has an unexpected size")
    return {
        "vertices": vertices,
        "triangles": triangles,
        "equilibriumVertexIndex": state_index[equilibrium],
        "optimumVertexIndex": state_index[optimum],
        "heightTransform": {
            "formula": "(field - field minimum) / sharedScale",
            "sharedScale": float(shared_scale),
            "originalMinimum": float(minimum_potential),
            "tolledMinimum": float(minimum_social),
            "meaning": "affine display height; raw values remain attached to every vertex",
        },
        "cornerLabels": ["all Upper", "all Lower", "all Shortcut"],
    }


def _configuration_payload(config: ExperimentConfig) -> dict[str, object]:
    return {
        "profile": "canonical-public",
        "agents": config.q_learning.agents,
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
        },
        "hedge": {
            "episodes": config.hedge.episodes,
            "eta": config.hedge.eta,
            "stableLogWeights": True,
            "feedback": "full information",
        },
        "seedCount": config.seeds,
        "bestResponseSeedCount": config.best_response_seeds,
        "normalizedCountDistance": "L1 route-count distance divided by 2N",
    }


def _load_benchmarks() -> dict[str, object]:
    path = Path.cwd() / "benchmarks" / "measurements.json"
    if path.exists():
        loaded = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            return cast(dict[str, object], loaded)
    return {
        "status": "not-recorded",
        "methodology": "time.perf_counter with warmups; see congestion-marl benchmark",
    }


def _attach_trajectory_indices(
    landscape: dict[str, object], experiments: dict[str, object]
) -> None:
    vertices = cast(list[dict[str, object]], landscape["vertices"])
    lookup = {
        tuple(cast(list[int], vertex["routeCounts"])): index
        for index, vertex in enumerate(vertices)
    }
    trajectories: dict[str, list[int]] = {}
    for scenario_key in (Scenario.OPEN.value, Scenario.TOLLED.value):
        scenario_block = cast(dict[str, object], experiments[scenario_key])
        q_block = cast(dict[str, object], scenario_block["qLearning"])
        representative = cast(dict[str, object], q_block["representative"])
        snapshots = cast(list[dict[str, object]], representative["snapshots"])
        trajectories[f"{scenario_key}-q-learning"] = [
            lookup[tuple(cast(list[int], snapshot["routeCounts"]))] for snapshot in snapshots
        ]
    open_block = cast(dict[str, object], experiments[Scenario.OPEN.value])
    best_block = cast(dict[str, object], open_block["bestResponse"])
    representative = cast(dict[str, object], best_block["representative"])
    state = cast(dict[str, object], representative["learnerState"])
    assignments = cast(list[list[int]], state["acceptedMoveAssignments"])
    action_arrays = [np.asarray(values, dtype=np.int64) for values in assignments]
    trajectories["braess-open-best-response"] = [
        lookup[counts_from_action_indices(values, 3)] for values in action_arrays
    ]
    landscape["trajectoryVertexIndices"] = trajectories


def build_story(config: ExperimentConfig | None = None) -> dict[str, object]:
    """Run the deterministic analysis and experiments, then assemble schema 1.0.0."""

    controls = config or ExperimentConfig()
    configuration = _configuration_payload(controls)
    config_hash = hashlib.sha256(deterministic_json_bytes(configuration)).hexdigest()[:16]
    exact = {
        scenario.value: _exact_analysis_payload(analyze_scenario(scenario)) for scenario in Scenario
    }
    experiments = run_experiment_matrix(controls)
    landscape = build_potential_landscape()
    _attach_trajectory_indices(landscape, experiments)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "model": _model_payload(),
        "seedPolicy": seed_policy(),
        "exactAnalysis": exact,
        "experiments": {
            "configuration": configuration,
            "scenarios": experiments,
        },
        "potentialLandscape": landscape,
        "benchmarks": _load_benchmarks(),
        "provenance": {
            "packageVersion": __version__,
            "pythonVersion": platform.python_version(),
            "numpyVersion": np.__version__,
            "generator": "NumPy Generator with PCG64",
            "generationCommand": "congestion-marl export --output web/public/data/story-v1.json",
            "experimentProfile": "canonical-public",
            "configurationHash": config_hash,
            "gitCommit": None,
            "gitCommitPolicy": "excluded from the canonical byte-stable payload",
            "deterministicGeneration": "same source and configuration produce byte-identical JSON",
        },
    }
