from fractions import Fraction

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.types import Scenario


def test_open_unique_social_optimum() -> None:
    analysis = analyze_scenario(Scenario.OPEN)
    assert analysis.social_optima == ((35, 35, 10),)
    assert analysis.optimum_social_cost == 5175
    assert analysis.optimum_social_cost / 80 == Fraction(1035, 16)


def test_closed_equilibrium_is_the_unique_optimum() -> None:
    analysis = analyze_scenario(Scenario.CLOSED)
    assert analysis.equilibria == analysis.social_optima == ((40, 40),)
    assert analysis.optimum_social_cost == 5200
    assert analysis.optimum_social_cost / 80 == 65
