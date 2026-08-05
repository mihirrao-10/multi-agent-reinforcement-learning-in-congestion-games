import numpy as np

from congestion_marl.config import QLearningConfig
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.independent_q import (
    epsilon_greedy_probabilities,
    q_update,
    run_independent_q,
    select_actions,
)
from congestion_marl.simulation.seeds import make_streams
from congestion_marl.types import Scenario


def test_q_learning_is_fixed_seed_deterministic_and_separate() -> None:
    game = BraessGame(Scenario.OPEN, population=12)
    config = QLearningConfig(agents=12, episodes=250)
    left = run_independent_q(game, config, 17)
    right = run_independent_q(game, config, 17)
    assert left.final_greedy_counts == right.final_greedy_counts
    assert left.state["finalQValues"] == right.state["finalQValues"]
    q_values = np.asarray(left.state["finalQValues"])
    assert q_values.shape == (12, 3)
    assert not np.shares_memory(q_values[0], q_values[1])
    assert left.state["finalEvaluationEpsilon"] == 0.0


def test_actions_are_selected_before_updates_and_only_chosen_entries_change() -> None:
    q_values = np.zeros((4, 3), dtype=np.float64)
    before = q_values.copy()
    actions, probabilities = select_actions(q_values, 0.5, make_streams(91))
    assert np.array_equal(q_values, before)
    assert np.allclose(probabilities.sum(axis=1), 1)
    q_update(q_values, actions, np.full(4, -10.0), 0.15)
    for agent, action in enumerate(actions):
        assert q_values[agent, action] == -1.5
        assert np.count_nonzero(q_values[agent]) == 1


def test_tie_breaking_and_epsilon_schedule_are_deterministic() -> None:
    q_values = np.zeros((6, 3), dtype=np.float64)
    first = select_actions(q_values, 0.0, make_streams(44))[0]
    second = select_actions(q_values, 0.0, make_streams(44))[0]
    assert np.array_equal(first, second)
    assert np.allclose(epsilon_greedy_probabilities(q_values, 0.8), 1 / 3)
    config = QLearningConfig()
    assert config.epsilon(1) == 0.8
    assert config.epsilon(5000) == 0.01


def test_reward_sign_drives_q_values_negative_without_nonfinite_values() -> None:
    run = run_independent_q(
        BraessGame(Scenario.CLOSED, population=10),
        QLearningConfig(agents=10, episodes=100),
        2,
    )
    values = np.asarray(run.state["finalQValues"])
    assert np.all(np.isfinite(values))
    assert np.all(values <= 0)
