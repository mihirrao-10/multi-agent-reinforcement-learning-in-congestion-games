"""Physical-latency welfare utilities."""

from fractions import Fraction

from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState


def physical_social_cost(game: BraessGame, counts: CountState) -> Fraction:
    return game.social_cost(counts)


def average_physical_latency(game: BraessGame, counts: CountState) -> Fraction:
    return game.social_cost(counts) / game.population
