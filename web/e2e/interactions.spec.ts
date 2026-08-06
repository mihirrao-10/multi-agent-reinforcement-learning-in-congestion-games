import { expect, test, type Page } from "@playwright/test";

import { proceedFrom, startStory, watchRuntimeErrors } from "./helpers";

async function numericAttribute(
  page: Page,
  attribute: string,
): Promise<number> {
  const value = await page
    .locator("#congestion-canvas")
    .getAttribute(attribute);
  if (value === null) throw new Error(`canvas has no ${attribute}`);
  return Number(value);
}

test("camera focus and direct-manipulation directions agree", async ({
  page,
}) => {
  const errors = watchRuntimeErrors(page);
  await startStory(page);
  test.skip(
    (await page.locator("body").getAttribute("data-webgl")) !== "active",
    "camera interaction requires WebGL",
  );
  const stage = page.locator("#stage");
  const canvas = page.locator("#congestion-canvas");
  await proceedFrom(page, 0);
  await page.getByRole("button", { name: "Focus shortcut" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "shortcut");
  await proceedFrom(page, 1);
  await page.getByRole("button", { name: "Focus bottleneck" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "bottleneck");

  await page.getByRole("button", { name: "Explore view" }).click();
  await expect(stage).toHaveAttribute("data-user-exploring", "true");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas is not measurable");
  const initialAzimuth = await numericAttribute(page, "data-camera-azimuth");
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, {
    steps: 4,
  });
  await page.mouse.up();
  await expect
    .poll(() => numericAttribute(page, "data-camera-azimuth"))
    .toBeGreaterThan(initialAzimuth);

  const initialElevation = await numericAttribute(
    page,
    "data-camera-elevation",
  );
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.72, {
    steps: 4,
  });
  await page.mouse.up();
  await expect
    .poll(() => numericAttribute(page, "data-camera-elevation"))
    .toBeGreaterThan(initialElevation);

  const wheelAzimuth = await numericAttribute(page, "data-camera-azimuth");
  await canvas.dispatchEvent("wheel", { deltaX: 80, deltaY: 12 });
  await expect
    .poll(() => numericAttribute(page, "data-camera-azimuth"))
    .toBeGreaterThan(wheelAzimuth);

  const keyboardAzimuth = await numericAttribute(page, "data-camera-azimuth");
  await canvas.press("ArrowRight");
  await expect
    .poll(() => numericAttribute(page, "data-camera-azimuth"))
    .toBeGreaterThan(keyboardAzimuth);
  const distance = await numericAttribute(page, "data-camera-distance");
  await canvas.press("+");
  await expect
    .poll(() => numericAttribute(page, "data-camera-distance"))
    .toBeLessThan(distance);
  await canvas.press("Escape");
  await expect(stage).toHaveAttribute("data-user-exploring", "false");
  await page.getByRole("button", { name: "Explore view" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(stage).toHaveAttribute("data-focus-target", "none");
  expect(errors).toEqual([]);
});

test("normal wheel motion scrolls the page outside Explore view", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startStory(page);
  await proceedFrom(page, 0);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    scrollTo({ top: 0, behavior: "auto" });
  });
  await expect(page.locator("#stage")).toHaveAttribute("data-story-act", "0");
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-focus-target",
    "none",
  );
  await expect
    .poll(() => numericAttribute(page, "data-camera-distance"))
    .toBeCloseTo(5.25, 1);
  const canvas = page.locator("#congestion-canvas");
  const distance = await numericAttribute(page, "data-camera-distance");
  await canvas.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator("#stage")).toHaveAttribute("data-story-act", "0");
  await expect
    .poll(() => numericAttribute(page, "data-camera-distance"))
    .toBeCloseTo(distance, 1);
});
