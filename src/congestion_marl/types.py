"""Shared public identifiers and immutable result types."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from fractions import Fraction


class Route(StrEnum):
    """Complete route actions in the Braess network."""

    UPPER = "U"
    LOWER = "L"
    SHORTCUT = "Z"


class Scenario(StrEnum):
    """The three authored experimental scenarios."""

    OPEN = "braess-open"
    CLOSED = "braess-closed"
    TOLLED = "braess-tolled"


type CountState = tuple[int, ...]
type Assignment = tuple[Route, ...]


@dataclass(frozen=True, slots=True)
class ExactScenarioAnalysis:
    """Complete symmetry-reduced exact analysis for one scenario."""

    scenario: Scenario
    count_states: int
    equilibria: tuple[CountState, ...]
    social_optima: tuple[CountState, ...]
    equilibrium_social_costs: tuple[Fraction, ...]
    optimum_social_cost: Fraction
    price_of_anarchy: Fraction
    price_of_stability: Fraction
    potential_identity_checks: int
    tolled_potential_checks: int
