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
    expect(deriveEdgeLoads([50, 50, 0], "braess-open")).toEqual({
      SU: 50,
      UT: 50,
      SV: 50,
      VT: 50,
      UV: 0,
    });
    expect(derivePhysicalRouteCosts([50, 50, 0], "braess-open")).toEqual([
      90, 90, 60,
    ]);
    expect(derivePhysicalSocialCost([50, 50, 0], "braess-open")).toBeCloseTo(
      9000,
    );
  });

  it("validates every browser-critical invariant", () => {
    for (const population of [100, 1_000, 10_000, 100_000] as const) {
      expect(() =>
        validateBundleConsistency(loadFixture(population)),
      ).not.toThrow();
    }
  });

  it("keeps full studies and sampled proxies honest at every scale", () => {
    for (const population of [100, 1_000, 10_000] as const) {
      const bundle = loadFixture(population);
      expect(bundle.learningStudy.learningStudyKind).toBe("full-population");
      expect(bundle.learningStudy.simulatedLearners).toBe(population);
      expect(
        bundle.learning.scenarios["braess-open"].routeShareScaling,
      ).toBeUndefined();
    }
    for (const population of [100_000] as const) {
      const bundle = loadFixture(population);
      const learner = bundle.learning.scenarios["braess-open"];
      expect(bundle.learningStudy.learningStudyKind).toBe(
        "sampled-population-proxy",
      );
      expect(bundle.learningStudy.simulatedLearners).toBe(10_000);
      expect(learner.representative.learnerState.qValueShape).toEqual([
        10_000, 3,
      ]);
      expect(learner.routeShareScaling).toMatchObject({
        representedPopulation: population,
        simulatedLearners: 10_000,
        costsRecomputedFromScaledIntegerCounts: true,
      });
      for (const snapshot of learner.representative.snapshots) {
        expect(
          snapshot.routeCounts.reduce((sum, count) => sum + count, 0),
        ).toBe(population);
      }
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
