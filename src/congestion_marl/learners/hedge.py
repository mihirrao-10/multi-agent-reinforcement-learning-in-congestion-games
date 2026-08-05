"""Stable log-space full-information Hedge learners."""

from __future__ import annotations

from collections.abc import Collection

import numpy as np

from congestion_marl.config import HedgeConfig
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.independent_q import sample_rows
from congestion_marl.simulation.engine import (
    FloatArray,
    LearningRun,
    counterfactual_cost_matrix,
    counts_from_action_indices,
    make_snapshot,
    mean_policy_entropy,
)
from congestion_marl.simulation.seeds import make_streams


def stable_softmax(log_weights: FloatArray) -> FloatArray:
    """Normalize a matrix of log weights without overflow."""

    if log_weights.ndim != 2:
        raise ValueError("log weights must be a matrix")
    shifted = log_weights - np.max(log_weights, axis=1, keepdims=True)
    weights = np.exp(shifted)
    result = weights / np.sum(weights, axis=1, keepdims=True)
    if not np.all(np.isfinite(result)):
        raise FloatingPointError("softmax produced a nonfinite probability")
    return result


def perceived_cost_bound(game: BraessGame) -> float:
    """Return a valid maximum route cost over all authored count states."""

    maximum = 0.0
    for index in range(len(game.routes)):
        counts = tuple(
            game.population if route == index else 0 for route in range(len(game.routes))
        )
        maximum = max(
            maximum, *(float(value) for value in game.route_perceived_costs(counts).values())
        )
    return maximum


def run_hedge(
    game: BraessGame,
    config: HedgeConfig,
    seed: int,
    *,
    snapshot_episodes: Collection[int] = (),
) -> LearningRun:
    """Run one full-information learner per agent with exact counterfactual costs."""

    if config.agents != game.population:
        raise ValueError("learner and game populations differ")
    route_count = len(game.routes)
    streams = make_streams(seed)
    log_weights = np.zeros((game.population, route_count), dtype=np.float64)
    cumulative_realized = np.zeros(game.population, dtype=np.float64)
    cumulative_counterfactual = np.zeros((game.population, route_count), dtype=np.float64)
    empirical_counts = np.zeros(route_count, dtype=np.float64)
    bound = perceived_cost_bound(game)
    actions = streams.scenario.integers(0, route_count, size=game.population, dtype=np.int64)
    snapshots = []
    wanted = set(snapshot_episodes)
    if 0 in wanted:
        snapshots.append(
            make_snapshot(
                game,
                0,
                0.0,
                actions,
                cumulative_realized,
                cumulative_counterfactual,
                float(np.log(route_count)),
            )
        )
    for episode in range(1, config.episodes + 1):
        policies = stable_softmax(log_weights)
        actions = sample_rows(policies, streams.exploration)
        counts = counts_from_action_indices(actions, route_count)
        counterfactual = counterfactual_cost_matrix(game, counts)[actions]
        experienced = counterfactual[np.arange(game.population), actions]
        cumulative_realized += experienced
        cumulative_counterfactual += counterfactual
        empirical_counts += np.asarray(counts)
        log_weights -= config.eta * counterfactual / bound
        log_weights -= np.max(log_weights, axis=1, keepdims=True)
        if episode in wanted:
            snapshots.append(
                make_snapshot(
                    game,
                    episode,
                    0.0,
                    actions,
                    cumulative_realized,
                    cumulative_counterfactual,
                    mean_policy_entropy(policies),
                )
            )
    final_probabilities = stable_softmax(log_weights)
    final_actions = sample_rows(final_probabilities, streams.evaluation)
    final_counts = counts_from_action_indices(final_actions, route_count)
    training_counts = counts_from_action_indices(actions, route_count)
    regrets = cumulative_realized - np.min(cumulative_counterfactual, axis=1)
    if not np.all(np.isfinite(log_weights)) or not np.all(np.isfinite(regrets)):
        raise FloatingPointError("Hedge produced a nonfinite value")
    return LearningRun(
        learner="hedge",
        game=game,
        seed=seed,
        episodes=config.episodes,
        training_final_counts=training_counts,
        final_greedy_actions=tuple(int(value) for value in final_actions),
        final_greedy_counts=final_counts,
        final_exploitability=float(game.exploitability(final_counts)),
        final_physical_social_cost=float(game.social_cost(final_counts)),
        regret_by_agent=tuple(float(value) for value in regrets),
        state={
            "finalLogWeights": log_weights.tolist(),
            "finalActionProbabilities": final_probabilities.tolist(),
            "expectedMixedRouteCounts": np.sum(final_probabilities, axis=0).tolist(),
            "empiricalRouteFrequencies": (
                empirical_counts / (game.population * config.episodes)
            ).tolist(),
            "perceivedCostNormalizationBound": bound,
            "feedback": "full counterfactual route-cost vector",
        },
        snapshots=tuple(snapshots),
    )
