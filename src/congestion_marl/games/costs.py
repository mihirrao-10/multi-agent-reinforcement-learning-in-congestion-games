"""Exact edge latency and discrete marginal-toll functions."""

from fractions import Fraction


def variable_latency(load: int) -> Fraction:
    """Return c(x) = x / 2 for a nonnegative integer edge load."""

    if load < 0:
        raise ValueError("edge load cannot be negative")
    return Fraction(load, 2)


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


def marginal_externality_toll(load: int) -> Fraction:
    """Return tau(x) = (x - 1) / 2, with zero toll at zero load."""

    if load < 0:
        raise ValueError("edge load cannot be negative")
    return Fraction(max(load - 1, 0), 2)


def perceived_variable_cost(load: int) -> Fraction:
    """Return latency plus the discrete marginal-externality toll."""

    return variable_latency(load) + marginal_externality_toll(load)
