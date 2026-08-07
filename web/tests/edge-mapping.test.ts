import { describe, expect, it } from "vitest";

import {
  EDGE_RADIUS_MAX,
  EDGE_RADIUS_MIN,
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
    expect(EDGE_RADIUS_MAX).toBeGreaterThanOrEqual(0.038);
    expect(EDGE_RADIUS_MAX).toBeLessThanOrEqual(0.04);
    expect(EDGE_RADIUS_MAX / 0.026).toBeCloseTo(1.5, 1);
    const linearQuarter =
      EDGE_RADIUS_MIN + (EDGE_RADIUS_MAX - EDGE_RADIUS_MIN) * 0.25;
    expect(Math.abs(edgeRadius(25, 100) - linearQuarter)).toBeGreaterThan(
      0.003,
    );
  });

  it("maps every edge role from green to red by load alone", () => {
    for (const role of ["variable", "constant", "shortcut"] as const) {
      expect(edgeColorHex(role, 0, 100)).toBe("#2cd67b");
      expect(edgeColorHex(role, 100, 100)).toBe("#ff3030");
    }
    expect(edgeOpacity("variable", 100, 100)).toBeGreaterThan(
      edgeOpacity("variable", 10, 100),
    );
    expect(edgeFlowSpeed("variable", 100, 100)).toBe(
      edgeFlowSpeed("variable", 10, 100),
    );
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
