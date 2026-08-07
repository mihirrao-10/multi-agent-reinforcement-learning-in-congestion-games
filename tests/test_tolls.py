from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario, potential_identity_summary
from congestion_marl.analysis.tolls import telescoped_variable_social_cost
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Route, Scenario


def test_tolled_potential_telescopes_over_every_state() -> None:
    game = BraessGame(Scenario.TOLLED)
    checks, toll_checks = potential_identity_summary(game)
    assert checks == 30300
    assert toll_checks == 5151
    for load in range(101):
        assert telescoped_variable_social_cost(load) == Fraction(3 * load * load, 5)


def test_tolled_unique_equilibrium_is_physical_optimum() -> None:
    analysis = analyze_scenario(Scenario.TOLLED)
    game = BraessGame(Scenario.TOLLED)
    state = (50, 50, 0)
    assert analysis.equilibria == analysis.social_optima == (state,)
    assert game.social_cost(state) == Fraction(9000)
    assert game.exploitability(state) == 0
    assert game.route_tolls(state)[Route.SHORTCUT] == Fraction(294, 5)
    assert game.total_toll_payment(state) > 0
