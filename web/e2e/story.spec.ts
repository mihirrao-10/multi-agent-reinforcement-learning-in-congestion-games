import { expect, test } from "@playwright/test";

import { openStory, scrollToAct } from "./helpers";

test("loads on black, validates the export, and populates exact initial values", async ({
  page,
}) => {
  await page.goto("/multi-agent-reinforcement-learning-in-congestion-games/", {
    waitUntil: "domcontentloaded",
  });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).backgroundColor,
        body: getComputedStyle(document.body).backgroundColor,
      })),
    )
    .toEqual({ html: "rgb(0, 0, 0)", body: "rgb(0, 0, 0)" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-story-ready",
    "true",
    {
      timeout: 20_000,
    },
  );
  await expect(page.locator("#loading")).toHaveCount(0, { timeout: 2_000 });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "When Every Agent Finds the Shortcut",
  );
  await expect(page.locator(".hero-subtitle")).toHaveText(
    "Eighty independent learners discover the same zero-cost link. The network gets slower.",
  );
  await expect(page.locator("#metric-episode")).toHaveText("0");
  await expect(page.locator("#metric-routes")).toHaveText("17 / 32 / 31");
  await expect(page.locator("#metric-latency")).toHaveText("66.76875");
  await expect(page.locator("#metric-exploitability")).toHaveText("20.5");

  const blackSections = await page.evaluate(() =>
    ["html", "body", ".story-layout", ".technical", "footer"].map(
      (selector) =>
        getComputedStyle(document.querySelector(selector)!).backgroundColor,
    ),
  );
  expect(blackSections).toEqual(Array(5).fill("rgb(0, 0, 0)"));
});

test("playback exposes exact early, middle, and late states", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await openStory(page);
  const stage = page.locator("#stage");
  const initialRoutes = await stage.getAttribute("data-route-counts");
  const initialLatency = await page.locator("#metric-latency").textContent();

  await page
    .getByRole("button", { name: "Play learning", exact: true })
    .click();
  await expect(stage).toHaveAttribute("data-learning-state", "playing");
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")))
    .toBeGreaterThan(0);
  const earlyEpisode = Number(await stage.getAttribute("data-episode"));
  expect(earlyEpisode).toBeLessThan(1_500);
  expect(await stage.getAttribute("data-route-counts")).not.toBe(initialRoutes);
  expect(await page.locator("#metric-latency").textContent()).not.toBe(
    initialLatency,
  );

  await page.getByRole("button", { name: "Pause learning" }).click();
  await expect(stage).toHaveAttribute("data-learning-state", "paused");
  const pausedEpisode = await stage.getAttribute("data-episode");
  await page.waitForTimeout(180);
  await expect(stage).toHaveAttribute("data-episode", pausedEpisode!);

  await page
    .getByRole("button", { name: "Play learning", exact: true })
    .click();
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")), {
      timeout: 15_000,
    })
    .toBeGreaterThan(1_500);
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")), {
      timeout: 25_000,
    })
    .toBe(5_000);
  await expect(stage).toHaveAttribute("data-learning-state", "complete");
  await expect(stage).toHaveAttribute("data-route-counts", "0,0,80");
  await expect(page.locator("#metric-routes")).toHaveText("0 / 0 / 80");
  await expect(page.locator("#metric-latency")).toHaveText("80");
  await expect(page.locator("#metric-exploitability")).toHaveText("0");

  await page.getByRole("button", { name: "Replay learning" }).click();
  await expect(stage).toHaveAttribute("data-learning-state", "playing");
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")))
    .toBeLessThan(1_000);
});

test("the Begin action enters the learning chapter", async ({ page }) => {
  await openStory(page);
  await page.getByRole("button", { name: "Begin learning" }).click();
  await expect(page.locator("#stage")).toHaveAttribute("data-story-act", "3", {
    timeout: 8_000,
  });
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-learning-state",
    "playing",
  );
  await expect(page.locator("#learning-chart svg")).toHaveAttribute(
    "data-current-episode",
    /\d+/,
  );
});

test("the complete scroll story switches exact games and learning claims", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openStory(page);
  const stage = page.locator("#stage");
  const canvas = page.locator("#congestion-canvas");

  await scrollToAct(page, "#potential", 4);
  await expect(stage).toHaveAttribute("data-scene-mode", "landscape");
  await expect(stage).toHaveAttribute("data-trajectory", "best-response");
  await expect(page.locator("#potential")).toContainText(
    "strict asynchronous best response",
  );
  await expect(page.getByText("Nash equilibrium", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("social optimum", { exact: true })).toHaveCount(
    1,
  );
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    await expect(canvas).toHaveAttribute(
      "data-scene-transition-complete",
      "true",
      {
        timeout: 8_000,
      },
    );
    const cornerLabels = ["all Upper", "all Lower", "all Shortcut"];
    for (const label of cornerLabels) {
      await expect(page.getByText(label, { exact: true })).toHaveCSS(
        "opacity",
        "1",
      );
    }
    const labelsStayInside = await page.evaluate((names) => {
      const frame = document
        .querySelector("#canvas-frame")!
        .getBoundingClientRect();
      return names.every((name) => {
        const label = [...document.querySelectorAll(".landscape-label")].find(
          (element) => element.textContent === name,
        );
        if (!label) return false;
        const rectangle = label.getBoundingClientRect();
        return (
          rectangle.left >= frame.left &&
          rectangle.right <= frame.right &&
          rectangle.top >= frame.top &&
          rectangle.bottom <= frame.bottom
        );
      });
    }, cornerLabels);
    expect(labelsStayInside).toBe(true);
  }
  await page.screenshot({ path: "e2e/screenshots/desktop-act4-landscape.png" });

  await scrollToAct(page, "#stable-inefficient", 5);
  await expect(stage).toHaveAttribute("data-trajectory", "q-learning");
  await expect(stage).toHaveAttribute("data-focus-target", "equilibrium");
  await expect(page.locator("#stable-inefficient")).toContainText("(0, 0, 80)");
  await expect(page.locator("#stable-inefficient")).toContainText("64.6875");
  await expect(page.locator("#stable-inefficient")).toContainText("256/207");

  await scrollToAct(page, "#remove-road", 6);
  await expect(stage).toHaveAttribute("data-scene-mode", "network");
  await expect(stage).toHaveAttribute("data-scenario", "braess-closed");
  await expect(stage).toHaveAttribute("data-shortcut", "closed");
  await expect(stage).toHaveAttribute("data-route-counts", "40,40");
  await expect(page.locator("#metric-routes")).toHaveText("40 / 40 / 0");
  await expect(page.locator("#metric-latency")).toHaveText("65");
  await expect(page.locator("#remove-road")).toContainText("5200");
  await expect(page.locator("#remove-road")).toContainText("18.75 percent");
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    await expect(canvas).toHaveAttribute(
      "data-scene-transition-complete",
      "true",
      { timeout: 8_000 },
    );
  }
  await page.screenshot({ path: "e2e/screenshots/desktop-act6-closed.png" });

  await scrollToAct(page, "#tolls", 7);
  await expect(stage).toHaveAttribute("data-scene-mode", "landscape");
  await expect(stage).toHaveAttribute("data-scenario", "braess-tolled");
  await expect(stage).toHaveAttribute("data-tolls", "active");
  await expect(stage).toHaveAttribute("data-surface", "physical-social-cost");
  await expect(stage).toHaveAttribute("data-trajectory", "q-learning");
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    await expect(canvas).toHaveAttribute(
      "data-scene-transition-complete",
      "true",
      { timeout: 8_000 },
    );
    await expect(canvas).toHaveAttribute(
      "data-potential-morph-complete",
      "true",
      {
        timeout: 8_000,
      },
    );
    await expect(canvas).toHaveAttribute("data-potential-morph", "1.0000");
    await expect(
      page.getByText("social optimum = tolled equilibrium", { exact: true }),
    ).toHaveCSS("opacity", "1");
  }
  await page.screenshot({ path: "e2e/screenshots/desktop-act7-tolled.png" });

  await scrollToAct(page, "#three-adapt", 8);
  await expect(stage).toHaveAttribute("data-scene-mode", "network");
  await expect(stage).toHaveAttribute("data-route-counts", "35,35,10");
  await expect(page.locator("#metric-latency")).toHaveText("64.6875");
  await expect(page.locator("#scenario-chart svg")).toHaveAttribute(
    "aria-labelledby",
    /chart-title-\d+ chart-description-\d+/,
  );
  await expect(page.locator("#learner-table tbody tr")).toHaveCount(3);
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    await expect(canvas).toHaveAttribute(
      "data-scene-transition-complete",
      "true",
      { timeout: 8_000 },
    );
  }
  await page.screenshot({
    path: "e2e/screenshots/desktop-act8-comparison.png",
  });

  await scrollToAct(page, "#answer", 9);
  await expect(page.locator("#answer")).toContainText(
    "They learned the incentives they were given.",
  );
});
