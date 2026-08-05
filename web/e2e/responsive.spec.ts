import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoIntersection,
  openStory,
} from "./helpers";

const viewports = [
  { name: "desktop-1440x1000", width: 1440, height: 1000, stacked: false },
  { name: "desktop-1280x800", width: 1280, height: 800, stacked: false },
  { name: "tablet-768x1024", width: 768, height: 1024, stacked: true },
  { name: "mobile-390x844", width: 390, height: 844, stacked: true },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} has a readable responsive composition`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openStory(page);
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
      viewport.width <= 560 ? viewport.height * 0.44 : 290,
    );

    if (viewport.width === 390) {
      expect(layout.visualPosition).toBe("relative");
      const controlHeights = await page
        .locator(".stage-controls button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getBoundingClientRect().height),
        );
      expect(Math.min(...controlHeights)).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".scene-caption")).toHaveCSS(
        "white-space",
        "nowrap",
      );
      const visibleProjectedLabels = await page
        .locator(".projected-labels .node-label")
        .evaluateAll(
          (labels) =>
            labels.filter((label) => getComputedStyle(label).opacity === "1")
              .length,
        );
      expect(visibleProjectedLabels).toBeGreaterThanOrEqual(2);
    }

    await page.screenshot({
      path: `e2e/screenshots/${viewport.name}.png`,
      fullPage: false,
    });
  });
}
