import { describe, expect, it } from "vitest";

import {
  deriveEdgeLoads,
  derivePhysicalRouteCosts,
  derivePhysicalSocialCost,
  StoryConsistencyError,
  validateSnapshot,
  validateStoryConsistency,
} from "../src/data/validation";
import { loadFixture } from "./fixtures";

describe("numerical consistency", () => {
  it("rederives canonical loads, costs, and social cost", () => {
    expect(deriveEdgeLoads([35, 35, 10], "braess-open")).toEqual({
      SU: 45,
      UT: 35,
      SV: 35,
      VT: 45,
      UV: 10,
    });
    expect(derivePhysicalRouteCosts([35, 35, 10], "braess-open")).toEqual([
      67.5, 67.5, 45,
    ]);
    expect(derivePhysicalSocialCost([35, 35, 10], "braess-open")).toBe(5175);
  });

  it("validates every browser-critical invariant", () => {
    expect(() => validateStoryConsistency(loadFixture())).not.toThrow();
  });

  it("rejects an assignment and count disagreement", () => {
    const snapshot = structuredClone(
      loadFixture().experiments.scenarios["braess-open"].qLearning
        .representative.snapshots[0]!,
    );
    snapshot.assignments[0] = (snapshot.assignments[0]! + 1) % 3;
    expect(() => validateSnapshot(snapshot, "braess-open")).toThrow(
      StoryConsistencyError,
    );
  });
});
