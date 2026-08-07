from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import Scenario


def test_open_complete_weak_equilibrium_set_and_efficiency_ratios() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    game = BraessGame(Scenario.OPEN)
    assert analysis.equilibria == (
        (0, 0, 100),
        (0, 1, 99),
        (1, 0, 99),
        (1, 1, 98),
    )
    assert analysis.equilibrium_social_costs == (
        Fraction(12_000),
        Fraction(59_703, 5),
        Fraction(59_703, 5),
        Fraction(59_406, 5),
    )
    assert game.rosenthal_potential((0, 0, 100)) == 6060
    assert game.exploitability((0, 0, 100)) == 0
    assert analysis.price_of_anarchy == Fraction(4, 3)
    assert analysis.price_of_stability == Fraction(9901, 7500)


def test_selected_nonequilibrium_has_profitable_deviation() -> None:
    game = BraessGame(Scenario.OPEN)
    assert game.exploitability((50, 50, 0)) > 0
