from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Scenario


def test_open_unique_equilibrium_and_efficiency_ratios() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    game = BraessGame(Scenario.OPEN)
    assert analysis.equilibria == ((0, 0, 80),)
    assert analysis.equilibrium_social_costs == (Fraction(6400),)
    assert game.rosenthal_potential((0, 0, 80)) == 3240
    assert game.exploitability((0, 0, 80)) == 0
    assert analysis.price_of_anarchy == Fraction(256, 207)
    assert analysis.price_of_stability == Fraction(256, 207)


def test_selected_nonequilibrium_has_profitable_deviation() -> None:
    game = BraessGame(Scenario.OPEN)
    assert game.exploitability((40, 40, 0)) > 0
