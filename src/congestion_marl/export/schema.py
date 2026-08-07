"""Population-aware public schema constants and exact-number serialization."""

from __future__ import annotations

from fractions import Fraction

SCHEMA_VERSION = "3.0.0"
MODEL_IDENTIFIER = "atomic-braess-60-minute-v3"
ROUTE_CODES = {"0": "U", "1": "L", "2": "Z"}


def exact_number(value: Fraction) -> dict[str, int | float | str]:
    """Serialize an exact rational alongside its display value."""

    return {
        "numerator": value.numerator,
        "denominator": value.denominator,
        "fraction": (
            str(value.numerator)
            if value.denominator == 1
            else f"{value.numerator}/{value.denominator}"
        ),
        "decimal": float(value),
    }
