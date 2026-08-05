import { expect, test } from "@playwright/test";

import { openStory, scrollToAct } from "./helpers";

test("the deliberate WebGL fallback preserves the exact story", async ({
  page,
}) => {
  await openStory(page, "?forceFallback=1");
  await expect(page.locator("body")).toHaveAttribute("data-webgl", "fallback");
  await expect(page.locator("#congestion-canvas")).toBeHidden();
  const fallback = page.locator("#webgl-fallback");
  await expect(fallback).toBeVisible();
  await expect(
    fallback.getByRole("img", { name: "Braess network fallback" }),
  ).toBeVisible();
  await expect(fallback.locator("[data-edge]")).toHaveCount(5);
  await expect(fallback).toContainText(
    "a native SVG preserves the exact network, route loads, and principal metrics",
  );
  await expect(page.locator("#metric-routes")).toHaveText("17 / 32 / 31");
  await page.screenshot({ path: "e2e/screenshots/desktop-fallback.png" });

  await scrollToAct(page, "#route-action", 1);
  await page.getByRole("button", { name: /Upper/ }).click();
  await expect(fallback).toHaveAttribute("data-route-highlight", "U");
  await expect(fallback.locator('[data-edge="SU"]')).toHaveCSS("opacity", "1");
  await expect(fallback.locator('[data-edge="VT"]')).toHaveCSS(
    "opacity",
    "0.24",
  );

  await scrollToAct(page, "#q-learning", 3);
  await expect(page.locator("#learning-chart svg")).toBeVisible();
  await expect(page.locator(".katex-mathml").first()).toBeAttached();
  await scrollToAct(page, "#remove-road", 6);
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-shortcut",
    "closed",
  );
  await expect(page.locator("#metric-routes")).toHaveText("40 / 40 / 0");
  await expect(fallback.locator('[data-edge="UV"]')).toHaveCSS(
    "opacity",
    "0.0192",
  );
});
