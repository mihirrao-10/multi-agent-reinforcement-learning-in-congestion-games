"""Rosenthal-potential utilities."""

from fractions import Fraction

from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState


def rosenthal_potential(game: BraessGame, counts: CountState) -> Fraction:
    return game.rosenthal_potential(counts)


def perceived_potential(game: BraessGame, counts: CountState) -> Fraction:
    return game.perceived_potential(counts)
