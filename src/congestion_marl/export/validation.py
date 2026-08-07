"""Independent semantic validation for population-aware public exports."""

from __future__ import annotations

import json
import math
from collections.abc import Mapping, Sequence
from itertools import pairwise
from pathlib import Path
from typing import cast

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.config import (
    DEFAULT_STORY_POPULATION,
    POPULATION,
    SAMPLED_STUDY_POPULATIONS,
    SELECTABLE_POPULATIONS,
    SUPPORTED_POPULATIONS,
    learning_study_kind,
    simulated_learner_count,
)
from congestion_marl.export.schema import MODEL_IDENTIFIER, SCHEMA_VERSION
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Scenario


class StoryValidationError(ValueError):
    """Raised when exported scientific data is inconsistent."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise StoryValidationError(message)


def _number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise StoryValidationError(f"{label} must be numeric")
    return float(value)


def _integer(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise StoryValidationError(f"{label} must be an integer")
    return value


def _finite_tree(value: object, path: str = "root") -> None:
    if isinstance(value, float):
        _require(math.isfinite(value), f"{path} contains NaN or infinity")
    elif isinstance(value, Mapping):
        for key, child in value.items():
            _finite_tree(child, f"{path}.{key}")
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for index, child in enumerate(value):
            _finite_tree(child, f"{path}[{index}]")


def _exact_decimal(profile: Mapping[str, object], key: str) -> float:
    number = cast(Mapping[str, object], profile[key])
    return _number(number["decimal"], key)


def _validate_snapshot(
    snapshot: Mapping[str, object], game: BraessGame, previous_episode: int
) -> int:
    episode = _integer(snapshot["episode"], "snapshot episode")
    _require(episode > previous_episode, "snapshot episodes must increase strictly")
    counts = tuple(cast(list[int], snapshot["routeCounts"]))
    game.validate_counts(counts)
    _require("assignments" not in snapshot, "population-sized snapshot assignments are forbidden")
    _require(
        cast(dict[str, int], snapshot["edgeLoads"]) == game.edge_loads(counts),
        "snapshot edge loads disagree",
    )
    physical = tuple(float(value) for value in game.route_physical_costs(counts).values())
    perceived = tuple(float(value) for value in game.route_perceived_costs(counts).values())
    exported_physical = tuple(cast(list[float], snapshot["routePhysicalCosts"]))
    exported_perceived = tuple(cast(list[float], snapshot["routePerceivedCosts"]))
    _require(
        all(
            math.isclose(left, right, abs_tol=1e-10)
            for left, right in zip(physical, exported_physical, strict=True)
        ),
        "snapshot physical route costs disagree",
    )
    _require(
        all(
            math.isclose(left, right, abs_tol=1e-10)
            for left, right in zip(perceived, exported_perceived, strict=True)
        ),
        "snapshot perceived route costs disagree",
    )
    edge_latencies = cast(Mapping[str, object], snapshot["edgePhysicalLatencies"])
    for edge, expected_latency in game.edge_physical_latencies(counts).items():
        _require(
            math.isclose(_number(edge_latencies[edge], f"{edge} latency"), float(expected_latency)),
            f"snapshot edge latency {edge} disagrees",
        )
    social = float(game.social_cost(counts))
    checks = {
        "physicalSocialCost": social,
        "averagePhysicalLatency": social / game.population,
        "totalTollPayment": float(game.total_toll_payment(counts)),
        "rosenthalPotential": float(game.rosenthal_potential(counts)),
        "perceivedPotential": float(game.perceived_potential(counts)),
        "exploitability": float(game.exploitability(counts)),
    }
    for key, expected_value in checks.items():
        _require(
            math.isclose(_number(snapshot[key], key), expected_value, abs_tol=1e-9),
            f"snapshot {key} disagrees",
        )
    return episode


def _validate_exact(exact: Mapping[str, object], population: int) -> None:
    for scenario in Scenario:
        game = BraessGame(scenario, population)
        derived = analyze_scenario(scenario, population)
        block = cast(Mapping[str, object], exact[scenario.value])
        _require(
            _integer(block["countStateCount"], "count-state total") == derived.count_states,
            "count-state total disagrees",
        )
        equilibria = cast(list[Mapping[str, object]], block["pureNashEquilibria"])
        optima = cast(list[Mapping[str, object]], block["socialOptima"])
        exported_equilibria = tuple(
            tuple(cast(list[int], profile["routeCounts"])) for profile in equilibria
        )
        exported_optima = tuple(
            tuple(cast(list[int], profile["routeCounts"])) for profile in optima
        )
        _require(exported_equilibria == derived.equilibria, "equilibrium set disagrees")
        _require(exported_optima == derived.social_optima, "social optimum set disagrees")
        for profile, state in zip(equilibria, derived.equilibria, strict=True):
            _require(
                math.isclose(
                    _exact_decimal(profile, "physicalSocialCost"), float(game.social_cost(state))
                ),
                "equilibrium social cost disagrees",
            )
        for profile, state in zip(optima, derived.social_optima, strict=True):
            _require(
                math.isclose(
                    _exact_decimal(profile, "physicalSocialCost"), float(game.social_cost(state))
                ),
                "optimum social cost disagrees",
            )
    if population == POPULATION:
        open_block = cast(Mapping[str, object], exact[Scenario.OPEN.value])
        closed_block = cast(Mapping[str, object], exact[Scenario.CLOSED.value])
        tolled_block = cast(Mapping[str, object], exact[Scenario.TOLLED.value])
        open_equilibrium = cast(list[Mapping[str, object]], open_block["pureNashEquilibria"])[0]
        open_optimum = cast(list[Mapping[str, object]], open_block["socialOptima"])[0]
        _require(
            [
                profile["routeCounts"]
                for profile in cast(list[Mapping[str, object]], open_block["pureNashEquilibria"])
            ]
            == [[0, 0, 100], [0, 1, 99], [1, 0, 99], [1, 1, 98]],
            "canonical equilibrium set disagrees",
        )
        _require(
            open_equilibrium["routeCounts"] == [0, 0, 100], "canonical story equilibrium disagrees"
        )
        _require(open_optimum["routeCounts"] == [50, 50, 0], "canonical optimum disagrees")
        _require(
            _exact_decimal(open_optimum, "physicalSocialCost") == 9000,
            "canonical optimum cost disagrees",
        )
        _require(
            cast(list[Mapping[str, object]], closed_block["pureNashEquilibria"])[0]["routeCounts"]
            == [50, 50],
            "canonical closed split disagrees",
        )
        _require(
            cast(list[Mapping[str, object]], tolled_block["pureNashEquilibria"])[0]["routeCounts"]
            == [50, 50, 0],
            "canonical tolled split disagrees",
        )
        poa = cast(Mapping[str, object], open_block["priceOfAnarchy"])
        _require(
            (poa["numerator"], poa["denominator"]) == (4, 3),
            "canonical Price of Anarchy disagrees",
        )


def _validate_learning_study(study: Mapping[str, object], population: int) -> None:
    kind = learning_study_kind(population)
    simulated = simulated_learner_count(population)
    _require(study.get("learningStudyKind") == kind, "learning-study kind is dishonest")
    _require(
        study.get("representedPopulation") == population,
        "represented learning population disagrees",
    )
    _require(study.get("simulatedLearners") == simulated, "simulated learner count disagrees")
    description = study.get("samplingDescription")
    _require(isinstance(description, str) and bool(description), "sampling description is missing")
    if population in SAMPLED_STUDY_POPULATIONS:
        _require(simulated < population, "sampled study does not reduce the learner population")
    else:
        _require(simulated == population, "full-population study omits represented learners")


def _validate_learning(learning: Mapping[str, object], population: int) -> None:
    study = cast(Mapping[str, object], learning["study"])
    _validate_learning_study(study, population)
    configuration = cast(Mapping[str, object], learning["configuration"])
    for key in (
        "learningStudyKind",
        "representedPopulation",
        "simulatedLearners",
        "samplingDescription",
    ):
        _require(configuration.get(key) == study.get(key), f"configuration {key} disagrees")
    simulated_learners = simulated_learner_count(population)
    scenarios = cast(Mapping[str, object], learning["scenarios"])
    for scenario in Scenario:
        game = BraessGame(scenario, population)
        block = cast(Mapping[str, object], scenarios[scenario.value])
        seeds = cast(list[int], block["seedList"])
        _require(bool(seeds) and len(seeds) == len(set(seeds)), "learning seed list is invalid")
        representative = cast(Mapping[str, object], block["representative"])
        summary = cast(Mapping[str, object], representative["summary"])
        final_counts = tuple(cast(list[int], summary["finalGreedyRouteCounts"]))
        game.validate_counts(final_counts)
        training_counts = tuple(cast(list[int], summary["trainingFinalRouteCounts"]))
        game.validate_counts(training_counts)
        _require("finalGreedyAssignments" not in summary, "large final assignments are forbidden")
        _require(
            math.isclose(
                _number(summary["exploitability"], "final exploitability"),
                float(game.exploitability(final_counts)),
            ),
            "final exploitability disagrees",
        )
        social = float(game.social_cost(final_counts))
        _require(
            math.isclose(_number(summary["physicalSocialCost"], "final social cost"), social),
            "final social cost disagrees",
        )
        _require(
            math.isclose(
                _number(summary["averagePhysicalLatency"], "final average latency"),
                social / population,
            ),
            "final average latency disagrees",
        )
        state = cast(Mapping[str, object], representative["learnerState"])
        _require(
            state.get("qValueShape") == [simulated_learners, len(game.routes)],
            "public Q-value shape disagrees",
        )
        previous = 0
        snapshots = cast(list[Mapping[str, object]], representative["snapshots"])
        _require(bool(snapshots), "representative trajectory is empty")
        for snapshot in snapshots:
            previous = _validate_snapshot(snapshot, game, previous)
        _require(
            previous == cast(Mapping[str, object], configuration["qLearning"])["episodes"],
            "trajectory does not include the final training episode",
        )
        if population > POPULATION:
            _require(len(seeds) == 1, "large-population study must be labeled as one run")
            _require(len(snapshots) <= 140, "large-population trajectory was not thinned")
        if population in SAMPLED_STUDY_POPULATIONS:
            raw_scaling = block.get("routeShareScaling")
            _require(isinstance(raw_scaling, Mapping), "sampled route scaling metadata is missing")
            scaling = cast(Mapping[str, object], raw_scaling)
            _require(
                scaling.get("representedPopulation") == population,
                "sampled route scaling population disagrees",
            )
            _require(
                scaling.get("simulatedLearners") == simulated_learners,
                "sampled route scaling learner count disagrees",
            )
            _require(
                scaling.get("costsRecomputedFromScaledIntegerCounts") is True,
                "sampled costs were not recomputed from represented counts",
            )
        else:
            _require("routeShareScaling" not in block, "full-population study is labeled sampled")


def _validate_scenario_states(states: Mapping[str, object], population: int) -> None:
    for scenario in Scenario:
        game = BraessGame(scenario, population)
        exact = analyze_scenario(scenario, population)
        block = cast(Mapping[str, object], states[scenario.value])
        for key, expected in (
            ("equilibrium", exact.equilibria[0]),
            ("optimum", exact.social_optima[0]),
        ):
            profile = cast(Mapping[str, object], block[key])
            counts = tuple(cast(list[int], profile["routeCounts"]))
            _require(counts == expected, f"{scenario.value} {key} profile disagrees")
            synthetic = dict(profile)
            synthetic.update(
                {
                    "episode": 1,
                    "epsilon": 0.0,
                    "regret": {"meanAverage": 0.0, "maximumAverage": 0.0},
                    "policyEntropy": 0.0,
                }
            )
            _validate_snapshot(synthetic, game, 0)


def _validate_landscape(landscape: Mapping[str, object], population: int) -> None:
    sampling = cast(Mapping[str, object], landscape["sampling"])
    resolution = _integer(sampling["resolution"], "landscape resolution")
    expected_vertices = (resolution + 1) * (resolution + 2) // 2
    expected_triangles = resolution * resolution
    vertices = cast(list[Mapping[str, object]], landscape["vertices"])
    triangles = cast(list[list[int]], landscape["triangles"])
    _require(len(vertices) == expected_vertices, "landscape vertex total disagrees")
    _require(len(triangles) == expected_triangles, "landscape triangle total disagrees")
    game = BraessGame(Scenario.OPEN, population)
    states: list[tuple[int, ...]] = []
    for vertex in vertices:
        state = tuple(cast(list[int], vertex["routeCounts"]))
        game.validate_counts(state)
        states.append(state)
        _require(
            math.isclose(
                _number(vertex["originalPotential"], "sampled potential"),
                float(game.rosenthal_potential(state)),
            ),
            "sampled potential disagrees",
        )
        _require(
            math.isclose(
                _number(vertex["physicalSocialCost"], "sampled social cost"),
                float(game.social_cost(state)),
            ),
            "sampled social cost disagrees",
        )
    _require(len(states) == len(set(states)), "landscape sample has duplicate exact states")
    for triangle in triangles:
        _require(len(triangle) == 3 and len(set(triangle)) == 3, "degenerate triangle")
        _require(all(0 <= index < len(vertices) for index in triangle), "triangle index invalid")
    markers = cast(Mapping[str, object], landscape["markers"])
    exact = analyze_scenario(Scenario.OPEN, population)
    marker_equilibria = tuple(
        tuple(cast(list[int], marker["routeCounts"]))
        for marker in cast(list[Mapping[str, object]], markers["equilibria"])
    )
    marker_optima = tuple(
        tuple(cast(list[int], marker["routeCounts"]))
        for marker in cast(list[Mapping[str, object]], markers["optima"])
    )
    _require(marker_equilibria == exact.equilibria, "equilibrium markers disagree")
    _require(marker_optima == exact.social_optima, "optimum markers disagree")
    trajectories = cast(Mapping[str, object], landscape["trajectories"])
    best_path = [
        tuple(cast(list[int], point["routeCounts"]))
        for point in cast(list[Mapping[str, object]], trajectories["braess-open-best-response"])
    ]
    _require(bool(best_path), "best-response display path is empty")
    potentials = [game.rosenthal_potential(state) for state in best_path]
    _require(
        all(left > right for left, right in pairwise(potentials)), "path arrows do not descend"
    )
    _require(game.is_pure_nash(best_path[-1]), "best-response path misses equilibrium")
    audit = cast(Mapping[str, object], landscape["bestResponseAudit"])
    _require(audit["rawPathValidated"] is True, "raw best-response path was not validated")
    path_population = population
    _require(audit.get("pathPopulation") == path_population, "path population disagrees")
    _require(
        audit.get("representedPopulation") == population,
        "represented path population disagrees",
    )
    _require(
        audit.get("scaledForDisplay") is (path_population != population),
        "path scaling disclosure disagrees",
    )
    _require(
        audit.get("everyMoveIsOneAgent") is (path_population == population),
        "represented one-agent path claim disagrees",
    )
    _require(
        audit.get("everySimulatedMoveIsOneLearner") is True,
        "simulated one-learner path audit failed",
    )
    _require(
        audit.get("simulatedPotentialStrictlyDecreasing") is True,
        "simulated path potential audit failed",
    )
    _require(
        audit.get("renderedPointCount") == len(best_path),
        "rendered path point count disagrees",
    )
    _require(
        _integer(audit["rawStepCount"], "raw path step count") >= len(best_path),
        "raw path is shorter than the rendered path",
    )
    if population > POPULATION:
        _require(
            sampling["mode"] == "deterministic-barycentric-sample",
            "large surface must be labeled sampled",
        )
        _require(len(vertices) < 10_000, "large surface export is impractical")


def validate_manifest(payload: Mapping[str, object]) -> None:
    _require(payload.get("schemaVersion") == SCHEMA_VERSION, "unsupported manifest schema")
    model = cast(Mapping[str, object], payload.get("model"))
    _require(model.get("identifier") == MODEL_IDENTIFIER, "unexpected model identifier")
    _require(
        payload.get("defaultPopulation") == DEFAULT_STORY_POPULATION,
        "default population disagrees",
    )
    _require(payload.get("comparisonPopulation") == POPULATION, "comparison population disagrees")
    _require(
        payload.get("comparisonBundle") == f"population-{POPULATION}-v3.json",
        "comparison bundle disagrees",
    )
    populations = cast(list[Mapping[str, object]], payload["populations"])
    exported = tuple(_integer(item["agents"], "population") for item in populations)
    _require(exported == SELECTABLE_POPULATIONS, "public population options disagree")
    for item, population in zip(populations, SELECTABLE_POPULATIONS, strict=True):
        _require(
            item.get("bundle") == f"population-{population}-v3.json",
            "manifest bundle filename disagrees",
        )
        _validate_learning_study(item, population)
        _require(
            not any(key.startswith("visual") and key.endswith("Budget") for key in item),
            "obsolete visual rendering metadata remains",
        )
    _finite_tree(payload)


def validate_story(payload: Mapping[str, object]) -> None:
    """Validate one population bundle independently of the browser schema."""

    _require(payload.get("schemaVersion") == SCHEMA_VERSION, "unsupported bundle schema")
    _require(payload.get("modelIdentifier") == MODEL_IDENTIFIER, "unexpected model identifier")
    population = _integer(payload.get("population"), "population")
    _require(population in SUPPORTED_POPULATIONS, "unsupported bundle population")
    study = cast(Mapping[str, object], payload["learningStudy"])
    _validate_learning_study(study, population)
    waiting = cast(Mapping[str, object], payload["waitingState"])
    _require(waiting.get("kind") == "preExperiment", "waiting state kind disagrees")
    _require(waiting.get("waitingCount") == population, "waiting count disagrees")
    _require(waiting.get("metricsAvailable") is False, "waiting state fabricates metrics")
    _require(
        set(cast(Mapping[str, object], waiting["edgeLoads"]).values()) == {0},
        "waiting edge loads must all be zero",
    )
    _finite_tree(payload)
    _validate_exact(cast(Mapping[str, object], payload["exactAnalysis"]), population)
    _validate_scenario_states(cast(Mapping[str, object], payload["scenarioStates"]), population)
    learning = cast(Mapping[str, object], payload["learning"])
    _require(learning.get("study") == study, "bundle learning-study metadata disagrees")
    _validate_learning(learning, population)
    _validate_landscape(cast(Mapping[str, object], payload["potentialLandscape"]), population)
    _require(
        ("comparison" in payload) == (population == POPULATION),
        "comparison scope must be confined to the default study",
    )


def _load_object(path: Path) -> dict[str, object]:
    loaded = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise StoryValidationError(f"{path} root must be an object")
    return cast(dict[str, object], loaded)


def validate_story_file(path: str) -> dict[str, object]:
    payload = _load_object(Path(path))
    validate_story(payload)
    return payload


def validate_export_directory(path: str | Path) -> dict[int, dict[str, object]]:
    directory = Path(path)
    manifest = _load_object(directory / "manifest-v3.json")
    validate_manifest(manifest)
    result: dict[int, dict[str, object]] = {}
    for population in SUPPORTED_POPULATIONS:
        payload = _load_object(directory / f"population-{population}-v3.json")
        validate_story(payload)
        result[population] = payload
    return result
