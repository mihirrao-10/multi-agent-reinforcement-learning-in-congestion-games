"""Route-count and labeled-assignment helpers."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence

from congestion_marl.types import Assignment, CountState, Route, Scenario


def available_routes(scenario: Scenario) -> tuple[Route, ...]:
    """Return the complete actions available in a scenario."""

    if scenario is Scenario.CLOSED:
        return (Route.UPPER, Route.LOWER)
    return (Route.UPPER, Route.LOWER, Route.SHORTCUT)


def validate_counts(counts: Sequence[int], scenario: Scenario, population: int) -> CountState:
    """Validate and canonicalize a symmetric route-count state."""

    expected = len(available_routes(scenario))
    if len(counts) != expected:
        raise ValueError(f"scenario {scenario.value} requires {expected} route counts")
    if any(isinstance(value, bool) or not isinstance(value, int) for value in counts):
        raise ValueError("route counts must be integers")
    canonical = tuple(counts)
    if any(value < 0 for value in canonical):
        raise ValueError("route counts cannot be negative")
    if sum(canonical) != population:
        raise ValueError(f"route counts sum to {sum(canonical)}; expected {population}")
    return canonical


def counts_from_assignments(
    assignments: Sequence[Route], scenario: Scenario, population: int
) -> CountState:
    """Derive route counts from one labeled action per agent."""

    if len(assignments) != population:
        raise ValueError(f"expected {population} assignments")
    routes = available_routes(scenario)
    if any(route not in routes for route in assignments):
        raise ValueError("assignment uses a route unavailable in this scenario")
    counter = Counter(assignments)
    return tuple(counter[route] for route in routes)


def assignments_from_counts(counts: Sequence[int], scenario: Scenario) -> Assignment:
    """Return a deterministic labeled assignment realizing route counts."""

    routes = available_routes(scenario)
    return tuple(route for route, count in zip(routes, counts, strict=True) for _ in range(count))
