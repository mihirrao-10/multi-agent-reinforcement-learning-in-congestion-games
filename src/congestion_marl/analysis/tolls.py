"""Discrete marginal-cost toll identities."""

from fractions import Fraction

from congestion_marl.config import POPULATION
from congestion_marl.games.costs import marginal_externality_toll, variable_latency


def marginal_term(load: int, population: int = POPULATION) -> Fraction:
    """Return c(x) + tau(x), the discrete social-cost increment."""

    return variable_latency(load, population) + marginal_externality_toll(load, population)


def telescoped_variable_social_cost(load: int, population: int = POPULATION) -> Fraction:
    """Sum perceived marginal terms through a load and recover x c(x)."""

    if load < 0:
        raise ValueError("load cannot be negative")
    return sum((marginal_term(unit, population) for unit in range(1, load + 1)), Fraction(0))
