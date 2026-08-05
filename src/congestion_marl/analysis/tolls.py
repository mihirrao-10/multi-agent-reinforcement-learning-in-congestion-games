"""Discrete marginal-cost toll identities."""

from fractions import Fraction

from congestion_marl.games.costs import marginal_externality_toll, variable_latency


def marginal_term(load: int) -> Fraction:
    """Return c(x) + tau(x), the discrete social-cost increment."""

    return variable_latency(load) + marginal_externality_toll(load)


def telescoped_variable_social_cost(load: int) -> Fraction:
    """Sum perceived marginal terms through a load and recover x c(x)."""

    if load < 0:
        raise ValueError("load cannot be negative")
    return sum((marginal_term(unit) for unit in range(1, load + 1)), Fraction(0))
