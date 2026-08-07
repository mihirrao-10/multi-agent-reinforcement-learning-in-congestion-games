"""Asynchronous strict best-response dynamics."""

from __future__ import annotations

from fractions import Fraction
from itertools import pairwise

import numpy as np

from congestion_marl.games.braess import BraessGame
from congestion_marl.simulation.engine import LearningRun, counts_from_action_indices
from congestion_marl.simulation.seeds import make_streams
from congestion_marl.types import CountState


def exact_large_population_best_response_path(
    game: BraessGame, *, maximum_checkpoints: int = 144
) -> tuple[tuple[CountState, ...], int]:
    """Return exact ordered checkpoints without materializing an O(N) path.

    The authored open 60-minute game admits a transparent strict-improvement
    sequence. Start with one third of commuters on each ordinary route and
    alternate moving one ordinary-route commuter to Shortcut until one remains
    on each ordinary route. Whenever the origin count is k > 1, the mover's
    cost falls by exactly 60(k-1)/N minutes, and Rosenthal potential falls by
    the same amount. The returned points are deterministic checkpoints from
    that exact one-agent sequence; ``raw_state_count`` records its full length.
    """

    if game.scenario.value != "braess-open" or len(game.routes) != 3:
        raise ValueError("the authored checkpoint path requires the open three-route game")
    if maximum_checkpoints < 2:
        raise ValueError("at least two checkpoints are required")
    upper_start = game.population // 3
    lower_start = game.population // 3
    if upper_start < 1 or lower_start < 1:
        raise ValueError("the authored checkpoint path requires at least three commuters")
    shortcut_start = game.population - upper_start - lower_start
    total_moves = (upper_start - 1) + (lower_start - 1)
    raw_state_count = total_moves + 1
    checkpoint_count = min(maximum_checkpoints, raw_state_count)
    steps = tuple(
        dict.fromkeys(
            round(index * total_moves / (checkpoint_count - 1)) for index in range(checkpoint_count)
        )
    )

    def state_at(step: int) -> CountState:
        upper_moves = (step + 1) // 2
        lower_moves = step // 2
        return (
            upper_start - upper_moves,
            lower_start - lower_moves,
            shortcut_start + step,
        )

    checkpoints = tuple(state_at(step) for step in steps)
    potentials = tuple(game.rosenthal_potential(state) for state in checkpoints)
    if not all(left > right for left, right in pairwise(potentials)):
        raise AssertionError("authored best-response checkpoints do not descend")
    if checkpoints[-1] != (1, 1, game.population - 2):
        raise AssertionError("authored best-response path has the wrong terminal profile")
    if not game.is_pure_nash(checkpoints[-1]):
        raise AssertionError("authored best-response path misses a pure equilibrium")
    return checkpoints, raw_state_count


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
