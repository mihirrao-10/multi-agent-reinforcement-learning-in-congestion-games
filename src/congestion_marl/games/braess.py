"""Exact population-normalized atomic Braess congestion game."""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from congestion_marl.config import POPULATION
from congestion_marl.games.costs import marginal_externality_toll, variable_latency
from congestion_marl.games.routing import available_routes, validate_counts
from congestion_marl.types import CountState, Route, Scenario


@dataclass(frozen=True, slots=True)
class BraessGame:
    """A symmetric atomic routing game evaluated through exact route counts."""

    scenario: Scenario
    population: int = POPULATION

    @property
    def routes(self) -> tuple[Route, ...]:
        return available_routes(self.scenario)

    @property
    def tolled(self) -> bool:
        return self.scenario is Scenario.TOLLED

    def validate_counts(self, counts: CountState) -> CountState:
        return validate_counts(counts, self.scenario, self.population)

    def expanded_counts(self, counts: CountState) -> tuple[int, int, int]:
        canonical = self.validate_counts(counts)
        if self.scenario is Scenario.CLOSED:
            return canonical[0], canonical[1], 0
        return canonical[0], canonical[1], canonical[2]

    def edge_loads(self, counts: CountState) -> dict[str, int]:
        x_upper, x_lower, x_shortcut = self.expanded_counts(counts)
        return {
            "SU": x_upper + x_shortcut,
            "UT": x_upper,
            "SV": x_lower,
            "VT": x_lower + x_shortcut,
            "UV": x_shortcut,
        }

    def edge_physical_latencies(self, counts: CountState) -> dict[str, Fraction]:
        loads = self.edge_loads(counts)
        return {
            "SU": variable_latency(loads["SU"], self.population),
            "UT": Fraction(45),
            "SV": Fraction(45),
            "VT": variable_latency(loads["VT"], self.population),
            "UV": Fraction(0),
        }

    def edge_tolls(self, counts: CountState) -> dict[str, Fraction]:
        loads = self.edge_loads(counts)
        if not self.tolled:
            return {edge: Fraction(0) for edge in loads}
        return {
            "SU": marginal_externality_toll(loads["SU"], self.population),
            "UT": Fraction(0),
            "SV": Fraction(0),
            "VT": marginal_externality_toll(loads["VT"], self.population),
            "UV": Fraction(0),
        }

    def route_physical_costs(self, counts: CountState) -> dict[Route, Fraction]:
        edge = self.edge_physical_latencies(counts)
        costs = {
            Route.UPPER: edge["SU"] + edge["UT"],
            Route.LOWER: edge["SV"] + edge["VT"],
            Route.SHORTCUT: edge["SU"] + edge["UV"] + edge["VT"],
        }
        return {route: costs[route] for route in self.routes}

    def route_tolls(self, counts: CountState) -> dict[Route, Fraction]:
        edge = self.edge_tolls(counts)
        tolls = {
            Route.UPPER: edge["SU"] + edge["UT"],
            Route.LOWER: edge["SV"] + edge["VT"],
            Route.SHORTCUT: edge["SU"] + edge["UV"] + edge["VT"],
        }
        return {route: tolls[route] for route in self.routes}

    def route_perceived_costs(self, counts: CountState) -> dict[Route, Fraction]:
        physical = self.route_physical_costs(counts)
        tolls = self.route_tolls(counts)
        return {route: physical[route] + tolls[route] for route in self.routes}

    def counterfactual_counts(
        self, counts: CountState, origin: Route, candidate: Route
    ) -> CountState:
        canonical = self.validate_counts(counts)
        routes = self.routes
        if origin not in routes or candidate not in routes:
            raise ValueError("unavailable deviation route")
        origin_index = routes.index(origin)
        candidate_index = routes.index(candidate)
        if canonical[origin_index] <= 0:
            raise ValueError("cannot deviate from an unused route")
        changed = list(canonical)
        changed[origin_index] -= 1
        changed[candidate_index] += 1
        return tuple(changed)

    def counterfactual_cost(
        self,
        counts: CountState,
        origin: Route,
        candidate: Route,
        *,
        perceived: bool | None = None,
    ) -> Fraction:
        """Evaluate a unilateral move by removing, adding, then pricing the candidate."""

        use_perceived = self.tolled if perceived is None else perceived
        changed = self.counterfactual_counts(counts, origin, candidate)
        costs = (
            self.route_perceived_costs(changed)
            if use_perceived
            else self.route_physical_costs(changed)
        )
        return costs[candidate]

    def social_cost(self, counts: CountState) -> Fraction:
        loads = self.edge_loads(counts)
        return (
            Fraction(40 * loads["SU"] * loads["SU"], self.population)
            + Fraction(40 * loads["VT"] * loads["VT"], self.population)
            + Fraction(45 * (loads["UT"] + loads["SV"]))
        )

    def total_toll_payment(self, counts: CountState) -> Fraction:
        loads = self.edge_loads(counts)
        tolls = self.edge_tolls(counts)
        return sum((Fraction(loads[edge]) * toll for edge, toll in tolls.items()), Fraction(0))

    def rosenthal_potential(self, counts: CountState) -> Fraction:
        loads = self.edge_loads(counts)
        return (
            Fraction(20 * loads["SU"] * (loads["SU"] + 1), self.population)
            + Fraction(20 * loads["VT"] * (loads["VT"] + 1), self.population)
            + Fraction(45 * (loads["UT"] + loads["SV"]))
        )

    def perceived_potential(self, counts: CountState) -> Fraction:
        return self.social_cost(counts) if self.tolled else self.rosenthal_potential(counts)

    def exploitability(self, counts: CountState) -> Fraction:
        canonical = self.validate_counts(counts)
        current_costs = (
            self.route_perceived_costs(canonical)
            if self.tolled
            else self.route_physical_costs(canonical)
        )
        best_gain = Fraction(0)
        for route, count in zip(self.routes, canonical, strict=True):
            if count == 0:
                continue
            best_candidate = min(
                self.counterfactual_cost(canonical, route, candidate) for candidate in self.routes
            )
            best_gain = max(best_gain, current_costs[route] - best_candidate)
        return best_gain

    def is_pure_nash(self, counts: CountState) -> bool:
        return self.exploitability(counts) == 0
