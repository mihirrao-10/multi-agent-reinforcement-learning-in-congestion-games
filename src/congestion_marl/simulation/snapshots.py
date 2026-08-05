"""Deliberate exact-episode sampling for compact public playback."""

from __future__ import annotations

import numpy as np


def snapshot_episode_indices(episodes: int) -> tuple[int, ...]:
    """Return 180 to 300 dense, logarithmic, and regular checkpoints."""

    if episodes <= 300:
        return tuple(range(episodes + 1))
    dense = set(range(0, min(41, episodes + 1)))
    early = {
        int(value) for value in np.geomspace(41, min(1000, episodes), num=52, dtype=np.float64)
    }
    middle_start = min(1001, episodes)
    regular = {
        int(value) for value in np.linspace(middle_start, episodes, num=160, dtype=np.float64)
    }
    result = tuple(sorted(dense | early | regular | {0, episodes}))
    if not 180 <= len(result) <= 300:
        raise AssertionError(f"snapshot schedule has unexpected size {len(result)}")
    return result
