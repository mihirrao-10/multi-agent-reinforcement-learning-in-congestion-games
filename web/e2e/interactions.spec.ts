import { expect, test } from "@playwright/test";

import { numericAttribute, openStory, scrollToAct } from "./helpers";

test("focus controls change with network and landscape context", async ({
  page,
}) => {
  await openStory(page);
  const stage = page.locator("#stage");

  await scrollToAct(page, "#route-action", 1);
  await page.getByRole("button", { name: "Focus shortcut" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "shortcut");

  await scrollToAct(page, "#joint-reward", 2);
  await page.getByRole("button", { name: "Focus bottleneck" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "bottleneck");

  await scrollToAct(page, "#potential", 4);
  await page.getByRole("button", { name: "Focus equilibrium" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "equilibrium");
  await expect(page.locator("#scene-description")).toContainText(
    "Focus is on the exact equilibrium.",
  );
  await expect(page.locator("#playback-status")).toContainText(
    "Focus is on the exact equilibrium.",
  );
  await expect(page.locator(".network-legend")).toHaveAttribute(
    "aria-label",
    "Potential landscape visual encoding",
  );
  await page.getByRole("button", { name: "Focus optimum" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "optimum");
});

test("Explore view, keyboard orbit, keyboard zoom, Escape, and reset work", async ({
  page,
}) => {
  await openStory(page);
  test.skip(
    (await page.locator("body").getAttribute("data-webgl")) !== "active",
    "camera interaction requires WebGL",
  );
  const stage = page.locator("#stage");
  const canvas = page.locator("#congestion-canvas");

  await page.getByRole("button", { name: "Explore view" }).click();
  await expect(stage).toHaveAttribute("data-user-exploring", "true");
  await expect(
    page.getByRole("button", { name: "Exit Explore view" }),
  ).toHaveAttribute("aria-pressed", "true");

  const azimuth = await numericAttribute(
    page,
    "#congestion-canvas",
    "data-camera-azimuth",
  );
  await canvas.press("ArrowRight");
  await expect
    .poll(() =>
      numericAttribute(page, "#congestion-canvas", "data-camera-azimuth"),
    )
    .not.toBe(azimuth);

  const distance = await numericAttribute(
    page,
    "#congestion-canvas",
    "data-camera-distance",
  );
  await canvas.press("+");
  await expect
    .poll(() =>
      numericAttribute(page, "#congestion-canvas", "data-camera-distance"),
    )
    .toBeLessThan(distance);

  await canvas.press("Escape");
  await expect(stage).toHaveAttribute("data-user-exploring", "false");
  await page.getByRole("button", { name: "Explore view" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(stage).toHaveAttribute("data-user-exploring", "false");
  await expect(stage).toHaveAttribute("data-focus-target", "none");
});

test("reduced motion keeps comparisons and snaps the potential morph", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openStory(page);
  const stage = page.locator("#stage");
  const canvas = page.locator("#congestion-canvas");
  await expect(stage).toHaveAttribute("data-reduced-motion", "true");
  await expect(canvas).toHaveAttribute("data-reduced-motion", "true");

  await scrollToAct(page, "#tolls", 7);
  await expect(stage).toHaveAttribute("data-surface", "physical-social-cost");
  if ((await page.locator("body").getAttribute("data-webgl")) === "active") {
    await expect(canvas).toHaveAttribute("data-potential-morph", "1.0000");
    await expect(canvas).toHaveAttribute(
      "data-potential-morph-complete",
      "true",
    );
  }
  await expect(page.locator("#tolls")).toContainText("transfers");
  await page.screenshot({ path: "e2e/screenshots/desktop-reduced-motion.png" });
  await expect(
    page.getByRole("button", { name: "Play learning", exact: true }),
  ).toBeVisible();
});
