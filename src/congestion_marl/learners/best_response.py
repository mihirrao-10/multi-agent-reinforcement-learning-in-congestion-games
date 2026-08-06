"""Asynchronous strict best-response dynamics."""

from __future__ import annotations

from fractions import Fraction

import numpy as np

from congestion_marl.games.braess import BraessGame
from congestion_marl.simulation.engine import LearningRun, counts_from_action_indices
from congestion_marl.simulation.seeds import make_streams
from congestion_marl.types import CountState


def strict_best_response_count_path(
    game: BraessGame, seed: int, *, max_moves: int | None = None
) -> tuple[tuple[CountState, ...], tuple[Fraction, ...]]:
    """Return an exact aggregate one-agent strict-improvement path in O(N) space."""

    streams = make_streams(seed)
    route_count = len(game.routes)
    initial_actions = streams.scenario.integers(
        0, route_count, size=game.population, dtype=np.int64
    )
    counts = list(counts_from_action_indices(initial_actions, route_count))
    states: list[CountState] = [tuple(counts)]
    potentials: list[Fraction] = [game.perceived_potential(states[0])]
    limit = max_moves or max(100, game.population * 6)
    for _ in range(limit):
        current_state = tuple(counts)
        current_costs = game.route_perceived_costs(current_state)
        accepted = False
        for origin_index in streams.aggregate.permutation(route_count):
            if counts[int(origin_index)] == 0:
                continue
            origin = game.routes[int(origin_index)]
            candidates = [
                game.counterfactual_cost(current_state, origin, candidate)
                for candidate in game.routes
            ]
            best_cost = min(candidates)
            candidate_index = candidates.index(best_cost)
            if best_cost >= current_costs[origin]:
                continue
            counts[int(origin_index)] -= 1
            counts[candidate_index] += 1
            changed = tuple(counts)
            next_potential = game.perceived_potential(changed)
            if next_potential - potentials[-1] != best_cost - current_costs[origin]:
                raise AssertionError("aggregate path violated the exact-potential identity")
            if next_potential >= potentials[-1]:
                raise AssertionError("aggregate path failed to decrease potential")
            states.append(changed)
            potentials.append(next_potential)
            accepted = True
            break
        if not accepted:
            if not game.is_pure_nash(current_state):
                raise AssertionError("aggregate path stopped outside a pure equilibrium")
            return tuple(states), tuple(potentials)
    raise RuntimeError("aggregate strict best response exceeded its move limit")


def run_best_response(game: BraessGame, seed: int, *, max_sweeps: int = 10000) -> LearningRun:
    """Apply one labeled agent move at a time until a full sweep has no improvement."""

    streams = make_streams(seed)
    route_count = len(game.routes)
    actions = streams.scenario.integers(0, route_count, size=game.population, dtype=np.int64)
    initial_counts = counts_from_action_indices(actions, route_count)
    accepted_states: list[list[int]] = [list(initial_counts)]
    potential_path = [
        float(game.perceived_potential(counts_from_action_indices(actions, route_count)))
    ]
    accepted = 0
    for _sweep in range(max_sweeps):
        changed_in_sweep = False
        for agent in streams.aggregate.permutation(game.population):
            counts = counts_from_action_indices(actions, route_count)
            origin_index = int(actions[agent])
            origin = game.routes[origin_index]
            current = game.route_perceived_costs(counts)[origin]
            candidates = [
                game.counterfactual_cost(counts, origin, candidate) for candidate in game.routes
            ]
            best_cost = min(candidates)
            best_index = candidates.index(best_cost)
            if best_cost >= current:
                continue
            previous_potential = game.perceived_potential(counts)
            actions[agent] = best_index
            changed = counts_from_action_indices(actions, route_count)
            next_potential = game.perceived_potential(changed)
            if not next_potential < previous_potential:
                raise AssertionError("accepted strict best response did not lower potential")
            if next_potential - previous_potential != best_cost - current:
                raise AssertionError("best-response move violated the exact-potential identity")
            accepted += 1
            changed_in_sweep = True
            accepted_states.append(list(changed))
            potential_path.append(float(next_potential))
        if not changed_in_sweep:
            break
    else:
        raise RuntimeError("best response exceeded the finite-improvement sweep limit")
    final_counts = counts_from_action_indices(actions, route_count)
    if not game.is_pure_nash(final_counts):
        raise AssertionError("strict best response terminated outside a pure Nash equilibrium")
    if len({tuple(state) for state in accepted_states}) != len(accepted_states):
        raise AssertionError("strict-improvement path contains a cycle")
    return LearningRun(
        learner="best-response",
        game=game,
        seed=seed,
        episodes=accepted,
        training_final_counts=final_counts,
        final_greedy_actions=tuple(int(value) for value in actions),
        final_greedy_counts=final_counts,
        final_exploitability=0.0,
        final_physical_social_cost=float(game.social_cost(final_counts)),
        regret_by_agent=tuple(0.0 for _ in range(game.population)),
        state={
            "acceptedMoveCountStates": accepted_states,
            "potentialPath": potential_path,
            "termination": "full deterministic seeded sweep with no strict improvement",
        },
    )
