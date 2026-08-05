from congestion_marl.analysis.enumeration import analyze_scenario, potential_identity_summary
from congestion_marl.analysis.tolls import telescoped_variable_social_cost
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Route, Scenario


def test_tolled_potential_telescopes_over_every_state() -> None:
    game = BraessGame(Scenario.TOLLED)
    checks, toll_checks = potential_identity_summary(game)
    assert checks == 19440
    assert toll_checks == 3321
    for load in range(81):
        assert telescoped_variable_social_cost(load) == load * load / 2


def test_tolled_unique_equilibrium_is_physical_optimum() -> None:
    analysis = analyze_scenario(Scenario.TOLLED)
    game = BraessGame(Scenario.TOLLED)
    state = (35, 35, 10)
    assert analysis.equilibria == analysis.social_optima == (state,)
    assert game.social_cost(state) == 5175
    assert game.exploitability(state) == 0
    assert game.route_tolls(state)[Route.SHORTCUT] == 44
    assert game.total_toll_payment(state) > 0
