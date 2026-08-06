import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoIntersection,
  startStory,
  unlockThrough,
  watchRuntimeErrors,
} from "./helpers";

const viewports = [
  { name: "desktop-1440x1000", width: 1440, height: 1000, stacked: false },
  { name: "desktop-1280x800", width: 1280, height: 800, stacked: false },
  { name: "tablet-768x1024", width: 768, height: 1024, stacked: true },
  { name: "mobile-390x844", width: 390, height: 844, stacked: true },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} remains readable without clipping`, async ({
    page,
  }) => {
    test.setTimeout(40_000);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = watchRuntimeErrors(page);
    await startStory(page);
    await expectNoHorizontalOverflow(page);
    const layout = await page.evaluate(() => {
      const visual = document
        .querySelector(".visual-column")!
        .getBoundingClientRect();
      const prose = document
        .querySelector("#arrival .chapter-copy")!
        .getBoundingClientRect();
      const canvas = document
        .querySelector(".canvas-frame")!
        .getBoundingClientRect();
      return {
        visual: {
          left: visual.left,
          right: visual.right,
          top: visual.top,
          bottom: visual.bottom,
        },
        prose: {
          left: prose.left,
          right: prose.right,
          top: prose.top,
          bottom: prose.bottom,
        },
        canvasHeight: canvas.height,
        visualPosition: getComputedStyle(
          document.querySelector(".visual-column")!,
        ).position,
      };
    });
    if (viewport.stacked) {
      expect(layout.visual.left).toBeLessThanOrEqual(layout.prose.left + 1);
      expect(layout.visual.right).toBeGreaterThanOrEqual(
        layout.prose.right - 1,
      );
      expect(layout.visual.top).toBeLessThan(layout.prose.top);
    } else {
      expect(layout.visual.right).toBeLessThan(layout.prose.left);
      await expectNoIntersection(
        page,
        ".visual-column",
        "#arrival .chapter-copy",
      );
    }
    expect(layout.canvasHeight).toBeGreaterThanOrEqual(
      viewport.width <= 560 ? 270 : 290,
    );
    if (viewport.width === 390) {
      expect(layout.visualPosition).toBe("relative");
      const heights = await page
        .locator("button:visible")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().height),
        );
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      await page.screenshot({
        path: "e2e/screenshots/mobile-first-post-start.png",
      });
      await unlockThrough(page, 10);
      await expect(
        page.getByRole("heading", { name: "Under the hood" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Under the hood" }),
      ).toBeInViewport();
      await expectNoHorizontalOverflow(page);
    }
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}.png` });
    expect(errors).toEqual([]);
  });
}
