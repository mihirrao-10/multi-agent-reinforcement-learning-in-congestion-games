import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  openTitle,
  proceedFrom,
  startStory,
  unlockThrough,
  watchRuntimeErrors,
} from "./helpers";

async function expectAxeClean(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    results.violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`,
      )
      .join("\n"),
  ).toEqual([]);
}

test("the progressive journey is keyboard-operable and semantically quiet while locked", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = watchRuntimeErrors(page);
  await openTitle(page);
  await page.keyboard.press("Tab");
  const repositoryLink = page.getByRole("link", {
    name: "Open Multi-Agent Reinforcement Learning in Congestion Games on GitHub",
  });
  await expect(repositoryLink).toBeFocused();
  await page.keyboard.press("Tab");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await expect(start).toBeFocused();
  expect(
    await start.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("article.story-chapters")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.locator("[data-story-act='1']")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "A route is an action" }),
  ).toHaveCount(0);
  await expect(page.locator("#congestion-canvas")).toHaveAttribute(
    "aria-label",
    /100,000 commuters are represented at source S/,
  );

  await page.locator('[data-proceed-act="0"]').focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "A route is an action" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Upper/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-route-highlight",
    "U",
  );
  await proceedFrom(page, 1);
  await proceedFrom(page, 2);
  await page
    .getByRole("button", {
      name: "Run sampled learning path for 100,000 commuters",
    })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-learning-state",
    "playing",
  );
  await expect(page.locator("#playback-status")).not.toHaveText("");
  await expect(page.locator("#learning-chart svg")).toHaveAttribute(
    "role",
    "img",
  );
  await expect(page.locator("#learning-chart svg title")).toContainText(
    "Q-learning",
  );
  expect(errors).toEqual([]);
});

test("population changes announce the reset and expose readable control names", async ({
  page,
}) => {
  await openTitle(page, "?forceFallback=1");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator('[data-population="1000"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveAttribute(
    "data-bundle-population",
    "1000",
  );
  await expect(page.locator("#playback-status")).toContainText(
    "1,000 commuters selected.",
  );
  await expect(page.locator('button[data-population="1000"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Explore view" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#scene-description")).toContainText(
    "1,000 commuters are represented at source S",
  );
});

test("the title and fully unlocked journey pass automated WCAG A and AA checks", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTitle(page);
  await expectAxeClean(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expectAxeClean(page);
  await unlockThrough(page, 10);
  await expectAxeClean(page);
});

test("the mobile SVG fallback passes the same automated WCAG checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startStory(page, "?forceFallback=1");
  await expectAxeClean(page);
});
