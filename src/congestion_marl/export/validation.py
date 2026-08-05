"""Strict semantic validation for the authoritative story bundle."""

from __future__ import annotations

import json
import math
from collections import Counter
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import cast

from congestion_marl.analysis.enumeration import analyze_scenario
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


def _validate_snapshot(snapshot: Mapping[str, object], game: BraessGame) -> None:
    counts = tuple(cast(list[int], snapshot["routeCounts"]))
    game.validate_counts(counts)
    assignments = cast(list[int], snapshot["assignments"])
    _require(len(assignments) == game.population, "snapshot must contain all eighty assignments")
    _require(all(0 <= value < len(game.routes) for value in assignments), "invalid route code")
    derived_counts = tuple(Counter(assignments)[index] for index in range(len(game.routes)))
    _require(derived_counts == counts, "snapshot assignments disagree with route counts")
    _require(
        cast(dict[str, int], snapshot["edgeLoads"]) == game.edge_loads(counts),
        "edge loads disagree",
    )
    physical = tuple(float(value) for value in game.route_physical_costs(counts).values())
    perceived = tuple(float(value) for value in game.route_perceived_costs(counts).values())
    exported_physical = cast(list[float], snapshot["routePhysicalCosts"])
    exported_perceived = cast(list[float], snapshot["routePerceivedCosts"])
    _require(
        all(
            math.isclose(a, b, abs_tol=1e-12)
            for a, b in zip(physical, exported_physical, strict=True)
        ),
        "route physical costs disagree",
    )
    _require(
        all(
            math.isclose(a, b, abs_tol=1e-12)
            for a, b in zip(perceived, exported_perceived, strict=True)
        ),
        "route perceived costs disagree",
    )
    social = float(game.social_cost(counts))
    _require(
        math.isclose(_number(snapshot["physicalSocialCost"], "physical social cost"), social),
        "social cost disagrees",
    )
    _require(
        math.isclose(
            _number(snapshot["averagePhysicalLatency"], "average physical latency"),
            social / game.population,
        ),
        "average latency disagrees",
    )
    _require(
        math.isclose(
            _number(snapshot["rosenthalPotential"], "Rosenthal potential"),
            float(game.rosenthal_potential(counts)),
        ),
        "Rosenthal potential disagrees",
    )
    _require(
        math.isclose(
            _number(snapshot["exploitability"], "exploitability"),
            float(game.exploitability(counts)),
        ),
        "exploitability disagrees",
    )


def _validate_exact(exact: Mapping[str, object]) -> None:
    expected = {
        Scenario.OPEN: ((0, 0, 80), (35, 35, 10), 6400.0, 5175.0),
        Scenario.CLOSED: ((40, 40), (40, 40), 5200.0, 5200.0),
        Scenario.TOLLED: ((35, 35, 10), (35, 35, 10), 5175.0, 5175.0),
    }
    for scenario, (equilibrium, optimum, equilibrium_cost, optimum_cost) in expected.items():
        block = cast(Mapping[str, object], exact[scenario.value])
        derived = analyze_scenario(scenario)
        _require(
            _integer(block["countStateCount"], "count-state total") == derived.count_states,
            "count-state total disagrees",
        )
        equilibria = cast(list[Mapping[str, object]], block["pureNashEquilibria"])
        optima = cast(list[Mapping[str, object]], block["socialOptima"])
        actual_equilibrium = tuple(cast(list[int], equilibria[0]["routeCounts"]))
        actual_optimum = tuple(cast(list[int], optima[0]["routeCounts"]))
        _require(
            len(equilibria) == 1 and actual_equilibrium == equilibrium,
            "canonical equilibrium disagrees",
        )
        _require(len(optima) == 1 and actual_optimum == optimum, "canonical optimum disagrees")
        eq_cost = cast(Mapping[str, object], equilibria[0]["physicalSocialCost"])
        op_cost = cast(Mapping[str, object], optima[0]["physicalSocialCost"])
        _require(
            _number(eq_cost["decimal"], "equilibrium social cost") == equilibrium_cost,
            "equilibrium social cost disagrees",
        )
        _require(
            _number(op_cost["decimal"], "optimum social cost") == optimum_cost,
            "optimum social cost disagrees",
        )


def _validate_landscape(landscape: Mapping[str, object]) -> None:
    vertices = cast(list[Mapping[str, object]], landscape["vertices"])
    triangles = cast(list[list[int]], landscape["triangles"])
    _require(len(vertices) == 3321, "landscape must contain 3321 vertices")
    _require(len(triangles) == 6400, "landscape must contain 6400 triangles")
    states = [tuple(cast(list[int], vertex["routeCounts"])) for vertex in vertices]
    _require(len(set(states)) == 3321, "landscape has duplicate or missing count states")
    _require(
        all(len(state) == 3 and min(state) >= 0 and sum(state) == 80 for state in states),
        "invalid landscape count state",
    )
    for triangle in triangles:
        _require(len(triangle) == 3 and len(set(triangle)) == 3, "degenerate landscape triangle")
        _require(
            all(0 <= index < len(vertices) for index in triangle),
            "triangle index out of bounds",
        )
        points = [cast(list[float], vertices[index]["displayCoordinates"]) for index in triangle]
        area_twice = (points[1][0] - points[0][0]) * (points[2][1] - points[0][1]) - (
            points[1][1] - points[0][1]
        ) * (points[2][0] - points[0][0])
        _require(abs(area_twice) > 1e-12, "geometrically degenerate landscape triangle")
    equilibrium_index = _integer(landscape["equilibriumVertexIndex"], "equilibrium index")
    optimum_index = _integer(landscape["optimumVertexIndex"], "optimum index")
    _require(states[equilibrium_index] == (0, 0, 80), "equilibrium vertex index disagrees")
    _require(states[optimum_index] == (35, 35, 10), "optimum vertex index disagrees")


def validate_story(payload: Mapping[str, object]) -> None:
    """Validate schema, canonical results, trajectories, and landscape topology."""

    _require(payload.get("schemaVersion") == SCHEMA_VERSION, "unsupported schema version")
    model = cast(Mapping[str, object], payload.get("model"))
    _require(model.get("identifier") == MODEL_IDENTIFIER, "unexpected model identifier")
    _require(model.get("agentCount") == 80, "model must contain eighty agents")
    _finite_tree(payload)
    _validate_exact(cast(Mapping[str, object], payload["exactAnalysis"]))
    _validate_landscape(cast(Mapping[str, object], payload["potentialLandscape"]))
    experiments = cast(Mapping[str, object], payload["experiments"])
    scenarios = cast(Mapping[str, object], experiments["scenarios"])
    for scenario in Scenario:
        game = BraessGame(scenario)
        scenario_block = cast(Mapping[str, object], scenarios[scenario.value])
        for learner_key in ("qLearning", "hedge", "bestResponse"):
            learner = cast(Mapping[str, object], scenario_block[learner_key])
            seeds = cast(list[int], learner["seedList"])
            _require(len(seeds) == len(set(seeds)) and len(seeds) > 0, "seed list is invalid")
            selection = cast(Mapping[str, object], learner["representativeSelection"])
            _require(
                _integer(selection["representativeSeed"], "representative seed") in seeds,
                "representative seed is not a candidate",
            )
            representative = cast(Mapping[str, object], learner["representative"])
            snapshots = cast(list[Mapping[str, object]], representative["snapshots"])
            episodes = [_integer(snapshot["episode"], "snapshot episode") for snapshot in snapshots]
            _require(
                episodes == sorted(set(episodes)), "snapshot episodes are not strictly monotone"
            )
            for snapshot in snapshots:
                _validate_snapshot(snapshot, game)
            summary = cast(Mapping[str, object], representative["summary"])
            final_counts = tuple(cast(list[int], summary["finalGreedyRouteCounts"]))
            game.validate_counts(final_counts)
            _require(
                math.isclose(
                    _number(summary["exploitability"], "final exploitability"),
                    float(game.exploitability(final_counts)),
                ),
                "final exploitability disagrees",
            )


def validate_story_file(path: str) -> dict[str, object]:
    loaded = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(loaded, dict):
        raise StoryValidationError("story root must be an object")
    payload = cast(dict[str, object], loaded)
    validate_story(payload)
    return payload
