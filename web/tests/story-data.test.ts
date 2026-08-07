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
        const payload = path.includes("manifest-v3")
          ? loadManifestFixture()
          : path.includes("population-100-v3")
            ? loadFixture(100)
            : loadFixture(100_000);
        return Promise.resolve(
          new Response(JSON.stringify(payload), { status: 200 }),
        );
      });
    const initial = await loadInitialData();
    expect(initial.bundle.population).toBe(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const comparison = await loadPopulationBundle(100);
    expect(comparison.population).toBe(100);
    expect(comparison.learning.configuration.simulatedLearners).toBe(100);
    expect(comparison.learningStudy).toMatchObject({
      learningStudyKind: "full-population",
      representedPopulation: 100,
      simulatedLearners: 100,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await loadPopulationBundle(100)).toBe(comparison);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("missing", { status: 404 }),
    );
    await expect(loadInitialData()).rejects.toThrow("status 404");
  });

  it("does not cache a failed population request and succeeds on retry", async () => {
    let attempts = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (path.includes("manifest-v3")) {
        return Promise.resolve(
          new Response(JSON.stringify(loadManifestFixture()), { status: 200 }),
        );
      }
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(new Response("temporary", { status: 503 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(loadFixture(100_000)), { status: 200 }),
      );
    });
    await expect(loadPopulationBundle(100_000)).rejects.toThrow("status 503");
    const retried = await loadPopulationBundle(100_000);
    expect(retried.population).toBe(100_000);
    expect(attempts).toBe(2);
  });
});
