import { describe, expect, it } from "vitest";

import {
  EDGE_RADIUS_MAX,
  EDGE_RADIUS_MIN,
  EDGE_RADIUS_PACKED_WEIGHT,
  EDGE_RADIUS_QUADRATIC_WEIGHT,
  EDGE_RADIUS_SQRT_WEIGHT,
  NODE_VISUALS,
  REDUCED_MOTION_FLOW_TIME,
  edgeColorHex,
  edgeFlowSpeed,
  edgeOpacity,
  edgeRadius,
} from "../src/scene/materials";

describe("honest edge encodings", () => {
  it("maps traffic share monotonically through an audited nonlinear radius", () => {
    const radii = [0, 10, 25, 50, 100].map((load) => edgeRadius(load, 100));
    expect(radii).toEqual([...radii].sort((left, right) => left - right));
    expect(radii[0]).toBeCloseTo(EDGE_RADIUS_MIN);
    expect(radii.at(-1)).toBeCloseTo(EDGE_RADIUS_MAX);
    expect(EDGE_RADIUS_MIN).toBeGreaterThanOrEqual(0.0065);
    expect(EDGE_RADIUS_MIN).toBeLessThanOrEqual(0.0075);
    expect(EDGE_RADIUS_MIN).toBe(0.007);
    expect(EDGE_RADIUS_PACKED_WEIGHT).toBe(0.006);
    expect(EDGE_RADIUS_MAX).toBeGreaterThanOrEqual(0.044);
    expect(EDGE_RADIUS_MAX).toBeLessThanOrEqual(0.046);
    expect(EDGE_RADIUS_MAX / 0.026).toBeCloseTo(1.73, 1);
    const quarterSharePackedLift = EDGE_RADIUS_PACKED_WEIGHT * 0.25 ** 4;
    const quarterWithoutPacked =
      EDGE_RADIUS_MIN +
      EDGE_RADIUS_SQRT_WEIGHT * Math.sqrt(0.25) +
      EDGE_RADIUS_QUADRATIC_WEIGHT * 0.25 ** 2;
    expect(quarterSharePackedLift).toBeLessThan(0.00003);
    expect(edgeRadius(25, 100) - quarterWithoutPacked).toBeCloseTo(
      quarterSharePackedLift,
    );
    expect(EDGE_RADIUS_MAX - EDGE_RADIUS_PACKED_WEIGHT).toBeCloseTo(0.039);
  });

  it("maps every edge role from green to red by load alone", () => {
    for (const role of ["variable", "constant", "shortcut"] as const) {
      expect(edgeColorHex(role, 0, 100)).toBe("#2cd67b");
      expect(edgeColorHex(role, 100, 100)).toBe("#ff4747");
    }
    expect(edgeOpacity("variable", 100, 100)).toBeGreaterThan(
      edgeOpacity("variable", 10, 100),
    );
    expect(edgeFlowSpeed("variable", 100, 100)).toBe(
      edgeFlowSpeed("variable", 10, 100),
    );
    expect(edgeFlowSpeed("variable", 100, 100)).toBe(0.58);
  });

  it("keeps the four audited white-node and reduced-motion constants", () => {
    expect(NODE_VISUALS).toEqual({
      endpointCoreRadius: 0.148,
      junctionCoreRadius: 0.13,
      haloScale: 1.65,
      coreColor: "#ffffff",
      haloColor: "#ffffff",
    });
    expect(REDUCED_MOTION_FLOW_TIME).toBe(1.75);
  });
});
