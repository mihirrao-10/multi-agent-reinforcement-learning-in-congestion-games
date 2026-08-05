import numpy as np

from congestion_marl.config import HedgeConfig
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.hedge import run_hedge, stable_softmax
from congestion_marl.types import Scenario


def test_stable_log_weights_and_deterministic_sampling() -> None:
    extreme = np.asarray([[1000.0, 999.0, -1000.0]])
    probabilities = stable_softmax(extreme)
    assert np.isclose(probabilities.sum(), 1)
    assert np.all(np.isfinite(probabilities))
    game = BraessGame(Scenario.OPEN, population=12)
    config = HedgeConfig(agents=12, episodes=200)
    left = run_hedge(game, config, 88)
    right = run_hedge(game, config, 88)
    assert left.final_greedy_actions == right.final_greedy_actions
    final = np.asarray(left.state["finalActionProbabilities"])
    assert np.allclose(final.sum(axis=1), 1)
    assert np.all(final >= 0)


def test_hedge_tracks_exact_counterfactual_regret() -> None:
    run = run_hedge(
        BraessGame(Scenario.CLOSED, population=10),
        HedgeConfig(agents=10, episodes=300),
        9,
    )
    assert len(run.regret_by_agent) == 10
    assert np.all(np.isfinite(run.regret_by_agent))
