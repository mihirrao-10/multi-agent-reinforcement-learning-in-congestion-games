import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";

const expectedPath = "/multi-agent-reinforcement-learning-in-congestion-games/";
const target = new URL(
  process.argv[2] ?? `https://mihirrao-10.github.io${expectedPath}`,
);
const outputDirectory = resolve(process.argv[3] ?? "test-results/deployment");

if (target.pathname !== expectedPath) {
  throw new Error(
    `deployment URL must use the exact Pages subpath ${expectedPath}`,
  );
}

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];

function monitor(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failures.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  return failures;
}

async function waitReady(page) {
  await page.waitForFunction(
    () => document.body.dataset.storyReady === "true",
    undefined,
    { timeout: 30_000 },
  );
  await page.locator("#start-journey").waitFor({ state: "visible" });
  if (await page.locator("#start-journey").isDisabled()) {
    throw new Error("Start remained disabled after public data validation");
  }
}

async function proceed(page, act) {
  await page.locator(`[data-proceed-act="${act}"]`).click();
  await page.waitForFunction(
    (expected) =>
      document.querySelector("#stage")?.getAttribute("data-story-act") ===
      String(expected),
    act + 1,
  );
}

async function runLearning(page, expectedCounts) {
  await page
    .getByRole("button", {
      name: /^Run (?:learning with|sampled learning path for)/,
    })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#stage")?.getAttribute("data-learning-state") ===
      "complete",
    undefined,
    { timeout: 40_000 },
  );
  const counts = await page.locator("#stage").getAttribute("data-route-counts");
  if (counts !== expectedCounts) {
    throw new Error(
      `deployed learning endpoint ${counts ?? "missing"} did not equal ${expectedCounts}`,
    );
  }
}

async function selectPopulation(page, population) {
  await page.locator(`button[data-population="${population}"]`).click();
  await page.waitForFunction(
    (expected) => document.body.dataset.bundlePopulation === String(expected),
    population,
    { timeout: 30_000 },
  );
}

try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await desktop.newPage();
  const failures = monitor(page);
  const response = await page.goto(target.href, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error(
      `desktop navigation returned ${response?.status() ?? "no response"}`,
    );
  }
  await waitReady(page);

  const initial = await page.evaluate(async () => {
    const [manifestResponse, bundleResponse] = await Promise.all([
      fetch("data/manifest-v3.json", { cache: "no-store" }),
      fetch("data/population-100000-v3.json", { cache: "no-store" }),
    ]);
    const manifest = await manifestResponse.json();
    const bundle = await bundleResponse.json();
    return {
      title: document.querySelector("#opening-title")?.textContent?.trim(),
      visibleOpeningChildren: [
        ...document.querySelectorAll("#opening-screen > *"),
      ].filter((element) => getComputedStyle(element).display !== "none")
        .length,
      mainHidden: document.querySelector("main")?.hidden,
      scrollLocked: document.body.scrollHeight <= innerHeight,
      manifestStatus: manifestResponse.status,
      bundleStatus: bundleResponse.status,
      manifestSchema: manifest.schemaVersion,
      population: bundle.population,
      resources: performance
        .getEntriesByType("resource")
        .map((entry) => entry.name),
    };
  });
  if (
    initial.title !== "When Every Agent Finds the Shortcut" ||
    initial.visibleOpeningChildren !== 3 ||
    !initial.mainHidden ||
    !initial.scrollLocked ||
    initial.manifestStatus !== 200 ||
    initial.bundleStatus !== 200 ||
    initial.manifestSchema !== "3.0.0" ||
    initial.population !== 100000
  ) {
    throw new Error(
      `invalid deployed opening state: ${JSON.stringify(initial)}`,
    );
  }
  if (
    initial.resources.some(
      (name) =>
        name.includes("population-100-v3") ||
        name.includes("population-1000-v3") ||
        name.includes("population-10000-v3") ||
        name.includes("population-1000000-v3"),
    )
  ) {
    throw new Error("scale bundles were fetched before selection");
  }
  await page.screenshot({
    path: resolve(outputDirectory, "desktop-title.png"),
  });

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator("main").waitFor({ state: "visible" });
  const stage = page.locator("#stage");
  if (
    (await stage.getAttribute("data-presentation-state")) !== "waiting" ||
    (await stage.getAttribute("data-learning-state")) !== "not-started"
  ) {
    throw new Error("Start did not preserve the pre-experiment waiting state");
  }
  if ((await page.locator("body").getAttribute("data-webgl")) !== "active") {
    throw new Error("deployed desktop WebGL path is not active");
  }
  await page.screenshot({
    path: resolve(outputDirectory, "desktop-post-start.png"),
  });

  const canvas = page.locator("#congestion-canvas");
  const cameraBefore = Number(await canvas.getAttribute("data-camera-azimuth"));
  await page.getByRole("button", { name: "Explore view" }).click();
  await canvas.press("ArrowRight");
  await page.waitForFunction(
    (before) =>
      Number(
        document
          .querySelector("#congestion-canvas")
          ?.getAttribute("data-camera-azimuth"),
      ) > before,
    cameraBefore,
  );
  await page.getByRole("button", { name: "Reset view" }).click();

  await proceed(page, 0);
  await proceed(page, 1);
  await proceed(page, 2);
  await runLearning(page, "2580,2570,94850");

  await selectPopulation(page, 100);
  await runLearning(page, "23,20,57");
  await selectPopulation(page, 1000);
  await runLearning(page, "61,68,871");
  await selectPopulation(page, 10000);
  await runLearning(page, "258,257,9485");
  await selectPopulation(page, 100000);
  if (
    (await stage.getAttribute("data-learning-study-kind")) !==
      "sampled-population-proxy" ||
    (await stage.getAttribute("data-simulated-learners")) !== "10000"
  ) {
    throw new Error("100,000-commuter sampled-study disclosure is missing");
  }
  await runLearning(page, "2580,2570,94850");
  await page.screenshot({
    path: resolve(outputDirectory, "desktop-population-100000.png"),
  });
  await selectPopulation(page, 1000000);
  if (
    (await stage.getAttribute("data-learning-study-kind")) !==
      "sampled-population-proxy" ||
    (await stage.getAttribute("data-represented-population")) !== "1000000"
  ) {
    throw new Error("1,000,000-commuter sampled-study disclosure is missing");
  }
  await runLearning(page, "25800,25700,948500");
  await page.screenshot({
    path: resolve(outputDirectory, "desktop-population-1000000.png"),
  });
  await selectPopulation(page, 100);
  await runLearning(page, "23,20,57");

  await proceed(page, 3);
  if (
    (await stage.getAttribute("data-scene-mode")) !== "landscape" ||
    (await stage.getAttribute("data-trajectory")) !== "best-response" ||
    (await canvas.getAttribute("data-directional-arrows")) !== "downhill"
  ) {
    throw new Error("deployed potential chapter lost its exact downhill path");
  }
  await proceed(page, 4);
  if (
    (await stage.getAttribute("data-route-counts")) !== "0,0,100" ||
    (await page.locator("#metric-exploitability").textContent())?.trim() !==
      "0 minutes"
  ) {
    throw new Error("deployed equilibrium chapter has stale metrics");
  }
  await proceed(page, 5);
  if (
    (await stage.getAttribute("data-scenario")) !== "braess-closed" ||
    (await stage.getAttribute("data-route-counts")) !== "50,50"
  ) {
    throw new Error("deployed closed-shortcut state is incorrect");
  }
  await proceed(page, 6);
  if (
    (await stage.getAttribute("data-scenario")) !== "braess-tolled" ||
    (await stage.getAttribute("data-route-counts")) !== "50,50,0" ||
    (await stage.getAttribute("data-surface")) !== "physical-social-cost"
  ) {
    throw new Error("deployed tolled state is incorrect");
  }
  for (let act = 7; act <= 9; act += 1) await proceed(page, act);
  if (
    (await page.getByRole("heading", { name: "Under the hood" }).count()) !==
      1 ||
    (await stage.getAttribute("data-story-act")) !== "10"
  ) {
    throw new Error("deployed guided journey did not reach Under the hood");
  }
  await page.screenshot({
    path: resolve(outputDirectory, "desktop-under-the-hood.png"),
  });
  await page.getByRole("button", { name: "Replay the experiment" }).click();
  if (
    !(await page.locator("#opening-screen").isVisible()) ||
    (await page.locator("body").getAttribute("data-bundle-population")) !==
      "100000"
  ) {
    throw new Error("deployed replay did not restore the default title state");
  }
  if (failures.length > 0) {
    throw new Error(`desktop runtime failures: ${failures.join("; ")}`);
  }
  report.push({ viewport: "desktop-1440x900", initial, status: "verified" });
  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const mobilePage = await mobile.newPage();
  const mobileFailures = monitor(mobilePage);
  await mobilePage.goto(target.href, { waitUntil: "domcontentloaded" });
  await waitReady(mobilePage);
  await mobilePage.getByRole("button", { name: "Start", exact: true }).click();
  const mobileInspection = await mobilePage.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    visualPosition: getComputedStyle(document.querySelector(".visual-column"))
      .position,
    presentation: document
      .querySelector("#stage")
      ?.getAttribute("data-presentation-state"),
  }));
  if (
    mobileInspection.overflow ||
    mobileInspection.visualPosition !== "relative" ||
    mobileInspection.presentation !== "waiting"
  ) {
    throw new Error(
      `invalid mobile deployment: ${JSON.stringify(mobileInspection)}`,
    );
  }
  await mobilePage.screenshot({
    path: resolve(outputDirectory, "mobile-post-start.png"),
  });
  await proceed(mobilePage, 0);
  await proceed(mobilePage, 1);
  await proceed(mobilePage, 2);
  await runLearning(mobilePage, "2580,2570,94850");
  for (let act = 3; act <= 9; act += 1) await proceed(mobilePage, act);
  const mobileCompletion = await mobilePage.evaluate(() => ({
    activeAct: document.querySelector("#stage")?.getAttribute("data-story-act"),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    underHood: [...document.querySelectorAll("h2")].some(
      (heading) => heading.textContent?.trim() === "Under the hood",
    ),
  }));
  if (
    mobileCompletion.activeAct !== "10" ||
    mobileCompletion.overflow ||
    !mobileCompletion.underHood
  ) {
    throw new Error(
      `mobile journey did not complete: ${JSON.stringify(mobileCompletion)}`,
    );
  }
  await mobilePage.screenshot({
    path: resolve(outputDirectory, "mobile-under-the-hood.png"),
  });
  if (mobileFailures.length > 0) {
    throw new Error(`mobile runtime failures: ${mobileFailures.join("; ")}`);
  }
  report.push({ viewport: "mobile-390x844", ...mobileInspection });
  await mobile.close();

  const fallback = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const fallbackPage = await fallback.newPage();
  const fallbackFailures = monitor(fallbackPage);
  const fallbackUrl = new URL(target);
  fallbackUrl.searchParams.set("forceFallback", "1");
  await fallbackPage.goto(fallbackUrl.href, { waitUntil: "domcontentloaded" });
  await waitReady(fallbackPage);
  await fallbackPage
    .getByRole("button", { name: "Start", exact: true })
    .click();
  if (
    (await fallbackPage.locator("body").getAttribute("data-webgl")) !==
      "fallback" ||
    !(await fallbackPage.locator("#webgl-fallback").isVisible()) ||
    (await fallbackPage.locator(".fallback-flow-bodies path").count()) !== 5 ||
    (await fallbackPage.locator(".fallback-node-cores circle").count()) !== 4
  ) {
    throw new Error("deployed SVG fallback did not preserve the waiting state");
  }
  await fallbackPage.screenshot({
    path: resolve(outputDirectory, "desktop-fallback.png"),
  });
  await proceed(fallbackPage, 0);
  await proceed(fallbackPage, 1);
  await proceed(fallbackPage, 2);
  await selectPopulation(fallbackPage, 1000);
  await runLearning(fallbackPage, "61,68,871");
  await proceed(fallbackPage, 3);
  await proceed(fallbackPage, 4);
  await proceed(fallbackPage, 5);
  if (
    (await fallbackPage.locator("#stage").getAttribute("data-route-counts")) !==
    "500,500"
  ) {
    throw new Error("deployed fallback closed scenario is incorrect");
  }
  await proceed(fallbackPage, 6);
  if (
    (await fallbackPage.locator("#stage").getAttribute("data-route-counts")) !==
    "500,500,0"
  ) {
    throw new Error("deployed fallback tolled scenario is incorrect");
  }
  for (let act = 7; act <= 9; act += 1) await proceed(fallbackPage, act);
  if (
    (await fallbackPage.locator("#stage").getAttribute("data-story-act")) !==
    "10"
  ) {
    throw new Error("deployed fallback journey did not reach Under the hood");
  }
  if (fallbackFailures.length > 0) {
    throw new Error(
      `fallback runtime failures: ${fallbackFailures.join("; ")}`,
    );
  }
  report.push({ viewport: "desktop-fallback", status: "verified" });
  await fallback.close();
} finally {
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      deployment: target.href,
      screenshots: outputDirectory,
      report,
      status: "verified",
    },
    null,
    2,
  ),
);
