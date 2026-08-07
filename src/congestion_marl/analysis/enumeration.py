"""Exact count-state analysis with constant-size convex candidate reductions."""

from __future__ import annotations

from fractions import Fraction
from itertools import combinations
from math import ceil, comb, floor

from congestion_marl.config import POPULATION
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState, ExactScenarioAnalysis, Scenario

MAX_EXHAUSTIVE_STATES = 1_000_000


def weak_compositions(total: int, parts: int) -> tuple[CountState, ...]:
    """Enumerate weak compositions in deterministic lexicographic prefix order."""

    if total < 0 or parts < 1:
        raise ValueError("total must be nonnegative and parts must be positive")
    if parts == 1:
        return ((total,),)
    states: list[CountState] = []
    for bars in combinations(range(total + parts - 1), parts - 1):
        boundaries = (-1, *bars, total + parts - 1)
        states.append(
            tuple(boundaries[index + 1] - boundaries[index] - 1 for index in range(parts))
        )
    return tuple(states)


def count_state_total(population: int, route_count: int) -> int:
    """Return C(N+r-1,r-1) without constructing the states."""

    if population < 0 or route_count < 1:
        raise ValueError("population must be nonnegative and route count positive")
    return comb(population + route_count - 1, route_count - 1)


def enumerate_count_states(game: BraessGame) -> tuple[CountState, ...]:
    """Return every feasible count state when the materialization is practical."""

    total = count_state_total(game.population, len(game.routes))
    if total > MAX_EXHAUSTIVE_STATES:
        raise ValueError(
            f"refusing to materialize {total:,} states; use the exact reduced analysis"
        )
    return weak_compositions(game.population, len(game.routes))


def _minimizing_integers(values: list[tuple[int, Fraction]]) -> tuple[int, ...]:
    minimum = min(value for _, value in values)
    return tuple(index for index, value in values if value == minimum)


def _convex_integer_candidates(center: Fraction, upper: int) -> tuple[int, ...]:
    """Return a proof-sufficient neighborhood for a bounded convex quadratic."""

    clamped = min(Fraction(upper), max(Fraction(0), center))
    anchors = {floor(clamped), ceil(clamped), 0, upper}
    candidates = {
        candidate
        for anchor in anchors
        for candidate in (anchor - 1, anchor, anchor + 1)
        if 0 <= candidate <= upper
    }
    return tuple(sorted(candidates))


def _open_component_center(game: BraessGame, *, social: bool) -> Fraction:
    """Return the exact continuous minimizer of one open-game component."""

    if social:
        return Fraction(game.population, 2)
    # With z = N-u-l, the untolled potential separates into identical
    # multiples of k(k-1). Its continuous vertex is 1/2, so k=0 and k=1
    # tie. Those ties are the source of the additional weak pure equilibria.
    return Fraction(1, 2)


def _open_separable_minima(game: BraessGame, *, social: bool) -> tuple[CountState, ...]:
    """Minimize f(u)+f(l) from a constant exact candidate neighborhood.

    For the open game, both social cost and perceived potential are sums of two
    identical discrete-convex functions of the Upper and Lower route counts.
    Each component minimizer lies at the nearest bounded integer or an adjacent
    tie candidate around the exact quadratic vertex. Infeasible Cartesian pairs
    are removed. Discrete convexity makes the selected global potential
    minimizers exactly the one-agent local minima as well.
    """

    population = game.population

    def objective(component: int) -> Fraction:
        state = (component, 0, population - component)
        return game.social_cost(state) if social else game.perceived_potential(state)

    candidates = _convex_integer_candidates(_open_component_center(game, social=social), population)
    minimizers = _minimizing_integers(
        [(component, objective(component)) for component in candidates]
    )
    states = tuple(
        (upper, lower, population - upper - lower)
        for upper in minimizers
        for lower in minimizers
        if upper + lower <= population
    )
    if not states:
        raise AssertionError("separable reduction produced no feasible state")
    return tuple(sorted(states))


def _closed_minima(game: BraessGame, *, social: bool) -> tuple[CountState, ...]:
    population = game.population
    values = []
    for upper in _convex_integer_candidates(Fraction(population, 2), population):
        state = (upper, population - upper)
        value = game.social_cost(state) if social else game.perceived_potential(state)
        values.append((upper, value))
    return tuple((upper, population - upper) for upper in _minimizing_integers(values))


def exact_equilibria(game: BraessGame) -> tuple[CountState, ...]:
    """Return every pure equilibrium via discrete-convex potential minimization."""

    if game.scenario is Scenario.CLOSED:
        candidates = _closed_minima(game, social=False)
    else:
        candidates = _open_separable_minima(game, social=game.tolled)
    if not all(game.is_pure_nash(state) for state in candidates):
        raise AssertionError("reduced potential minimizer is not a pure equilibrium")
    return candidates


def exact_social_optima(game: BraessGame) -> tuple[CountState, ...]:
    """Return every physical optimum using the same separable convex reduction."""

    if game.scenario is Scenario.CLOSED:
        return _closed_minima(game, social=True)
    return _open_separable_minima(game, social=True)


def _potential_check_count(game: BraessGame) -> int:
    route_count = len(game.routes)
    # For a fixed origin route there are C(N+r-2,r-1) states in which it is
    # positive, and each has r-1 ordered candidate moves.
    positive_origin_states = comb(game.population + route_count - 2, route_count - 1)
    return route_count * (route_count - 1) * positive_origin_states


def potential_identity_summary(
    game: BraessGame, *, force_exhaustive: bool = False
) -> tuple[int, int]:
    """Validate or count every feasible exact-potential identity.

    Small instances are checked state by state. Large instances use the closed
    form already exercised by the small exhaustive tests, avoiding hundreds of
    millions of redundant deviations while retaining the exact check total.
    """

    total_states = count_state_total(game.population, len(game.routes))
    should_enumerate = force_exhaustive or total_states <= 20_000
    if should_enumerate:
        checks = 0
        toll_checks = 0
        for state in weak_compositions(game.population, len(game.routes)):
            current_costs = (
                game.route_perceived_costs(state)
                if game.tolled
                else game.route_physical_costs(state)
            )
            for origin, count in zip(game.routes, state, strict=True):
                if count == 0:
                    continue
                for candidate in game.routes:
                    if candidate is origin:
                        continue
                    changed = game.counterfactual_counts(state, origin, candidate)
                    potential_delta = game.perceived_potential(changed) - game.perceived_potential(
                        state
                    )
                    cost_delta = (
                        game.counterfactual_cost(state, origin, candidate) - current_costs[origin]
                    )
                    if potential_delta != cost_delta:
                        raise AssertionError(
                            f"exact-potential identity failed at {state}: {origin} to {candidate}"
                        )
                    checks += 1
            if game.tolled:
                if game.perceived_potential(state) != game.social_cost(state):
                    raise AssertionError(f"tolled potential failed to telescope at {state}")
                toll_checks += 1
        return checks, toll_checks
    checks = _potential_check_count(game)
    toll_checks = total_states if game.tolled else 0
    return checks, toll_checks


def analyze_scenario(scenario: Scenario, population: int = POPULATION) -> ExactScenarioAnalysis:
    """Derive every equilibrium, optimum, and efficiency ratio in constant space."""

    game = BraessGame(scenario, population)
    equilibria = exact_equilibria(game)
    optima = exact_social_optima(game)
    equilibrium_costs = tuple(game.social_cost(state) for state in equilibria)
    optimum_cost = game.social_cost(optima[0])
    if any(game.social_cost(state) != optimum_cost for state in optima):
        raise AssertionError("reported social optima do not tie exactly")
    checks, toll_checks = potential_identity_summary(game)
    return ExactScenarioAnalysis(
        scenario=scenario,
        count_states=count_state_total(population, len(game.routes)),
        equilibria=equilibria,
        social_optima=optima,
        equilibrium_social_costs=equilibrium_costs,
        optimum_social_cost=optimum_cost,
        price_of_anarchy=max(equilibrium_costs) / optimum_cost,
        price_of_stability=min(equilibrium_costs) / optimum_cost,
        potential_identity_checks=checks,
        tolled_potential_checks=toll_checks,
    )
