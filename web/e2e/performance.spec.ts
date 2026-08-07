import { expect, test } from "@playwright/test";

import {
  openTitle,
  selectPopulation,
  startStory,
  watchRuntimeErrors,
} from "./helpers";

interface PopulationTiming {
  population: number;
  loadMilliseconds: number;
  renderedFrames: number;
  sampleMilliseconds: number;
  flowRendering: string | null;
}

test("population bundles lazy-load and continuous WebGL flow renders at a stable cadence", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors = watchRuntimeErrors(page);
  await startStory(page);
  test.skip(
    (await page.locator("body").getAttribute("data-webgl")) !== "active",
    "render timing requires WebGL",
  );

  const initialResources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(
    initialResources.some((name) => name.includes("population-100-v3")),
  ).toBe(false);
  expect(
    initialResources.some((name) => name.includes("population-1000-v3")),
  ).toBe(false);
  expect(
    initialResources.some((name) => name.includes("population-10000-v3")),
  ).toBe(false);
  expect(
    initialResources.some((name) => name.includes("population-100000-v3")),
  ).toBe(true);

  const timings: PopulationTiming[] = [];
  for (const population of [1_000, 10_000, 100_000] as const) {
    const loadStart = performance.now();
    await selectPopulation(page, population);
    const loadMilliseconds = performance.now() - loadStart;
    const canvas = page.locator("#congestion-canvas");
    const initialFrame = Number(
      (await canvas.getAttribute("data-animation-frame")) ?? 0,
    );
    const sampleStart = performance.now();
    await page.waitForTimeout(1_200);
    const sampleMilliseconds = performance.now() - sampleStart;
    const finalFrame = Number(
      (await canvas.getAttribute("data-animation-frame")) ?? 0,
    );
    const stage = page.locator("#stage");
    timings.push({
      population,
      loadMilliseconds,
      renderedFrames: finalFrame - initialFrame,
      sampleMilliseconds,
      flowRendering: await stage.getAttribute("data-flow-rendering"),
    });
  }

  for (const timing of timings) {
    expect(timing.loadMilliseconds).toBeLessThan(10_000);
    expect(
      timing.renderedFrames / (timing.sampleMilliseconds / 1_000),
    ).toBeGreaterThanOrEqual(15);
    expect(timing.flowRendering).toBe("continuous-tubes");
  }
  testInfo.annotations.push({
    type: "browser-performance",
    description: JSON.stringify(timings),
  });
  console.log(`browser-performance ${JSON.stringify(timings)}`);
  expect(errors).toEqual([]);
});

test("reduced motion stops idle WebGL rendering work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTitle(page);
  test.skip(
    (await page.locator("body").getAttribute("data-webgl")) !== "active",
    "render-idle check requires WebGL",
  );
  const canvas = page.locator("#congestion-canvas");
  await expect(canvas).toHaveAttribute("data-reduced-motion", "true");
  await page.waitForTimeout(150);
  const before = Number(
    (await canvas.getAttribute("data-animation-frame")) ?? 0,
  );
  await page.waitForTimeout(500);
  const after = Number(
    (await canvas.getAttribute("data-animation-frame")) ?? 0,
  );
  expect(after - before).toBeLessThanOrEqual(1);
});
