import copy
from fractions import Fraction

import pytest

from congestion_marl.analysis.enumeration import (
    _convex_integer_candidates,
    analyze_scenario,
    count_state_total,
    potential_identity_summary,
    weak_compositions,
)
from congestion_marl.config import (
    SAMPLED_LEARNERS,
    SELECTABLE_POPULATIONS,
    SUPPORTED_POPULATIONS,
    ExperimentConfig,
    HedgeConfig,
    QLearningConfig,
    experiment_config_for_population,
    learning_study_kind,
    simulated_learner_count,
)
from congestion_marl.export.json_writer import deterministic_json_bytes
from congestion_marl.export.story import build_population_bundle, build_potential_landscape
from congestion_marl.export.validation import StoryValidationError, validate_story
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.independent_q import run_independent_q
from congestion_marl.simulation.aggregation import largest_remainder_scale_counts
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


def test_required_population_reference_values_and_weak_equilibria() -> None:
    default = analyze_scenario(Scenario.OPEN, 100)
    assert default.count_states == 5_151
    assert default.equilibria == (
        (0, 0, 100),
        (0, 1, 99),
        (1, 0, 99),
        (1, 1, 98),
    )
    assert default.social_optima == ((50, 50, 0),)
    assert default.equilibrium_social_costs[0] == Fraction(12_000)
    assert default.optimum_social_cost == Fraction(9_000)
    assert default.price_of_anarchy == Fraction(4, 3)
    assert default.price_of_stability == Fraction(9_901, 7_500)
    assert analyze_scenario(Scenario.CLOSED, 100).equilibria == ((50, 50),)
    assert analyze_scenario(Scenario.TOLLED, 100).equilibria == ((50, 50, 0),)
    thousand = analyze_scenario(Scenario.OPEN, 1_000)
    assert thousand.count_states == 501_501
    assert thousand.social_optima == ((500, 500, 0),)
    assert analyze_scenario(Scenario.TOLLED, 1_000).equilibria == thousand.social_optima
    assert analyze_scenario(Scenario.OPEN, 10_000).count_states == 50_015_001
    for population, state_count in (
        (100_000, 5_000_150_001),
        (1_000_000, 500_001_500_001),
    ):
        open_analysis = analyze_scenario(Scenario.OPEN, population)
        closed_analysis = analyze_scenario(Scenario.CLOSED, population)
        tolled_analysis = analyze_scenario(Scenario.TOLLED, population)
        optimum = (population // 2, population // 2, 0)
        assert open_analysis.count_states == state_count
        assert open_analysis.equilibria == (
            (0, 0, population),
            (0, 1, population - 1),
            (1, 0, population - 1),
            (1, 1, population - 2),
        )
        assert open_analysis.social_optima == (optimum,)
        assert closed_analysis.equilibria == ((population // 2, population // 2),)
        assert closed_analysis.social_optima == closed_analysis.equilibria
        assert tolled_analysis.equilibria == (optimum,)
        assert tolled_analysis.social_optima == (optimum,)
        assert open_analysis.optimum_social_cost / population == Fraction(90)
        assert open_analysis.price_of_anarchy == Fraction(4, 3)
        assert open_analysis.price_of_stability == Fraction(
            4 * (population * population - population + 1),
            3 * population * population,
        )


def _linear_reference_component_minima(
    population: int, scenario: Scenario, *, social: bool
) -> tuple[tuple[int, ...], ...]:
    game = BraessGame(scenario, population)
    if scenario is Scenario.CLOSED:
        states = tuple((upper, population - upper) for upper in range(population + 1))
    else:
        component_values = []
        for component in range(population + 1):
            state = (component, 0, population - component)
            value = game.social_cost(state) if social else game.perceived_potential(state)
            component_values.append((component, value))
        minimum = min(value for _, value in component_values)
        minimizers = tuple(component for component, value in component_values if value == minimum)
        states = tuple(
            (upper, lower, population - upper - lower)
            for upper in minimizers
            for lower in minimizers
            if upper + lower <= population
        )
    objective = game.social_cost if social else game.perceived_potential
    minimum = min(objective(state) for state in states)
    return tuple(state for state in states if objective(state) == minimum)


@pytest.mark.parametrize("population", range(25, 2_001, 37))
def test_constant_candidate_solver_matches_linear_reference_across_medium_range(
    population: int,
) -> None:
    for scenario in Scenario:
        analysis = analyze_scenario(scenario, population)
        assert analysis.equilibria == _linear_reference_component_minima(
            population, scenario, social=scenario is Scenario.TOLLED
        )
        assert analysis.social_optima == _linear_reference_component_minima(
            population, scenario, social=True
        )


def test_convex_candidate_neighborhood_is_constant_size_at_a_million() -> None:
    for center in (Fraction(1_000_000, 2), Fraction(1, 2)):
        candidates = _convex_integer_candidates(center, 1_000_000)
        assert len(candidates) <= 8
        assert all(0 <= candidate <= 1_000_000 for candidate in candidates)


def test_population_study_contract_and_largest_remainder_scaling() -> None:
    assert SELECTABLE_POPULATIONS == (1_000, 10_000, 100_000)
    assert SUPPORTED_POPULATIONS == (100, 1_000, 10_000, 100_000)
    assert SAMPLED_LEARNERS == 10_000
    for population in SUPPORTED_POPULATIONS:
        sampled = population >= 100_000
        assert learning_study_kind(population) == (
            "sampled-population-proxy" if sampled else "full-population"
        )
        assert simulated_learner_count(population) == (10_000 if sampled else population)
        assert experiment_config_for_population(population).population == (
            10_000 if sampled else population
        )
    assert largest_remainder_scale_counts((1, 1, 1), 10) == (4, 3, 3)
    assert largest_remainder_scale_counts((3, 2, 1), 10) == (5, 3, 2)
    assert largest_remainder_scale_counts((258, 257, 9_485), 1_000_000) == (
        25_800,
        25_700,
        948_500,
    )
    with pytest.raises(ValueError):
        largest_remainder_scale_counts((0, 0, 0), 100)
    with pytest.raises(ValueError):
        largest_remainder_scale_counts((1, -1, 2), 100)
    with pytest.raises(ValueError):
        largest_remainder_scale_counts((1, 2, 3), 0)


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


@pytest.mark.parametrize("population", [100_000])
def test_sampled_study_bundles_recompute_full_population_measurements(
    population: int,
) -> None:
    controls = ExperimentConfig(
        seeds=1,
        best_response_seeds=1,
        q_learning=QLearningConfig(agents=10_000, episodes=8),
        hedge=HedgeConfig(agents=10_000, episodes=8),
    )
    bundle = build_population_bundle(population, controls)
    validate_story(bundle)
    assert bundle["learningStudy"] == {  # type: ignore[comparison-overlap]
        "learningStudyKind": "sampled-population-proxy",
        "representedPopulation": population,
        "simulatedLearners": 10_000,
        "samplingDescription": (
            "10,000 independent tabular learners estimate normalized route shares "
            f"for the represented population of {population:,}."
        ),
    }
    scenarios = bundle["learning"]["scenarios"]  # type: ignore[index]
    for scenario in Scenario:
        block = scenarios[scenario.value]
        assert block["routeShareScaling"] == {
            "method": "deterministic largest remainder with route-index tie breaking",
            "representedPopulation": population,
            "simulatedLearners": 10_000,
            "costsRecomputedFromScaledIntegerCounts": True,
        }
        assert block["representative"]["learnerState"]["qValueShape"] == [  # type: ignore[index]
            10_000,
            len(BraessGame(scenario, population).routes),
        ]
        game = BraessGame(scenario, population)
        for snapshot in block["representative"]["snapshots"]:  # type: ignore[index]
            counts = tuple(snapshot["routeCounts"])
            assert sum(counts) == population
            assert snapshot["edgeLoads"] == game.edge_loads(counts)
            assert snapshot["physicalSocialCost"] == float(game.social_cost(counts))

    dishonest = copy.deepcopy(bundle)
    dishonest["learningStudy"]["simulatedLearners"] = population  # type: ignore[index]
    with pytest.raises(StoryValidationError, match="simulated learner"):
        validate_story(dishonest)
