import { afterEach, describe, expect, it, vi } from "vitest";

import { clearStoryCacheForTests, loadStoryData } from "../src/data/story-data";
import { loadFixture } from "./fixtures";

describe("story data repository", () => {
  afterEach(() => {
    clearStoryCacheForTests();
    vi.restoreAllMocks();
  });

  it("fetches, validates, and caches the story", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(loadFixture()), { status: 200 }),
      );
    const first = await loadStoryData();
    const second = await loadStoryData();
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a failed request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("missing", { status: 404 }),
    );
    await expect(loadStoryData()).rejects.toThrow("status 404");
  });
});
