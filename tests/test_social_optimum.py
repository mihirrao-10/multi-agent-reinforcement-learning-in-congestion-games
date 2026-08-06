from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.types import Scenario


def test_open_unique_social_optimum() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    assert analysis.social_optima == ((44, 44, 12),)
    assert analysis.optimum_social_cost == Fraction(32344, 5)
    assert analysis.optimum_social_cost / 100 == Fraction(8086, 125)


def test_closed_equilibrium_is_the_unique_optimum() -> None:
    analysis = analyze_scenario(Scenario.CLOSED)
    assert analysis.equilibria == analysis.social_optima == ((50, 50),)
    assert analysis.optimum_social_cost == 6500
    assert analysis.optimum_social_cost / 100 == 65
