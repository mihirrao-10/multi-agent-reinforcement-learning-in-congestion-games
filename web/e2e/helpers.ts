import { expect, type Page } from "@playwright/test";

export const STORY_PATH =
  "/multi-agent-reinforcement-learning-in-congestion-games/";

export async function openStory(page: Page, suffix = ""): Promise<void> {
  await page.goto(`${STORY_PATH}${suffix}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-story-ready",
    "true",
    {
      timeout: 20_000,
    },
  );
  await expect(page.locator("#loading")).toHaveCount(0, { timeout: 2_000 });
}

export async function scrollToAct(
  page: Page,
  selector: string,
  act: number,
): Promise<void> {
  await page
    .locator(selector)
    .evaluate((element) =>
      element.scrollIntoView({ behavior: "auto", block: "center" }),
    );
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-story-act",
    String(act),
  );
}

export async function numericAttribute(
  page: Page,
  selector: string,
  attribute: string,
): Promise<number> {
  const value = await page.locator(selector).getAttribute(attribute);
  if (value === null) throw new Error(`${selector} has no ${attribute}`);
  return Number(value);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

export async function expectNoIntersection(
  page: Page,
  firstSelector: string,
  secondSelector: string,
): Promise<void> {
  const intersects = await page.evaluate(
    ({ firstSelector: first, secondSelector: second }) => {
      const firstElement = document.querySelector(first);
      const secondElement = document.querySelector(second);
      if (!firstElement || !secondElement) return true;
      const a = firstElement.getBoundingClientRect();
      const b = secondElement.getBoundingClientRect();
      return !(
        a.right <= b.left ||
        b.right <= a.left ||
        a.bottom <= b.top ||
        b.bottom <= a.top
      );
    },
    { firstSelector, secondSelector },
  );
  expect(intersects).toBe(false);
}
