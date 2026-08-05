"""Profile distances and finite-value checks."""

from __future__ import annotations

from collections.abc import Iterable, Sequence

import numpy as np


def normalized_count_distance(left: Sequence[int], right: Sequence[int], population: int) -> float:
    """Return L1 route-count distance divided by twice the population."""

    if population <= 0 or len(left) != len(right):
        raise ValueError("profiles need equal dimensions and a positive population")
    return sum(abs(a - b) for a, b in zip(left, right, strict=True)) / (2 * population)


def require_finite(values: Iterable[float], label: str) -> None:
    array = np.asarray(tuple(values), dtype=np.float64)
    if not np.all(np.isfinite(array)):
        raise ValueError(f"{label} contains NaN or infinity")
