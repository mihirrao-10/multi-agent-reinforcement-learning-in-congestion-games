import { describe, expect, it } from "vitest";

import { particleEdgeAllocation } from "../src/scene/agent-particles";
import { edgeColorHex, edgeRadius } from "../src/scene/materials";

describe("honest edge encodings", () => {
  it("maps load monotonically through square-root radius", () => {
    const radii = [0, 10, 20, 40, 80].map((load) => edgeRadius(load));
    expect(radii).toEqual([...radii].sort((left, right) => left - right));
    expect(edgeRadius(80) ** 2).toBeGreaterThan(edgeRadius(20) ** 2);
  });

  it("keeps the zero-cost shortcut pale at maximum load", () => {
    expect(edgeColorHex("shortcut", 80)).toBe("#ffd38a");
    expect(edgeColorHex("variable", 80)).toBe("#ff3030");
  });

  it("allocates particle density to every edge used by each route", () => {
    const allocation = particleEdgeAllocation([0, 1, 2, 2]);
    expect(allocation).toEqual({ SU: 3, UT: 1, SV: 1, VT: 3, UV: 2 });
  });
});
