"""Aggregate deterministic seed runs and predeclare representative medoids."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

import numpy as np

from congestion_marl.simulation.engine import LearningRun


def select_representative_run(runs: Sequence[LearningRun]) -> LearningRun:
    """Choose the final-count medoid, then exploitability, then smallest seed."""

    if not runs:
        raise ValueError("at least one run is required")
    dimensions = {len(run.final_greedy_counts) for run in runs}
    if len(dimensions) != 1:
        raise ValueError("representative candidates use inconsistent route dimensions")
    counts = np.asarray([run.final_greedy_counts for run in runs], dtype=np.int64)
    distance_sums = np.sum(np.abs(counts[:, None, :] - counts[None, :, :]), axis=(1, 2))
    minimum = int(np.min(distance_sums))
    candidates = [run for run, value in zip(runs, distance_sums, strict=True) if value == minimum]
    return min(candidates, key=lambda run: (run.final_exploitability, run.seed))


def aggregate_summaries(summaries: Sequence[dict[str, object]]) -> dict[str, object]:
    """Aggregate core final metrics with population standard deviations and standard errors."""

    if not summaries:
        raise ValueError("cannot aggregate an empty run list")
    keys = (
        "physicalSocialCost",
        "averagePhysicalLatency",
        "exploitability",
        "distanceFromExactEquilibrium",
        "distanceFromSocialOptimum",
        "meanAverageExternalRegret",
        "maximumAverageExternalRegret",
    )
    result: dict[str, object] = {"runs": len(summaries)}
    for key in keys:
        values = np.asarray([float(cast(float | int, summary[key])) for summary in summaries])
        result[key] = {
            "mean": float(np.mean(values)),
            "standardDeviation": float(np.std(values, ddof=0)),
            "standardError": float(np.std(values, ddof=0) / np.sqrt(len(values))),
            "minimum": float(np.min(values)),
            "maximum": float(np.max(values)),
        }
    return result
