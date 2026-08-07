import { describe, expect, it } from "vitest";

import { populationBundleSchema } from "../src/data/story-schema";
import { loadFixture, loadManifestFixture } from "./fixtures";

describe("story schema", () => {
  it("accepts the complete committed authoritative bundle", () => {
    const manifest = loadManifestFixture();
    const story = loadFixture();
    expect(story.schemaVersion).toBe("3.0.0");
    expect(story.population).toBe(100);
    expect(manifest.populations.map((entry) => entry.agents)).toEqual([
      100, 1_000, 10_000, 100_000, 1_000_000,
    ]);
    expect(
      manifest.populations.map((entry) => entry.learningStudyKind),
    ).toEqual([
      "full-population",
      "full-population",
      "full-population",
      "sampled-population-proxy",
      "sampled-population-proxy",
    ]);
  });

  it("rejects malformed snapshot measurements", () => {
    const story = structuredClone(loadFixture());
    story.learning.scenarios[
      "braess-open"
    ].representative.snapshots[0]!.averagePhysicalLatency = Number.NaN;
    expect(populationBundleSchema.safeParse(story).success).toBe(false);
  });
});
