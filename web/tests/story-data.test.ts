import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearStoryCacheForTests,
  loadInitialData,
  loadPopulationBundle,
} from "../src/data/story-data";
import { loadFixture, loadManifestFixture } from "./fixtures";

describe("story data repository", () => {
  afterEach(() => {
    clearStoryCacheForTests();
    vi.restoreAllMocks();
  });

  it("loads only the manifest and default bundle initially, then lazily caches scale data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        const path =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const payload = path.includes("manifest-v2")
          ? loadManifestFixture()
          : path.includes("population-10000")
            ? loadFixture(10_000)
            : loadFixture(100);
        return Promise.resolve(
          new Response(JSON.stringify(payload), { status: 200 }),
        );
      });
    const initial = await loadInitialData();
    expect(initial.bundle.population).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const large = await loadPopulationBundle(10_000);
    expect(large.population).toBe(10_000);
    expect(large.learning.configuration.agents).toBe(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await loadPopulationBundle(10_000)).toBe(large);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("missing", { status: 404 }),
    );
    await expect(loadInitialData()).rejects.toThrow("status 404");
  });
});
