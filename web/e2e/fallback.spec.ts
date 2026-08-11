import { expect, test } from "@playwright/test";

import {
  proceedFrom,
  runLearningToCompletion,
  selectPopulation,
  startStory,
  watchRuntimeErrors,
} from "./helpers";

test("the continuous SVG fallback follows waiting, learning, population, closed, and tolled states", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchRuntimeErrors(page);
  await startStory(page, "?forceFallback=1");
  const fallback = page.locator("#webgl-fallback");
  await expect(page.locator("body")).toHaveAttribute("data-webgl", "fallback");
  await expect(fallback).toBeVisible();
  await expect(fallback.locator("[data-edge]")).toHaveCount(5);
  await expect(fallback.locator("[data-flow-edge]")).toHaveCount(5);
  await expect(fallback.locator(".fallback-node-cores circle")).toHaveCount(4);
  await expect(fallback.locator(".fallback-node-halos circle")).toHaveCount(4);
  await expect(fallback).toHaveAttribute(
    "data-flow-rendering",
    "continuous-lines",
  );
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS(
    "stroke",
    "rgb(44, 214, 123)",
  );
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS(
    "stroke-width",
    "1.8px",
  );
  await page.screenshot({ path: "e2e/screenshots/desktop-fallback.png" });

  await proceedFrom(page, 0);
  await page.getByRole("button", { name: /^Upper/ }).click();
  await expect(fallback).toHaveAttribute("data-route-highlight", "U");
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS(
    "opacity",
    "0.34",
  );
  await expect(fallback.locator('[data-edge="VT"]')).toHaveCSS(
    "opacity",
    "0.068",
  );
  await proceedFrom(page, 1);
  await proceedFrom(page, 2);
  await selectPopulation(page, 1_000);
  await expect(fallback.locator("[data-edge]")).toHaveCount(5);
  await runLearningToCompletion(page);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "61,68,871",
  );
  const flowAudit = await fallback.evaluate((element) => {
    const style = (edge: string) =>
      getComputedStyle(element.querySelector(`[data-edge="${edge}"]`)!);
    return {
      bottleneckWidth: Number.parseFloat(style("SU").strokeWidth),
      lightlyUsedWidth: Number.parseFloat(style("UT").strokeWidth),
      shortcutColor: style("UV").stroke,
      nodeFill: getComputedStyle(
        element.querySelector(".fallback-node-cores circle")!,
      ).fill,
    };
  });
  expect(flowAudit.bottleneckWidth).toBeGreaterThan(flowAudit.lightlyUsedWidth);
  expect(flowAudit.shortcutColor).toBe("rgb(255, 110, 72)");
  expect(flowAudit.nodeFill).toBe("rgb(255, 255, 255)");
  await proceedFrom(page, 3);
  await expect(fallback).toHaveAttribute("data-scene-mode", "landscape");
  await expect(fallback.locator(".fallback-network-view")).toBeHidden();
  await expect(fallback.locator(".fallback-landscape-view")).toBeVisible();
  await expect(fallback.locator("[data-fallback-descent]")).toBeVisible();
  const markerPositions = await fallback.evaluate((element) => {
    const center = (selector: string) => {
      const box = (
        element.querySelector(selector) as SVGGraphicsElement
      ).getBBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    return {
      equilibrium: center("[data-fallback-equilibrium]"),
      optimum: center("[data-fallback-optimum]"),
    };
  });
  expect(markerPositions.equilibrium.x).toBeCloseTo(280, 0);
  expect(markerPositions.equilibrium.y).toBeCloseTo(38, 0);
  expect(markerPositions.optimum.x).toBeCloseTo(284, 0);
  expect(markerPositions.optimum.y).toBeCloseTo(238, 0);
  await page.screenshot({ path: "e2e/screenshots/fallback-landscape.png" });
  await proceedFrom(page, 4);
  await expect(fallback.locator("[data-fallback-descent]")).toBeHidden();
  await expect(fallback.locator("[data-fallback-learning]")).toBeVisible();
  await proceedFrom(page, 5);
  await expect(fallback).toHaveAttribute("data-scene-mode", "network");
  await expect(fallback.locator(".fallback-network-view")).toBeVisible();
  await expect(fallback.locator(".fallback-landscape-view")).toBeHidden();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "500,500",
  );
  await expect(fallback.locator('[data-edge="UV"]')).toHaveCSS("opacity", "0");
  await proceedFrom(page, 6);
  await expect(fallback).toHaveAttribute("data-scene-mode", "landscape");
  await expect(fallback.locator("[data-fallback-equilibrium]")).toBeHidden();
  await expect(fallback.locator("[data-fallback-optimum]")).toBeVisible();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "500,500,0",
  );
  await expect(fallback.locator('[data-edge="UV"]')).toHaveCSS(
    "opacity",
    "0.34",
  );
  expect(errors).toEqual([]);
});
