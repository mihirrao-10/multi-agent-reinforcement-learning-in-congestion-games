from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Scenario


def test_open_unique_equilibrium_and_efficiency_ratios() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    game = BraessGame(Scenario.OPEN)
    assert analysis.equilibria == ((0, 0, 100),)
    assert analysis.equilibrium_social_costs == (Fraction(8000),)
    assert game.rosenthal_potential((0, 0, 100)) == 4040
    assert game.exploitability((0, 0, 100)) == 0
    assert analysis.price_of_anarchy == Fraction(5000, 4043)
    assert analysis.price_of_stability == Fraction(5000, 4043)


def test_selected_nonequilibrium_has_profitable_deviation() -> None:
    game = BraessGame(Scenario.OPEN)
    assert game.exploitability((50, 50, 0)) > 0
