from fractions import Fraction

import pytest

from congestion_marl.games.braess import BraessGame
from congestion_marl.games.routing import assignments_from_counts, counts_from_assignments
from congestion_marl.types import Route, Scenario


def test_open_route_loads_costs_and_social_cost() -> None:
    game = BraessGame(Scenario.OPEN)
    state = (35, 35, 10)
    assert game.edge_loads(state) == {"SU": 45, "UT": 35, "SV": 35, "VT": 45, "UV": 10}
    assert game.route_physical_costs(state) == {
        Route.UPPER: Fraction(135, 2),
        Route.LOWER: Fraction(135, 2),
        Route.SHORTCUT: Fraction(45),
    }
    assert game.social_cost(state) == 5175
    assert game.total_toll_payment(state) == 0


def test_assignments_and_counts_round_trip() -> None:
    assignments = assignments_from_counts((35, 35, 10), Scenario.OPEN)
    assert len(assignments) == 80
    assert counts_from_assignments(assignments, Scenario.OPEN, 80) == (35, 35, 10)


def test_route_count_validation() -> None:
    game = BraessGame(Scenario.CLOSED)
    with pytest.raises(ValueError, match="requires 2"):
        game.validate_counts((40, 40, 0))
    with pytest.raises(ValueError, match="sum"):
        game.validate_counts((39, 40))
    with pytest.raises(ValueError, match="negative"):
        game.validate_counts((-1, 81))
