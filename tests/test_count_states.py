from congestion_marl.analysis.enumeration import enumerate_count_states, weak_compositions
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Scenario


def test_open_and_closed_state_counts_are_complete() -> None:
    open_states = enumerate_count_states(BraessGame(Scenario.OPEN))
    closed_states = enumerate_count_states(BraessGame(Scenario.CLOSED))
    assert len(open_states) == len(set(open_states)) == 5151
    assert len(closed_states) == len(set(closed_states)) == 101
    assert all(min(state) >= 0 and sum(state) == 100 for state in open_states)
    assert open_states == enumerate_count_states(BraessGame(Scenario.OPEN))


def test_weak_composition_edges_and_invalid_controls() -> None:
    assert weak_compositions(3, 2) == ((0, 3), (1, 2), (2, 1), (3, 0))
    assert weak_compositions(4, 1) == ((4,),)
