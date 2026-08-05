"""Independent deterministic NumPy random streams."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class RandomStreams:
    """Named generators whose draws remain isolated from unrelated changes."""

    exploration: np.random.Generator
    tie_breaking: np.random.Generator
    scenario: np.random.Generator
    aggregate: np.random.Generator
    playback: np.random.Generator
    evaluation: np.random.Generator


STREAM_NAMES = (
    "action-exploration",
    "tie-breaking",
    "scenario-initialization",
    "aggregate-selection",
    "representative-playback",
    "greedy-evaluation",
)


def make_streams(seed: int) -> RandomStreams:
    """Create PCG64 generators from explicitly spawned SeedSequence children."""

    children = np.random.SeedSequence(seed).spawn(len(STREAM_NAMES))
    generators = [np.random.Generator(np.random.PCG64(child)) for child in children]
    return RandomStreams(*generators)


def derive_seeds(base_seed: int, count: int, namespace: int = 0) -> tuple[int, ...]:
    """Derive stable JavaScript-safe uint32 run seeds for one namespace."""

    if count < 1 or namespace < 0:
        raise ValueError("count must be positive and namespace nonnegative")
    root = np.random.SeedSequence([base_seed, namespace])
    return tuple(int(child.generate_state(1, dtype=np.uint32)[0]) for child in root.spawn(count))


def seed_policy() -> dict[str, object]:
    return {
        "baseSeed": 20260804,
        "seedDerivation": "NumPy SeedSequence namespaces and spawned uint32 child seeds",
        "bitGenerator": "PCG64",
        "streamNames": list(STREAM_NAMES),
    }
