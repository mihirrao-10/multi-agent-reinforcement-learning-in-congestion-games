"""Exact edge latency and discrete marginal-toll functions."""

from fractions import Fraction

from congestion_marl.config import POPULATION


def variable_latency(load: int, population: int = POPULATION) -> Fraction:
    """Return c_N(x) = 40x/N for a nonnegative integer edge load."""

    if load < 0 or population <= 0:
        raise ValueError("edge load must be nonnegative and population positive")
    return Fraction(40 * load, population)


def constant_latency(load: int) -> Fraction:
    """Return the authored constant edge latency."""

    if load < 0:
        raise ValueError("edge load cannot be negative")
    return Fraction(45)


def zero_latency(load: int) -> Fraction:
    """Return the shortcut latency."""

    if load < 0:
        raise ValueError("edge load cannot be negative")
    return Fraction(0)


def marginal_externality_toll(load: int, population: int = POPULATION) -> Fraction:
    """Return tau_N(x) = 40(x - 1)/N, with zero toll at zero load."""

    if load < 0 or population <= 0:
        raise ValueError("edge load must be nonnegative and population positive")
    return Fraction(40 * max(load - 1, 0), population)


def perceived_variable_cost(load: int, population: int = POPULATION) -> Fraction:
    """Return latency plus the discrete marginal-externality toll."""

    return variable_latency(load, population) + marginal_externality_toll(load, population)
