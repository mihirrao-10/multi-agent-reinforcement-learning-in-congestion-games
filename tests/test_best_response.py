from itertools import pairwise

import pytest

from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.best_response import (
    exact_large_population_best_response_path,
    run_best_response,
    strict_best_response_count_path,
)
from congestion_marl.types import Scenario


def test_best_response_is_deterministic_strict_and_terminating() -> None:
    game = BraessGame(Scenario.OPEN)
    first = run_best_response(game, 123)
    second = run_best_response(game, 123)
    assert first.final_greedy_counts == second.final_greedy_counts == (1, 1, 98)
    potential = first.state["potentialPath"]
    assert isinstance(potential, list)
    assert all(left > right for left, right in pairwise(potential))
    states = first.state["acceptedMoveCountStates"]
    assert isinstance(states, list)
    assert len({tuple(state) for state in states}) == len(states)


def test_tolled_best_response_reaches_tolled_equilibrium() -> None:
    run = run_best_response(BraessGame(Scenario.TOLLED), 8)
    assert run.final_greedy_counts == (50, 50, 0)
    assert run.final_exploitability == 0


def test_large_population_checkpoint_path_is_exact_bounded_and_terminating() -> None:
    game = BraessGame(Scenario.OPEN, 1_000_000)
    checkpoints, raw_state_count = exact_large_population_best_response_path(
        game, maximum_checkpoints=7
    )

    assert raw_state_count == 666_665
    assert len(checkpoints) == 7
    assert checkpoints[0] == (333_333, 333_333, 333_334)
    assert checkpoints[-1] == (1, 1, 999_998)
    assert all(sum(state) == game.population for state in checkpoints)
    potentials = tuple(game.rosenthal_potential(state) for state in checkpoints)
    assert all(left > right for left, right in pairwise(potentials))
    assert game.is_pure_nash(checkpoints[-1])


def test_aggregate_strict_path_obeys_exact_potential_and_reaches_equilibrium() -> None:
    game = BraessGame(Scenario.OPEN)
    states, potentials = strict_best_response_count_path(game, 20260806)

    assert len(states) == len(potentials)
    assert all(left > right for left, right in pairwise(potentials))
    assert game.is_pure_nash(states[-1])
    assert len(set(states)) == len(states)


def test_large_population_checkpoint_path_rejects_unsupported_controls() -> None:
    with pytest.raises(ValueError, match="open three-route"):
        exact_large_population_best_response_path(BraessGame(Scenario.CLOSED))
    with pytest.raises(ValueError, match="two checkpoints"):
        exact_large_population_best_response_path(BraessGame(Scenario.OPEN), maximum_checkpoints=1)
    with pytest.raises(ValueError, match="three commuters"):
        exact_large_population_best_response_path(BraessGame(Scenario.OPEN, 2))
