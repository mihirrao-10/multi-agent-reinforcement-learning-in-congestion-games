import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { storySchema, type StoryData } from "../src/data/story-schema";

let cached: StoryData | null = null;

export function loadFixture(): StoryData {
  if (cached) return cached;
  const raw: unknown = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../public/data/story-v1.json"),
      "utf8",
    ),
  );
  cached = storySchema.parse(raw);
  return cached;
}
