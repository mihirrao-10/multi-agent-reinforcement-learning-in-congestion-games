import { describe, expect, it } from "vitest";

import { exactSnapshotAtIndex } from "../src/data/validation";
import { interpolateLandscapeHeight } from "../src/scene/potential-landscape";
import { loadFixture } from "./fixtures";

describe("snapshot and display interpolation boundaries", () => {
  it("always returns an exact exported textual snapshot", () => {
    const snapshots =
      loadFixture().experiments.scenarios["braess-open"].qLearning
        .representative.snapshots;
    expect(exactSnapshotAtIndex(snapshots, -100)).toBe(snapshots[0]);
    expect(exactSnapshotAtIndex(snapshots, 4.49)).toBe(snapshots[4]);
    expect(exactSnapshotAtIndex(snapshots, 4.51)).toBe(snapshots[5]);
    expect(exactSnapshotAtIndex(snapshots, 99999)).toBe(snapshots.at(-1));
  });

  it("morphs only display height between authoritative fields", () => {
    expect(interpolateLandscapeHeight(0.2, 0.8, 0)).toBeCloseTo(0.2);
    expect(interpolateLandscapeHeight(0.2, 0.8, 0.5)).toBeCloseTo(0.5);
    expect(interpolateLandscapeHeight(0.2, 0.8, 1)).toBeCloseTo(0.8);
  });
});
