import { describe, expect, it } from "vitest";

import { populationBundleSchema } from "../src/data/story-schema";
import { loadFixture, loadManifestFixture } from "./fixtures";

describe("story schema", () => {
  it("accepts the complete committed authoritative bundle", () => {
    const manifest = loadManifestFixture();
    const story = loadFixture();
    expect(story.schemaVersion).toBe("2.0.0");
    expect(story.population).toBe(100);
    expect(manifest.populations.map((entry) => entry.agents)).toEqual([
      100, 1_000, 10_000,
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
