"""Exact counterfactual external-regret accounting."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]


def cumulative_external_regret(
    realized_costs: FloatArray, counterfactual_costs: FloatArray
) -> FloatArray:
    """Return one raw cumulative cost regret per agent."""

    if realized_costs.ndim != 2:
        raise ValueError("realized costs must have shape (rounds, agents)")
    if counterfactual_costs.ndim != 3:
        raise ValueError("counterfactual costs must have shape (rounds, agents, routes)")
    if realized_costs.shape != counterfactual_costs.shape[:2]:
        raise ValueError("regret arrays have inconsistent round or agent axes")
    realized = np.sum(realized_costs, axis=0)
    fixed = np.min(np.sum(counterfactual_costs, axis=0), axis=1)
    result = realized - fixed
    if not np.all(np.isfinite(result)):
        raise ValueError("regret contains nonfinite values")
    return result


def regret_summary(regrets: FloatArray, rounds: int) -> dict[str, float | list[float]]:
    """Return raw cumulative and per-round regret summaries."""

    if regrets.ndim != 1 or rounds <= 0:
        raise ValueError("regrets must be one-dimensional and rounds positive")
    average = regrets / rounds
    return {
        "cumulativeByAgent": regrets.tolist(),
        "averageByAgent": average.tolist(),
        "meanAverage": float(np.mean(average)),
        "maximumAverage": float(np.max(average)),
        "minimumAverage": float(np.min(average)),
    }
