import { expect, test } from "@playwright/test";

import {
  proceedFrom,
  runLearningToCompletion,
  selectPopulation,
  startStory,
  watchRuntimeErrors,
} from "./helpers";

test("the SVG fallback follows waiting, learning, population, closed, and tolled states", async ({
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
  await expect(fallback.locator(".fallback-beads circle")).toHaveCount(100);
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS(
    "stroke",
    "rgb(44, 214, 123)",
  );
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS(
    "stroke-width",
    "1.5px",
  );
  await page.screenshot({ path: "e2e/screenshots/desktop-fallback.png" });

  await proceedFrom(page, 0);
  await page.getByRole("button", { name: /^Upper/ }).click();
  await expect(fallback).toHaveAttribute("data-route-highlight", "U");
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS("opacity", "1");
  await expect(fallback.locator('[data-edge="VT"]')).toHaveCSS(
    "opacity",
    "0.2",
  );
  await proceedFrom(page, 1);
  await proceedFrom(page, 2);
  await selectPopulation(page, 1_000);
  await expect(fallback.locator(".fallback-beads circle")).toHaveCount(180);
  await runLearningToCompletion(page);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "7,9,984",
  );
  await proceedFrom(page, 3);
  await proceedFrom(page, 4);
  await proceedFrom(page, 5);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "500,500",
  );
  await expect(fallback.locator('[data-edge="UV"]')).toHaveCSS("opacity", "0");
  await proceedFrom(page, 6);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-counts",
    "437,437,126",
  );
  await expect(fallback.locator('[data-edge="UV"]')).toHaveCSS("opacity", "1");
  expect(errors).toEqual([]);
});
