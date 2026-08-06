"""Immutable network and route specifications."""

from __future__ import annotations

from dataclasses import dataclass

from congestion_marl.types import Route


@dataclass(frozen=True, slots=True)
class Node:
    identifier: str
    label: str
    position: tuple[float, float, float]


@dataclass(frozen=True, slots=True)
class Edge:
    identifier: str
    source: str
    target: str
    latency_kind: str


NODES = (
    Node("S", "Source", (-1.65, 0.0, 0.0)),
    Node("U", "Upper", (0.0, 0.82, -0.24)),
    Node("V", "Lower", (0.0, -0.82, 0.24)),
    Node("T", "Destination", (1.65, 0.0, 0.0)),
)

EDGES = (
    Edge("SU", "S", "U", "40 load / N"),
    Edge("UT", "U", "T", "45"),
    Edge("SV", "S", "V", "45"),
    Edge("VT", "V", "T", "40 load / N"),
    Edge("UV", "U", "V", "0"),
)

ROUTE_EDGES: dict[Route, tuple[str, ...]] = {
    Route.UPPER: ("SU", "UT"),
    Route.LOWER: ("SV", "VT"),
    Route.SHORTCUT: ("SU", "UV", "VT"),
}
