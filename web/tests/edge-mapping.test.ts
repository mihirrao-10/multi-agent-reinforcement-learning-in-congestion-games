import { describe, expect, it } from "vitest";

import { edgeColorHex, edgeRadius } from "../src/scene/materials";

describe("honest edge encodings", () => {
  it("maps load monotonically through square-root radius", () => {
    const radii = [0, 10, 25, 50, 100].map((load) => edgeRadius(load, 100));
    expect(radii).toEqual([...radii].sort((left, right) => left - right));
    expect(edgeRadius(100, 100) ** 2).toBeGreaterThan(edgeRadius(25, 100) ** 2);
  });

  it("uses green for unused and zero-latency edges and warm colors for delay", () => {
    expect(edgeColorHex("shortcut", 100, 100)).toBe("#2cd67b");
    expect(edgeColorHex("variable", 0, 100)).toBe("#2cd67b");
    expect(edgeColorHex("variable", 100, 100)).toBe("#ff5c36");
    expect(edgeColorHex("constant", 100, 100)).toBe("#ff3030");
  });
});
