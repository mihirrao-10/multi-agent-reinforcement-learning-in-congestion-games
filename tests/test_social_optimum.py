from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.types import Scenario


def test_open_unique_social_optimum() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    assert analysis.social_optima == ((50, 50, 0),)
    assert analysis.optimum_social_cost == Fraction(9000)
    assert analysis.optimum_social_cost / 100 == Fraction(90)


def test_closed_equilibrium_is_the_unique_optimum() -> None:
    analysis = analyze_scenario(Scenario.CLOSED)
    assert analysis.equilibria == analysis.social_optima == ((50, 50),)
    assert analysis.optimum_social_cost == 9000
    assert analysis.optimum_social_cost / 100 == 90
