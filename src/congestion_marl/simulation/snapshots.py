"""Deliberate exact-episode sampling for compact public playback."""

from __future__ import annotations

import numpy as np


def snapshot_episode_indices(episodes: int, population: int = 100) -> tuple[int, ...]:
    """Return deterministic adaptively thinned measured-episode checkpoints."""

    if episodes <= 0 or population <= 0:
        raise ValueError("episodes and population must be positive")
    if episodes <= 180:
        return tuple(range(1, episodes + 1))
    if population <= 100:
        early_count, regular_count = 52, 160
    elif population <= 1_000:
        early_count, regular_count = 34, 86
    else:
        early_count, regular_count = 24, 62
    dense_end = min(31 if population <= 100 else 16, episodes)
    dense = set(range(1, dense_end + 1))
    early = {
        int(value)
        for value in np.geomspace(
            dense_end + 1,
            min(1000, episodes),
            num=early_count,
            dtype=np.float64,
        )
    }
    middle_start = min(1001, episodes)
    regular = {
        int(value)
        for value in np.linspace(middle_start, episodes, num=regular_count, dtype=np.float64)
    }
    result = tuple(sorted(dense | early | regular | {1, episodes}))
    if result[0] != 1 or result[-1] != episodes:
        raise AssertionError("snapshot schedule lost its measured endpoints")
    return result
