import { describe, expect, it } from "vitest";

import {
  deriveEdgeLoads,
  derivePhysicalRouteCosts,
  derivePhysicalSocialCost,
  StoryConsistencyError,
  validateBundleConsistency,
  validateSnapshot,
} from "../src/data/validation";
import { loadFixture } from "./fixtures";

describe("numerical consistency", () => {
  it("rederives canonical loads, costs, and social cost", () => {
    expect(deriveEdgeLoads([44, 44, 12], "braess-open")).toEqual({
      SU: 56,
      UT: 44,
      SV: 44,
      VT: 56,
      UV: 12,
    });
    expect(derivePhysicalRouteCosts([44, 44, 12], "braess-open")).toEqual([
      67.4, 67.4, 44.8,
    ]);
    expect(derivePhysicalSocialCost([44, 44, 12], "braess-open")).toBeCloseTo(
      6468.8,
    );
  });

  it("validates every browser-critical invariant", () => {
    for (const population of [100, 1_000, 10_000] as const) {
      expect(() =>
        validateBundleConsistency(loadFixture(population)),
      ).not.toThrow();
    }
  });

  it("rejects a count and load disagreement", () => {
    const snapshot = structuredClone(
      loadFixture().learning.scenarios["braess-open"].representative
        .snapshots[0]!,
    );
    snapshot.edgeLoads.SU = (snapshot.edgeLoads.SU ?? 0) + 1;
    expect(() => validateSnapshot(snapshot, "braess-open")).toThrow(
      StoryConsistencyError,
    );
  });
});
