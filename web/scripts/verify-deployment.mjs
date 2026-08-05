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

try {
  for (const viewport of [
    { name: "desktop-1440x1000", width: 1440, height: 1000 },
    { name: "mobile-390x844", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const failedRequests = [];
    const errorResponses = [];

    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
      );
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        errorResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(target.href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response?.ok()) {
      throw new Error(
        `${viewport.name} navigation returned ${response?.status() ?? "no response"}`,
      );
    }

    await page.waitForFunction(
      () => document.body.dataset.storyReady === "true",
      undefined,
      { timeout: 20_000 },
    );
    await page.locator("#loading").waitFor({ state: "detached" });

    const inspection = await page.evaluate(async () => {
      const heading = document.querySelector("h1")?.textContent?.trim();
      const stage = document.querySelector("#stage");
      const frame = document
        .querySelector("#canvas-frame")
        ?.getBoundingClientRect();
      const storyResponse = await fetch("data/story-v1.json", {
        cache: "no-store",
      });
      const story = await storyResponse.json();
      return {
        heading,
        storyStatus: storyResponse.status,
        schemaVersion: story.schemaVersion,
        webgl: document.body.dataset.webgl,
        act: stage?.getAttribute("data-story-act"),
        routeCounts: stage?.getAttribute("data-route-counts"),
        averageLatency: document
          .querySelector("#metric-latency")
          ?.textContent?.trim(),
        horizontalOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 1,
        frameVisible:
          frame !== undefined && frame.width > 0 && frame.height > 0,
      };
    });

    if (inspection.heading !== "When Every Agent Finds the Shortcut") {
      throw new Error(`${viewport.name} has an unexpected public title`);
    }
    if (
      inspection.storyStatus !== 200 ||
      inspection.schemaVersion !== "1.0.0"
    ) {
      throw new Error(
        `${viewport.name} did not load validated schema 1.0.0 data`,
      );
    }
    if (inspection.webgl !== "active") {
      throw new Error(
        `${viewport.name} deployed WebGL path is ${inspection.webgl ?? "unset"}`,
      );
    }
    if (inspection.horizontalOverflow || !inspection.frameVisible) {
      throw new Error(`${viewport.name} failed responsive geometry checks`);
    }
    if (failedRequests.length > 0 || errorResponses.length > 0) {
      throw new Error(
        `${viewport.name} asset failures: ${[
          ...failedRequests,
          ...errorResponses,
        ].join("; ")}`,
      );
    }

    await page.screenshot({
      path: resolve(outputDirectory, `${viewport.name}.png`),
      fullPage: false,
    });

    if (viewport.name.startsWith("desktop")) {
      await page.locator("#tolls").scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          document.querySelector("#stage")?.getAttribute("data-story-act") ===
          "7",
        undefined,
        { timeout: 10_000 },
      );
      await page.waitForFunction(
        () =>
          document
            .querySelector("#congestion-canvas")
            ?.getAttribute("data-potential-morph-complete") === "true",
        undefined,
        { timeout: 10_000 },
      );
      await page.screenshot({
        path: resolve(outputDirectory, "desktop-tolled-landscape.png"),
        fullPage: false,
      });
    }

    report.push({ viewport, ...inspection });
    await context.close();
  }
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
