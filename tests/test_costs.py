from fractions import Fraction

import pytest

from congestion_marl.games.costs import (
    constant_latency,
    marginal_externality_toll,
    perceived_variable_cost,
    variable_latency,
    zero_latency,
)


def test_edge_latency_functions_and_tolls() -> None:
    assert variable_latency(0) == 0
    assert variable_latency(100) == 60
    assert variable_latency(80, 80) == 60
    assert [variable_latency(load) for load in range(5)] == sorted(
        variable_latency(load) for load in range(5)
    )
    assert constant_latency(0) == constant_latency(100) == 60
    assert zero_latency(100) == 0
    assert marginal_externality_toll(0) == 0
    assert marginal_externality_toll(100) == Fraction(297, 5)
    assert perceived_variable_cost(45) == Fraction(267, 5)


@pytest.mark.parametrize(
    "function", [variable_latency, constant_latency, zero_latency, marginal_externality_toll]
)
def test_negative_edge_load_is_rejected(function: object) -> None:
    with pytest.raises(ValueError):
        function(-1)  # type: ignore[operator]
