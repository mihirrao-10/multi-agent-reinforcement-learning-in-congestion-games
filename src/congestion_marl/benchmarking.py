"""Honest warmup-based implementation benchmarks."""

from __future__ import annotations

import platform
import time
from collections.abc import Callable
from datetime import UTC, datetime
from statistics import mean

import numpy as np

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.config import ExperimentConfig, HedgeConfig, QLearningConfig
from congestion_marl.export.story import build_story
from congestion_marl.export.validation import validate_story
from congestion_marl.games.braess import BraessGame
from congestion_marl.learners.hedge import run_hedge
from congestion_marl.learners.independent_q import run_independent_q
from congestion_marl.types import Scenario


def _measure(operation: Callable[[], object], repeats: int = 3) -> dict[str, float | int]:
    operation()
    samples: list[float] = []
    for _ in range(repeats):
        start = time.perf_counter()
        operation()
        samples.append(time.perf_counter() - start)
    return {
        "warmups": 1,
        "repeats": repeats,
        "minimumSeconds": min(samples),
        "meanSeconds": mean(samples),
    }


def benchmark_suite() -> dict[str, object]:
    """Measure exact analysis, learners, export assembly, and validation."""

    game = BraessGame(Scenario.OPEN)
    q_config = QLearningConfig(episodes=500)
    hedge_config = HedgeConfig(episodes=500)
    quick_story_config = ExperimentConfig(
        seeds=2,
        best_response_seeds=2,
        q_learning=QLearningConfig(episodes=200),
        hedge=HedgeConfig(episodes=200),
    )
    quick_story = build_story(quick_story_config)
    return {
        "status": "measured",
        "generatedAtUtc": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "environment": {
            "platform": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor() or "not reported by platform module",
            "python": platform.python_version(),
            "numpy": np.__version__,
        },
        "methodology": "time.perf_counter, one warmup, three measured repetitions",
        "measurements": {
            "openCountStateEnumerationAndExactAnalysis": _measure(
                lambda: analyze_scenario(Scenario.OPEN)
            ),
            "qLearning500EpisodesOneSeed": _measure(
                lambda: run_independent_q(game, q_config, 20260804)
            ),
            "hedge500EpisodesOneSeed": _measure(lambda: run_hedge(game, hedge_config, 20260804)),
            "quickExportAssemblyTwoSeedsTwoHundredEpisodes": _measure(
                lambda: build_story(quick_story_config), repeats=2
            ),
            "quickStoryValidation": _measure(lambda: validate_story(quick_story)),
        },
        "scope": "implementation profiling on the recorded machine, not a real-time claim",
    }
