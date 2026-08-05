from itertools import pairwise

from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.best_response import run_best_response
from congestion_marl.types import Scenario


def test_best_response_is_deterministic_strict_and_terminating() -> None:
    game = BraessGame(Scenario.OPEN)
    first = run_best_response(game, 123)
    second = run_best_response(game, 123)
    assert first.final_greedy_counts == second.final_greedy_counts == (0, 0, 80)
    potential = first.state["potentialPath"]
    assert isinstance(potential, list)
    assert all(left > right for left, right in pairwise(potential))
    states = first.state["acceptedMoveAssignments"]
    assert isinstance(states, list)
    assert len({tuple(state) for state in states}) == len(states)


def test_tolled_best_response_reaches_tolled_equilibrium() -> None:
    run = run_best_response(BraessGame(Scenario.TOLLED), 8)
    assert run.final_greedy_counts == (35, 35, 10)
    assert run.final_exploitability == 0
