from fractions import Fraction

import pytest

from congestion_marl.games.braess import BraessGame
from congestion_marl.games.routing import assignments_from_counts, counts_from_assignments
from congestion_marl.types import Route, Scenario


def test_open_route_loads_costs_and_social_cost() -> None:
    game = BraessGame(Scenario.OPEN)
    state = (44, 44, 12)
    assert game.edge_loads(state) == {"SU": 56, "UT": 44, "SV": 44, "VT": 56, "UV": 12}
    assert game.route_physical_costs(state) == {
        Route.UPPER: Fraction(337, 5),
        Route.LOWER: Fraction(337, 5),
        Route.SHORTCUT: Fraction(224, 5),
    }
    assert game.social_cost(state) == Fraction(32344, 5)
    assert game.total_toll_payment(state) == 0


def test_assignments_and_counts_round_trip() -> None:
    assignments = assignments_from_counts((44, 44, 12), Scenario.OPEN)
    assert len(assignments) == 100
    assert counts_from_assignments(assignments, Scenario.OPEN, 100) == (44, 44, 12)


def test_route_count_validation() -> None:
    game = BraessGame(Scenario.CLOSED)
    with pytest.raises(ValueError, match="requires 2"):
        game.validate_counts((50, 50, 0))
    with pytest.raises(ValueError, match="sum"):
        game.validate_counts((49, 50))
    with pytest.raises(ValueError, match="negative"):
        game.validate_counts((-1, 101))
