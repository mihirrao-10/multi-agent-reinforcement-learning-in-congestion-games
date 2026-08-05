"""Equilibrium and exploitability helpers."""

from fractions import Fraction

from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState


def cost_exploitability(game: BraessGame, counts: CountState) -> Fraction:
    """Return the largest available one-agent perceived-cost reduction."""

    return game.exploitability(counts)


def is_pure_nash(game: BraessGame, counts: CountState) -> bool:
    return cost_exploitability(game, counts) == 0
