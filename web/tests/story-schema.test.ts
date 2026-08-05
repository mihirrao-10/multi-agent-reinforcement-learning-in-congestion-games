import { describe, expect, it } from "vitest";

import { storySchema } from "../src/data/story-schema";
import { loadFixture } from "./fixtures";

describe("story schema", () => {
  it("accepts the complete committed authoritative bundle", () => {
    const story = loadFixture();
    expect(story.schemaVersion).toBe("1.0.0");
    expect(story.model.agentCount).toBe(80);
  });

  it("rejects malformed snapshot assignments", () => {
    const story = structuredClone(loadFixture());
    story.experiments.scenarios[
      "braess-open"
    ].qLearning.representative.snapshots[0]!.assignments.pop();
    expect(storySchema.safeParse(story).success).toBe(false);
  });
});
