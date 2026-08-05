"""Experienced-feedback independent tabular Q-learning."""

from __future__ import annotations

from collections.abc import Collection

import numpy as np

from congestion_marl.config import QLearningConfig
from congestion_marl.games.braess import BraessGame
from congestion_marl.simulation.engine import (
    FloatArray,
    IntArray,
    LearningRun,
    counterfactual_cost_matrix,
    counts_from_action_indices,
    make_snapshot,
    mean_policy_entropy,
)
from congestion_marl.simulation.seeds import RandomStreams, make_streams


def epsilon_greedy_probabilities(q_values: FloatArray, epsilon: float) -> FloatArray:
    """Return per-agent epsilon-greedy policies with uniform random tie-breaking."""

    if q_values.ndim != 2 or q_values.shape[1] < 2:
        raise ValueError("Q values must have shape (agents, at least two routes)")
    if not 0 <= epsilon <= 1:
        raise ValueError("epsilon must lie in [0, 1]")
    maximum = np.max(q_values, axis=1, keepdims=True)
    tied = np.isclose(q_values, maximum, rtol=0.0, atol=1e-12)
    tie_counts = np.sum(tied, axis=1, keepdims=True)
    probabilities = np.full_like(q_values, epsilon / q_values.shape[1])
    probabilities += tied * ((1.0 - epsilon) / tie_counts)
    return probabilities


def sample_rows(probabilities: FloatArray, generator: np.random.Generator) -> IntArray:
    """Sample one categorical action per row using one deterministic stream."""

    if probabilities.ndim != 2 or not np.allclose(np.sum(probabilities, axis=1), 1.0):
        raise ValueError("each policy row must sum to one")
    draws = np.asarray(generator.random(probabilities.shape[0]), dtype=np.float64)
    cumulative = np.cumsum(probabilities, axis=1)
    return np.sum(draws[:, None] > cumulative, axis=1, dtype=np.int64)


def select_actions(
    q_values: FloatArray, epsilon: float, streams: RandomStreams
) -> tuple[IntArray, FloatArray]:
    """Select all agents' actions from unchanged pre-reward Q values."""

    probabilities = epsilon_greedy_probabilities(q_values, epsilon)
    explore = streams.exploration.random(q_values.shape[0]) < epsilon
    exploratory = streams.exploration.integers(0, q_values.shape[1], size=q_values.shape[0])
    greedy_probabilities = epsilon_greedy_probabilities(q_values, 0.0)
    greedy = sample_rows(greedy_probabilities, streams.tie_breaking)
    return np.where(explore, exploratory, greedy).astype(np.int64), probabilities


def q_update(q_values: FloatArray, actions: IntArray, rewards: FloatArray, alpha: float) -> None:
    """Update only the chosen route value in every separate agent row."""

    if q_values.shape[0] != len(actions) or len(actions) != len(rewards):
        raise ValueError("Q update axes are inconsistent")
    rows = np.arange(q_values.shape[0])
    old = q_values[rows, actions]
    q_values[rows, actions] = old + alpha * (rewards - old)


def run_independent_q(
    game: BraessGame,
    config: QLearningConfig,
    seed: int,
    *,
    snapshot_episodes: Collection[int] = (),
) -> LearningRun:
    """Run simultaneous independent Q-learning and a separate epsilon-zero evaluation."""

    if config.agents != game.population:
        raise ValueError("learner and game populations differ")
    route_count = len(game.routes)
    streams = make_streams(seed)
    q_values = np.full((game.population, route_count), config.initial_q, dtype=np.float64)
    cumulative_realized = np.zeros(game.population, dtype=np.float64)
    cumulative_counterfactual = np.zeros((game.population, route_count), dtype=np.float64)
    initial_actions = streams.scenario.integers(
        0, route_count, size=game.population, dtype=np.int64
    )
    snapshots = []
    wanted = set(snapshot_episodes)
    if 0 in wanted:
        snapshots.append(
            make_snapshot(
                game,
                0,
                config.epsilon_start,
                initial_actions,
                cumulative_realized,
                cumulative_counterfactual,
                float(np.log(route_count)),
            )
        )
    actions = initial_actions
    for episode in range(1, config.episodes + 1):
        epsilon = config.epsilon(episode)
        actions, policies = select_actions(q_values, epsilon, streams)
        counts = counts_from_action_indices(actions, route_count)
        perceived = game.route_perceived_costs(counts)
        route_cost_vector = np.asarray([float(perceived[route]) for route in game.routes])
        experienced_costs = route_cost_vector[actions]
        counterfactual = counterfactual_cost_matrix(game, counts)[actions]
        cumulative_realized += experienced_costs
        cumulative_counterfactual += counterfactual
        q_update(q_values, actions, -experienced_costs, config.alpha)
        if episode in wanted:
            snapshots.append(
                make_snapshot(
                    game,
                    episode,
                    epsilon,
                    actions,
                    cumulative_realized,
                    cumulative_counterfactual,
                    mean_policy_entropy(policies),
                )
            )
    final_policies = epsilon_greedy_probabilities(q_values, 0.0)
    final_actions = sample_rows(final_policies, streams.evaluation)
    final_counts = counts_from_action_indices(final_actions, route_count)
    training_counts = counts_from_action_indices(actions, route_count)
    regrets = cumulative_realized - np.min(cumulative_counterfactual, axis=1)
    if not np.all(np.isfinite(q_values)) or not np.all(np.isfinite(regrets)):
        raise FloatingPointError("Q-learning produced a nonfinite value")
    return LearningRun(
        learner="q-learning",
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
            "finalQValues": q_values.tolist(),
            "finalGreedyPolicyProbabilities": final_policies.tolist(),
            "finalEvaluationEpsilon": 0.0,
            "feedback": "experienced selected-route reward only",
        },
        snapshots=tuple(snapshots),
    )
