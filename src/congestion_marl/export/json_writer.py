"""Stable compact JSON output."""

from __future__ import annotations

import json
from pathlib import Path


def deterministic_json_bytes(payload: object) -> bytes:
    """Return finite, UTF-8, byte-stable JSON with a final newline."""

    return (
        json.dumps(
            payload,
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
