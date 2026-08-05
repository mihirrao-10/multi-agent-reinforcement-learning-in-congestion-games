"""Exact symmetry-reduced count-state enumeration."""

from __future__ import annotations

from itertools import combinations

from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState, ExactScenarioAnalysis, Scenario


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


def enumerate_count_states(game: BraessGame) -> tuple[CountState, ...]:
    """Return every feasible symmetric route-count state exactly once."""

    return weak_compositions(game.population, len(game.routes))


def potential_identity_summary(game: BraessGame) -> tuple[int, int]:
    """Validate every feasible unilateral exact-potential identity."""

    checks = 0
    toll_checks = 0
    for state in enumerate_count_states(game):
        current_costs = (
            game.route_perceived_costs(state) if game.tolled else game.route_physical_costs(state)
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


def analyze_scenario(scenario: Scenario, population: int = 80) -> ExactScenarioAnalysis:
    """Derive every equilibrium, optimum, and efficiency ratio from enumeration."""

    game = BraessGame(scenario, population)
    states = enumerate_count_states(game)
    equilibria = tuple(state for state in states if game.is_pure_nash(state))
    if not equilibria:
        raise AssertionError("finite congestion game unexpectedly has no pure equilibrium")
    costs = {state: game.social_cost(state) for state in states}
    optimum_cost = min(costs.values())
    optima = tuple(state for state in states if costs[state] == optimum_cost)
    equilibrium_costs = tuple(costs[state] for state in equilibria)
    checks, toll_checks = potential_identity_summary(game)
    return ExactScenarioAnalysis(
        scenario=scenario,
        count_states=len(states),
        equilibria=equilibria,
        social_optima=optima,
        equilibrium_social_costs=equilibrium_costs,
        optimum_social_cost=optimum_cost,
        price_of_anarchy=max(equilibrium_costs) / optimum_cost,
        price_of_stability=min(equilibrium_costs) / optimum_cost,
        potential_identity_checks=checks,
        tolled_potential_checks=toll_checks,
    )
