import { describe, expect, it } from "vitest";

import {
  PotentialLandscape,
  arrowDirectionIsDescending,
} from "../src/scene/potential-landscape";
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
    ).toEqual([
      [0, 0, 100],
      [0, 1, 99],
      [1, 0, 99],
      [1, 1, 98],
    ]);
    expect(
      landscape.markers.optima.map((marker) => marker.routeCounts),
    ).toEqual([[50, 50, 0]]);
  });

  it("orients displayed strict-improvement arrows downhill", () => {
    const points =
      loadFixture().potentialLandscape.trajectories[
        "braess-open-best-response"
      ]!;
    expect(arrowDirectionIsDescending(points)).toBe(true);
    expect(points.at(-1)?.routeCounts).toEqual([1, 1, 98]);
  });

  it("reveals strict-improvement paths gradually and honors reduced motion", () => {
    const animated = new PotentialLandscape(loadFixture());
    animated.setTrajectory("braess-open-best-response", 64);
    expect(animated.trajectoryRevealProgress()).toBe(0);
    expect(animated.trajectoryRevealComplete()).toBe(false);
    animated.update(false, 0.45);
    expect(animated.trajectoryRevealProgress()).toBe(0);
    animated.update(false, 3.1);
    expect(animated.trajectoryRevealProgress()).toBeCloseTo(0.5, 5);
    animated.update(false, 3.1);
    expect(animated.trajectoryRevealProgress()).toBe(1);
    expect(animated.trajectoryRevealComplete()).toBe(true);
    animated.dispose();

    const reduced = new PotentialLandscape(loadFixture());
    reduced.setTrajectory("braess-open-best-response", 64);
    reduced.update(true, 0.016);
    expect(reduced.trajectoryRevealProgress()).toBe(1);
    expect(reduced.trajectoryRevealComplete()).toBe(true);
    reduced.dispose();
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
