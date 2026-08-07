"""Honest warmup-based implementation benchmarks."""

from __future__ import annotations

import json
import platform
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean

import numpy as np

from congestion_marl.analysis.enumeration import analyze_scenario
from congestion_marl.config import (
    ExperimentConfig,
    HedgeConfig,
    QLearningConfig,
    experiment_config_for_population,
)
from congestion_marl.export.story import (
    build_population_bundle,
    build_potential_landscape,
    build_story,
)
from congestion_marl.export.validation import validate_export_directory, validate_story
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
        "maximumSeconds": max(samples),
    }


def benchmark_suite(bundle_directory: Path | None = None) -> dict[str, object]:
    """Measure population-aware analysis, learning, export, and bundle loading."""

    default_game = BraessGame(Scenario.OPEN)
    default_q_config = QLearningConfig(episodes=500)
    default_hedge_config = HedgeConfig(episodes=500)
    large_config = experiment_config_for_population(10_000)
    large_game = BraessGame(Scenario.OPEN, 10_000)
    quick_story_config = ExperimentConfig(
        seeds=2,
        best_response_seeds=2,
        q_learning=QLearningConfig(episodes=200),
        hedge=HedgeConfig(episodes=200),
    )
    quick_story = build_story(quick_story_config)
    data_directory = bundle_directory or Path("web/public/data")
    bundle_paths = (
        data_directory / "manifest-v3.json",
        *(
            data_directory / f"population-{population}-v3.json"
            for population in (100, 1_000, 10_000, 100_000)
        ),
    )

    def load_committed_bundles() -> tuple[object, ...]:
        return tuple(json.loads(path.read_bytes()) for path in bundle_paths)

    bundle_sizes = {path.name: path.stat().st_size for path in bundle_paths if path.is_file()}
    committed_bundle_measurements: dict[str, object]
    if len(bundle_sizes) == len(bundle_paths):
        committed_bundle_measurements = {
            "jsonParseAllManifestAndPopulationBundles": _measure(load_committed_bundles),
            "independentValidationAllPopulationBundles": _measure(
                lambda: validate_export_directory(data_directory), repeats=2
            ),
        }
    else:
        committed_bundle_measurements = {
            "status": "not measured; run from a repository containing the public bundles"
        }

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
        "methodology": (
            "time.perf_counter; one warmup before each operation; three measured "
            "repetitions except explicitly two-repetition export and validation paths"
        ),
        "measurements": {
            "exactOpenAnalysis100Agents": _measure(lambda: analyze_scenario(Scenario.OPEN, 100)),
            "exactOpenAnalysis1000Agents": _measure(lambda: analyze_scenario(Scenario.OPEN, 1_000)),
            "exactOpenAnalysis10000Agents": _measure(
                lambda: analyze_scenario(Scenario.OPEN, 10_000)
            ),
            "exactOpenAnalysis100000Agents": _measure(
                lambda: analyze_scenario(Scenario.OPEN, 100_000)
            ),
            "exactOpenAnalysis1000000Agents": _measure(
                lambda: analyze_scenario(Scenario.OPEN, 1_000_000)
            ),
            "qLearning100Agents500EpisodesOneSeed": _measure(
                lambda: run_independent_q(default_game, default_q_config, 20260804)
            ),
            "hedge100Agents500EpisodesOneSeed": _measure(
                lambda: run_hedge(default_game, default_hedge_config, 20260804)
            ),
            "qLearning10000AgentsCanonical2400Episodes": _measure(
                lambda: run_independent_q(large_game, large_config.q_learning, 1_880_576_208),
                repeats=2,
            ),
            "sampledLandscape10000Agents": _measure(lambda: build_potential_landscape(10_000)),
            "quick100AgentExportAssemblyTwoSeedsTwoHundredEpisodes": _measure(
                lambda: build_story(quick_story_config), repeats=2
            ),
            "canonical10000AgentBundleAssembly": _measure(
                lambda: build_population_bundle(10_000, large_config), repeats=2
            ),
            "quick100AgentStoryValidation": _measure(lambda: validate_story(quick_story)),
            "committedBundleLoading": committed_bundle_measurements,
        },
        "bundleSizesBytes": bundle_sizes,
        "scope": (
            "focused implementation profiling on the recorded machine, not a "
            "cross-device real-time claim; browser rendering is measured separately in Playwright"
        ),
    }
