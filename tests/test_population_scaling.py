from fractions import Fraction

import pytest

from congestion_marl.analysis.enumeration import (
    analyze_scenario,
    count_state_total,
    potential_identity_summary,
    weak_compositions,
)
from congestion_marl.config import ExperimentConfig, HedgeConfig, QLearningConfig
from congestion_marl.export.json_writer import deterministic_json_bytes
from congestion_marl.export.story import build_population_bundle, build_potential_landscape
from congestion_marl.export.validation import validate_story
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.independent_q import run_independent_q
from congestion_marl.types import Scenario


@pytest.mark.parametrize("population", range(1, 14))
@pytest.mark.parametrize("scenario", list(Scenario))
def test_reduced_exact_analysis_matches_full_small_enumeration(
    population: int, scenario: Scenario
) -> None:
    game = BraessGame(scenario, population)
    states = weak_compositions(population, len(game.routes))
    exhaustive_equilibria = tuple(state for state in states if game.is_pure_nash(state))
    minimum = min(game.social_cost(state) for state in states)
    exhaustive_optima = tuple(state for state in states if game.social_cost(state) == minimum)
    reduced = analyze_scenario(scenario, population)
    assert reduced.equilibria == exhaustive_equilibria
    assert reduced.social_optima == exhaustive_optima
    assert (
        reduced.price_of_anarchy
        == max(game.social_cost(state) for state in exhaustive_equilibria) / minimum
    )
    assert (
        reduced.price_of_stability
        == min(game.social_cost(state) for state in exhaustive_equilibria) / minimum
    )
    assert potential_identity_summary(game, force_exhaustive=True)[0] > 0


def test_required_population_reference_values_and_ties() -> None:
    default = analyze_scenario(Scenario.OPEN, 100)
    assert default.count_states == 5_151
    assert default.equilibria == ((0, 0, 100),)
    assert default.social_optima == ((44, 44, 12),)
    assert default.equilibrium_social_costs == (Fraction(8_000),)
    assert default.optimum_social_cost == Fraction(32_344, 5)
    assert default.price_of_anarchy == default.price_of_stability == Fraction(5_000, 4_043)
    assert analyze_scenario(Scenario.CLOSED, 100).equilibria == ((50, 50),)
    assert analyze_scenario(Scenario.TOLLED, 100).equilibria == ((44, 44, 12),)
    thousand = analyze_scenario(Scenario.OPEN, 1_000)
    assert thousand.count_states == 501_501
    assert len(thousand.social_optima) == 4
    assert analyze_scenario(Scenario.TOLLED, 1_000).equilibria == thousand.social_optima
    assert analyze_scenario(Scenario.OPEN, 10_000).count_states == 50_015_001


@pytest.mark.parametrize("population", [100, 1_000, 10_000])
def test_vectorized_independent_q_shapes_counts_and_seed_determinism(population: int) -> None:
    game = BraessGame(Scenario.OPEN, population)
    config = QLearningConfig(agents=population, episodes=8)
    left = run_independent_q(game, config, 77, snapshot_episodes=(1, 4, 8))
    right = run_independent_q(game, config, 77, snapshot_episodes=(1, 4, 8))
    assert left.final_greedy_counts == right.final_greedy_counts
    assert sum(left.final_greedy_counts) == population
    assert left.state["finalEvaluationEpsilon"] == 0.0
    assert len(left.state["finalQValues"]) == population  # type: ignore[arg-type]
    for snapshot in left.snapshots:
        assert sum(snapshot.route_counts) == population
        assert snapshot.edge_loads == game.edge_loads(snapshot.route_counts)
        assert snapshot.physical_social_cost == float(game.social_cost(snapshot.route_counts))


@pytest.mark.parametrize("population", [100, 1_000, 10_000])
def test_population_bundles_are_deterministic_valid_and_compact(population: int) -> None:
    controls = ExperimentConfig(
        seeds=1,
        best_response_seeds=1,
        q_learning=QLearningConfig(agents=population, episodes=12),
        hedge=HedgeConfig(agents=population, episodes=12),
    )
    left = build_population_bundle(population, controls)
    right = build_population_bundle(population, controls)
    validate_story(left)
    assert deterministic_json_bytes(left) == deterministic_json_bytes(right)
    encoded = deterministic_json_bytes(left)
    assert b'"assignments"' not in encoded
    assert b'"finalQValues"' not in encoded
    if population > 100:
        assert len(encoded) < 1_500_000
        landscape = left["potentialLandscape"]  # type: ignore[assignment]
        assert landscape["sampling"]["mode"] == "deterministic-barycentric-sample"  # type: ignore[index]
        assert len(landscape["vertices"]) == 2_145  # type: ignore[arg-type,index]


def test_large_landscapes_do_not_materialize_quadratic_state_spaces() -> None:
    assert count_state_total(10_000, 3) == 50_015_001
    landscape = build_potential_landscape(10_000)
    assert len(landscape["vertices"]) == 2_145  # type: ignore[arg-type]
    assert len(landscape["triangles"]) == 4_096  # type: ignore[arg-type]
    assert landscape["sampling"]["fullCountStateCount"] == 50_015_001  # type: ignore[index]
