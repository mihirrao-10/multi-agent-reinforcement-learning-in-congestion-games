import { describe, expect, it } from "vitest";

import { arrowDirectionIsDescending } from "../src/scene/potential-landscape";
import { loadFixture } from "./fixtures";

describe("potential landscape topology", () => {
  it("contains the exact triangular lattice and triangle count", () => {
    const landscape = loadFixture().potentialLandscape;
    expect(landscape.vertices).toHaveLength(5151);
    expect(landscape.triangles).toHaveLength(10000);
    for (const triangle of landscape.triangles) {
      expect(new Set(triangle).size).toBe(3);
      expect(Math.max(...triangle)).toBeLessThan(5151);
    }
  });

  it("points exact markers to the canonical states", () => {
    const landscape = loadFixture().potentialLandscape;
    expect(
      landscape.markers.equilibria.map((marker) => marker.routeCounts),
    ).toEqual([[0, 0, 100]]);
    expect(
      landscape.markers.optima.map((marker) => marker.routeCounts),
    ).toEqual([[44, 44, 12]]);
  });

  it("orients displayed strict-improvement arrows downhill", () => {
    const points =
      loadFixture().potentialLandscape.trajectories[
        "braess-open-best-response"
      ]!;
    expect(arrowDirectionIsDescending(points)).toBe(true);
    expect(points.at(-1)?.routeCounts).toEqual([0, 0, 100]);
  });

  it("keeps exact markers separate from sampled large surfaces", () => {
    const landscape = loadFixture(10_000).potentialLandscape;
    expect(landscape.sampling.mode).toBe("deterministic-barycentric-sample");
    expect(landscape.vertices).toHaveLength(2145);
    expect(landscape.sampling.fullCountStateCount).toBe(50_015_001);
    expect(landscape.markers.equilibria[0]?.routeCounts).toEqual([
      0, 0, 10_000,
    ]);
  });
});
