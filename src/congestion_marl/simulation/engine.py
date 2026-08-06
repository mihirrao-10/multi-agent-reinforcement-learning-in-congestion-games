"""Shared labeled-profile calculations for repeated learning."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from congestion_marl.analysis.diagnostics import normalized_count_distance
from congestion_marl.games.braess import BraessGame
from congestion_marl.types import CountState, Route

type FloatArray = NDArray[np.float64]
type IntArray = NDArray[np.int64]


def counts_from_action_indices(actions: IntArray, route_count: int) -> CountState:
    if actions.ndim != 1 or np.any(actions < 0) or np.any(actions >= route_count):
        raise ValueError("actions must be a valid one-dimensional route-index array")
    return tuple(int(value) for value in np.bincount(actions, minlength=route_count))


def counterfactual_cost_matrix(game: BraessGame, counts: CountState) -> FloatArray:
    """Return candidate perceived costs indexed by realized and candidate route."""

    size = len(game.routes)
    result = np.empty((size, size), dtype=np.float64)
    for origin_index, origin in enumerate(game.routes):
        if counts[origin_index] == 0:
            result[origin_index, :] = np.nan
            continue
        for candidate_index, candidate in enumerate(game.routes):
            result[origin_index, candidate_index] = float(
                game.counterfactual_cost(counts, origin, candidate)
            )
    return result


def mean_policy_entropy(probabilities: FloatArray) -> float:
    if probabilities.ndim != 2 or np.any(probabilities < 0):
        raise ValueError("policies must be a nonnegative matrix")
    safe = np.where(probabilities > 0, probabilities, 1.0)
    return float(np.mean(-np.sum(probabilities * np.log(safe), axis=1)))


@dataclass(frozen=True, slots=True)
class Snapshot:
    """One exact exported repeated-game episode."""

    episode: int
    epsilon: float
    route_counts: CountState
    edge_loads: dict[str, int]
    edge_physical_latencies: dict[str, float]
    route_physical_costs: tuple[float, ...]
    route_perceived_costs: tuple[float, ...]
    physical_social_cost: float
    average_physical_latency: float
    total_toll_payment: float
    rosenthal_potential: float
    perceived_potential: float
    exploitability: float
    regret_mean_average: float
    regret_maximum_average: float
    policy_entropy: float

    def to_dict(self) -> dict[str, object]:
        return {
            "episode": self.episode,
            "epsilon": self.epsilon,
            "routeCounts": list(self.route_counts),
            "edgeLoads": self.edge_loads,
            "edgePhysicalLatencies": self.edge_physical_latencies,
            "routePhysicalCosts": list(self.route_physical_costs),
            "routePerceivedCosts": list(self.route_perceived_costs),
            "physicalSocialCost": self.physical_social_cost,
            "averagePhysicalLatency": self.average_physical_latency,
            "totalTollPayment": self.total_toll_payment,
            "rosenthalPotential": self.rosenthal_potential,
            "perceivedPotential": self.perceived_potential,
            "exploitability": self.exploitability,
            "regret": {
                "meanAverage": self.regret_mean_average,
                "maximumAverage": self.regret_maximum_average,
            },
            "policyEntropy": self.policy_entropy,
        }


def make_snapshot(
    game: BraessGame,
    episode: int,
    epsilon: float,
    actions: IntArray,
    cumulative_realized: FloatArray,
    cumulative_counterfactual: FloatArray,
    policy_entropy: float,
) -> Snapshot:
    counts = counts_from_action_indices(actions, len(game.routes))
    physical = game.route_physical_costs(counts)
    perceived = game.route_perceived_costs(counts)
    edge_latency = game.edge_physical_latencies(counts)
    regrets = cumulative_realized - np.min(cumulative_counterfactual, axis=1)
    denominator = max(episode, 1)
    social_cost = game.social_cost(counts)
    return Snapshot(
        episode=episode,
        epsilon=epsilon,
        route_counts=counts,
        edge_loads=game.edge_loads(counts),
        edge_physical_latencies={key: float(value) for key, value in edge_latency.items()},
        route_physical_costs=tuple(float(physical[route]) for route in game.routes),
        route_perceived_costs=tuple(float(perceived[route]) for route in game.routes),
        physical_social_cost=float(social_cost),
        average_physical_latency=float(social_cost / game.population),
        total_toll_payment=float(game.total_toll_payment(counts)),
        rosenthal_potential=float(game.rosenthal_potential(counts)),
        perceived_potential=float(game.perceived_potential(counts)),
        exploitability=float(game.exploitability(counts)),
        regret_mean_average=float(np.mean(regrets / denominator)),
        regret_maximum_average=float(np.max(regrets / denominator)),
        policy_entropy=policy_entropy,
    )


type StateValue = list[list[float]] | list[list[int]] | list[float] | float | str


@dataclass(frozen=True, slots=True)
class LearningRun:
    """A deterministic labeled multi-agent run and its separate final evaluation."""

    learner: str
    game: BraessGame
    seed: int
    episodes: int
    training_final_counts: CountState
    final_greedy_actions: tuple[int, ...]
    final_greedy_counts: CountState
    final_exploitability: float
    final_physical_social_cost: float
    regret_by_agent: tuple[float, ...]
    state: dict[str, StateValue]
    snapshots: tuple[Snapshot, ...] = field(default_factory=tuple)

    def summary(self, equilibrium: CountState, optimum: CountState) -> dict[str, object]:
        average_regrets = np.asarray(self.regret_by_agent, dtype=np.float64) / max(self.episodes, 1)
        return {
            "seed": self.seed,
            "trainingFinalRouteCounts": list(self.training_final_counts),
            "finalGreedyRouteCounts": list(self.final_greedy_counts),
            "physicalSocialCost": self.final_physical_social_cost,
            "averagePhysicalLatency": self.final_physical_social_cost / self.game.population,
            "exploitability": self.final_exploitability,
            "distanceFromExactEquilibrium": normalized_count_distance(
                self.final_greedy_counts, equilibrium, self.game.population
            ),
            "distanceFromSocialOptimum": normalized_count_distance(
                self.final_greedy_counts, optimum, self.game.population
            ),
            "meanAverageExternalRegret": float(np.mean(average_regrets)),
            "maximumAverageExternalRegret": float(np.max(average_regrets)),
        }


def routes_to_indices(routes: tuple[Route, ...], assignments: tuple[Route, ...]) -> IntArray:
    mapping = {route: index for index, route in enumerate(routes)}
    return np.asarray([mapping[route] for route in assignments], dtype=np.int64)
