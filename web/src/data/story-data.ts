import { storySchema, type StoryData } from "./story-schema";
import { validateStoryConsistency } from "./validation";

let cachedStory: StoryData | null = null;

export async function loadStoryData(): Promise<StoryData> {
  if (cachedStory) return cachedStory;
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/story-v1.json`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) {
    throw new Error(`story data request failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  const result = storySchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `story schema validation failed: ${result.error.issues[0]?.message ?? "unknown issue"}`,
    );
  }
  validateStoryConsistency(result.data);
  cachedStory = result.data;
  return result.data;
}

export function clearStoryCacheForTests(): void {
  cachedStory = null;
}
