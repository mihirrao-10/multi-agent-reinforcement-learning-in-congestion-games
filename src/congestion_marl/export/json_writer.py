"""Stable compact JSON output."""

from __future__ import annotations

import json
import math
from pathlib import Path

CANONICAL_FLOAT_DECIMALS = 12


def _canonicalize_floats(value: object) -> object:
    """Remove platform-scale floating noise before JSON serialization."""

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("canonical JSON contains a non-finite float")
        rounded = round(value, CANONICAL_FLOAT_DECIMALS)
        return 0.0 if rounded == 0.0 else rounded
    if isinstance(value, dict):
        return {key: _canonicalize_floats(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_canonicalize_floats(item) for item in value]
    return value


def deterministic_json_bytes(payload: object) -> bytes:
    """Return finite, UTF-8, byte-stable JSON with a final newline."""

    return (
        json.dumps(
            _canonicalize_floats(payload),
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def write_deterministic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(deterministic_json_bytes(payload))
