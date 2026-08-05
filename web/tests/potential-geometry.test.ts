import { describe, expect, it } from "vitest";

import { loadFixture } from "./fixtures";

describe("potential landscape topology", () => {
  it("contains the exact triangular lattice and triangle count", () => {
    const landscape = loadFixture().potentialLandscape;
    expect(landscape.vertices).toHaveLength(3321);
    expect(landscape.triangles).toHaveLength(6400);
    for (const triangle of landscape.triangles) {
      expect(new Set(triangle).size).toBe(3);
      expect(Math.max(...triangle)).toBeLessThan(3321);
    }
  });

  it("points exact markers to the canonical states", () => {
    const landscape = loadFixture().potentialLandscape;
    expect(
      landscape.vertices[landscape.equilibriumVertexIndex]!.routeCounts,
    ).toEqual([0, 0, 80]);
    expect(
      landscape.vertices[landscape.optimumVertexIndex]!.routeCounts,
    ).toEqual([35, 35, 10]);
  });
});
