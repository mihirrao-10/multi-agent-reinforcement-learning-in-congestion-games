import { expect, test } from "@playwright/test";

import {
  expectVisibleElementsInsideViewport,
  openTitle,
  proceedFrom,
  runLearningToCompletion,
  selectPopulation,
  startStory,
  unlockThrough,
  watchRuntimeErrors,
} from "./helpers";

test("fresh load is an exact, non-bypassable title screen", async ({
  page,
}) => {
  const errors = watchRuntimeErrors(page);
  await openTitle(page);
  await expect(page.locator("#opening-screen")).toBeVisible();
  await expect(page.locator("#opening-screen > :visible")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "When Every Agent Finds the Shortcut",
  );
  await expect(page.getByRole("main")).toBeHidden();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect
    .poll(() => page.evaluate(() => document.body.scrollHeight <= innerHeight))
    .toBe(true);

  for (const key of ["End", "PageDown", "PageUp"]) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.evaluate(() => {
    location.hash = "under-the-hood";
  });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  await page.locator("#replay-experiment").evaluate((element) => {
    (element as HTMLElement).focus();
  });
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe(
    "replay-experiment",
  );
  await page.screenshot({ path: "e2e/screenshots/title-screen.png" });
  expect(errors).toEqual([]);
});

test("Start reveals a waiting network and concepts unlock one act at a time", async ({
  page,
}) => {
  test.setTimeout(55_000);
  const errors = watchRuntimeErrors(page);
  await startStory(page);
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("data-presentation-state", "waiting");
  await expect(stage).toHaveAttribute("data-route-counts", "waiting");
  await expect(stage).toHaveAttribute("data-learning-state", "not-started");
  await expect(page.locator("#stage-metrics")).toBeHidden();
  await expect(page.locator("#contextual-playback")).toBeHidden();
  await expect(page.locator("#network-legend")).toBeHidden();
  await expect(
    page.locator(".chapter[data-story-act]:not([hidden])"),
  ).toHaveCount(1);
  await expect(page.locator("#scene-caption")).toContainText("waiting at S");

  const placement = await page.evaluate(() => {
    const camera = document
      .querySelector(".stage-top-controls")!
      .getBoundingClientRect();
    const canvas = document
      .querySelector(".canvas-frame")!
      .getBoundingClientRect();
    const population = document
      .querySelector(".population-control")!
      .getBoundingClientRect();
    const openingTitle = getComputedStyle(
      document.querySelector("#opening-title")!,
    ).fontSize;
    const storyTitle = getComputedStyle(
      document.querySelector("#arrival .principal-title")!,
    ).fontSize;
    return {
      cameraBottom: camera.bottom,
      canvasTop: canvas.top,
      canvasBottom: canvas.bottom,
      populationTop: population.top,
      openingTitle,
      storyTitle,
    };
  });
  expect(placement.cameraBottom).toBeLessThanOrEqual(placement.canvasTop + 1);
  expect(placement.populationTop).toBeGreaterThan(placement.canvasBottom);
  expect(placement.openingTitle).toBe(placement.storyTitle);
  await page.screenshot({
    path: "e2e/screenshots/first-post-start-network.png",
  });

  await proceedFrom(page, 0);
  await expect(
    page.locator(".chapter[data-story-act]:not([hidden])"),
  ).toHaveCount(2);
  for (const route of ["Upper", "Lower", "Shortcut"]) {
    await page.getByRole("button", { name: new RegExp(`^${route}`) }).click();
    await expect(stage).toHaveAttribute(
      "data-route-highlight",
      route === "Upper" ? "U" : route === "Lower" ? "L" : "Z",
    );
  }
  await page.screenshot({ path: "e2e/screenshots/route-chapter.png" });

  await proceedFrom(page, 1);
  await expect(page.locator("#network-legend")).toBeVisible();
  await expect(
    page.locator("#network-legend .network-encoding:visible"),
  ).toHaveCount(2);
  await expect(page.locator("#stage-metrics")).toBeHidden();
  await page.screenshot({ path: "e2e/screenshots/reward-chapter.png" });

  await proceedFrom(page, 2);
  await expect(
    page.getByRole("button", { name: "Run learning with 100 agents" }),
  ).toBeVisible();
  await expect(page.locator('[data-proceed-act="3"]')).toBeHidden();
  await expect(page.locator("#stage-metrics")).toBeHidden();
  await page.screenshot({ path: "e2e/screenshots/learning-before-start.png" });

  await page
    .getByRole("button", { name: "Run learning with 100 agents" })
    .click();
  await expect(stage).toHaveAttribute("data-learning-state", "playing");
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")))
    .toBeGreaterThan(0);
  await expect(page.locator("#stage-metrics")).toBeVisible();
  await expect(page.locator("#metric-exploitability")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Pause learning" }),
  ).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/learning-in-progress.png" });

  await page.getByRole("button", { name: "Pause learning" }).click();
  const pausedEpisode = await stage.getAttribute("data-episode");
  await page.waitForTimeout(180);
  await expect(stage).toHaveAttribute("data-episode", pausedEpisode!);
  await page.getByRole("button", { name: "Resume learning" }).click();
  await expect(stage).toHaveAttribute("data-learning-state", "complete", {
    timeout: 35_000,
  });
  await expect(stage).toHaveAttribute("data-route-counts", "0,0,100");
  await expect(page.locator("#metric-routes")).toHaveText("0 / 0 / 100");
  await expect(page.locator("#metric-latency")).toHaveText("80");
  await expect(page.locator('[data-proceed-act="3"]')).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/learning-complete.png" });
  expect(errors).toEqual([]);
});

test("the complete guided journey preserves exact closed, tolled, and replay states", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchRuntimeErrors(page);
  await startStory(page);
  await unlockThrough(page, 4);
  const stage = page.locator("#stage");
  const canvas = page.locator("#congestion-canvas");
  await expect(stage).toHaveAttribute("data-scene-mode", "landscape");
  await expect(stage).toHaveAttribute("data-trajectory", "best-response");
  await expect(canvas).toHaveAttribute("data-directional-arrows", "downhill");
  await expect(page.locator("#potential")).toContainText(
    "strict-improvement sequence",
  );
  await expectVisibleElementsInsideViewport(
    page,
    ".stage-top-controls button:visible",
  );
  await page.screenshot({ path: "e2e/screenshots/desktop-act4-landscape.png" });

  await proceedFrom(page, 4);
  await expect(stage).toHaveAttribute("data-route-counts", "0,0,100");
  await expect(page.locator("#metric-exploitability")).toHaveText("0");
  await expect(page.locator("#stable-inefficient")).toContainText(
    "(44, 44, 12)",
  );
  await expect(page.locator("#stable-inefficient")).toContainText("5000/4043");
  await expect(canvas).toHaveAttribute("data-directional-arrows", "none");
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    const labelAudit = await page.evaluate(() => {
      const frame = document
        .querySelector("#canvas-frame")!
        .getBoundingClientRect();
      const rectangles = [...document.querySelectorAll(".landscape-label")]
        .filter((element) => getComputedStyle(element).opacity !== "0")
        .map((element) => element.getBoundingClientRect());
      const inside = rectangles.every(
        (rectangle) =>
          rectangle.left >= frame.left &&
          rectangle.right <= frame.right &&
          rectangle.top >= frame.top &&
          rectangle.bottom <= frame.bottom,
      );
      const overlapping = rectangles.some((a, index) =>
        rectangles
          .slice(index + 1)
          .some(
            (b) =>
              !(
                a.right <= b.left ||
                b.right <= a.left ||
                a.bottom <= b.top ||
                b.bottom <= a.top
              ),
          ),
      );
      return { inside, overlapping };
    });
    expect(labelAudit).toEqual({ inside: true, overlapping: false });
  }
  await page.screenshot({ path: "e2e/screenshots/equilibrium-vs-optimum.png" });

  await proceedFrom(page, 5);
  await expect(stage).toHaveAttribute("data-scenario", "braess-closed");
  await expect(stage).toHaveAttribute("data-shortcut", "closed");
  await expect(stage).toHaveAttribute("data-route-counts", "50,50");
  await expect(page.locator("#metric-routes")).toHaveText("50 / 50 / 0");
  await expect(page.locator("#metric-latency")).toHaveText("65");
  await page.screenshot({ path: "e2e/screenshots/desktop-act6-closed.png" });

  await proceedFrom(page, 6);
  await expect(stage).toHaveAttribute("data-scenario", "braess-tolled");
  await expect(stage).toHaveAttribute("data-tolls", "active");
  await expect(stage).toHaveAttribute("data-route-counts", "44,44,12");
  await expect(stage).toHaveAttribute("data-surface", "physical-social-cost");
  await expect(canvas).toHaveAttribute("data-potential-morph", "1.0000");
  await expectVisibleElementsInsideViewport(
    page,
    ".stage-top-controls button:visible",
  );
  await page.screenshot({ path: "e2e/screenshots/desktop-act7-tolled.png" });
  await page.screenshot({ path: "e2e/screenshots/desktop-reduced-motion.png" });

  await proceedFrom(page, 7);
  await expect(page.locator("#learner-table tbody tr")).toHaveCount(3);
  await expect(page.locator(".comparison-scope")).toContainText("100-agent");
  await page.screenshot({
    path: "e2e/screenshots/desktop-act8-comparison.png",
  });
  await proceedFrom(page, 8);
  await expect(page.locator("#answer")).toContainText(
    "They learned the incentives they were given.",
  );
  await proceedFrom(page, 9);
  await expect(
    page.getByRole("heading", { name: "Under the hood" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Under the hood" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Replay the experiment" }),
  ).toHaveCount(1);
  await page.screenshot({ path: "e2e/screenshots/under-the-hood.png" });

  await page.getByRole("button", { name: "Replay the experiment" }).click();
  await expect(page.locator("#opening-screen")).toBeVisible();
  await expect(page.getByRole("main")).toBeHidden();
  await expect(stage).toHaveAttribute("data-story-act", "0");
  await expect(stage).toHaveAttribute("data-presentation-state", "waiting");
  await expect(page.locator("body")).toHaveAttribute(
    "data-bundle-population",
    "100",
  );
  await expect(
    page.locator(".chapter[data-story-act]:not([hidden])"),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("all population choices load distinct computed trajectories without stale values", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchRuntimeErrors(page);
  await startStory(page);
  await unlockThrough(page, 3);
  const initialResources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(
    initialResources.some((name) => name.includes("population-100-v2.json")),
  ).toBe(true);
  expect(
    initialResources.some((name) => name.includes("population-1000-v2.json")),
  ).toBe(false);
  expect(
    initialResources.some((name) => name.includes("population-10000-v2.json")),
  ).toBe(false);

  await runLearningToCompletion(page);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "0,0,100",
  );

  await selectPopulation(page, 1_000);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-presentation-state",
    "waiting",
  );
  await expect(page.locator("#cohort-legend-item")).toBeVisible();
  await expect(page.locator("#cohort-legend-text")).toContainText(
    "about 6 agents",
  );
  await runLearningToCompletion(page);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "7,9,984",
  );
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-visible-beads",
    "180",
  );
  await page.screenshot({
    path: "e2e/screenshots/population-1000-cohorts.png",
  });

  await selectPopulation(page, 10_000);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-presentation-state",
    "waiting",
  );
  await expect(page.locator("#cohort-legend-text")).toContainText(
    "about 56 agents",
  );
  await runLearningToCompletion(page);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "258,257,9485",
  );
  await expect(
    page.locator("#stable-inefficient [data-exact='open-equilibrium-counts']"),
  ).toHaveText("(0, 0, 10000)");
  await expect(page.locator("#landscape-sampling-note")).toContainText(
    "samples the exact potential formula",
  );
  await page.screenshot({
    path: "e2e/screenshots/population-10000-cohorts.png",
  });

  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => entry.name),
  );
  expect(
    resources.some((name) => name.includes("population-1000-v2.json")),
  ).toBe(true);
  expect(
    resources.some((name) => name.includes("population-10000-v2.json")),
  ).toBe(true);
  expect(errors).toEqual([]);
});
