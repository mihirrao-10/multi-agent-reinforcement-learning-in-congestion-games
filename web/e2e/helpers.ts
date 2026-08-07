import { expect, type Page } from "@playwright/test";

export const STORY_PATH =
  "/multi-agent-reinforcement-learning-in-congestion-games/";

export async function openTitle(page: Page, suffix = ""): Promise<void> {
  await page.goto(`${STORY_PATH}${suffix}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-story-ready",
    "true",
    {
      timeout: 20_000,
    },
  );
  await expect(page.locator("#start-journey")).toBeEnabled();
}

export async function startStory(page: Page, suffix = ""): Promise<void> {
  await openTitle(page, suffix);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#opening-screen")).toBeHidden();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("#stage")).toHaveAttribute("data-story-act", "0");
}

export async function proceedFrom(page: Page, act: number): Promise<void> {
  await page.locator(`[data-proceed-act="${act}"]`).click();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-story-act",
    String(act + 1),
  );
  await expect(
    page.locator(`.chapter[data-story-act="${act + 1}"]`),
  ).toBeVisible();
}

export async function runLearningToCompletion(page: Page): Promise<void> {
  const stage = page.locator("#stage");
  await page
    .getByRole("button", {
      name: /^Run (?:learning with|sampled learning path for)/,
    })
    .click();
  await expect(stage).toHaveAttribute("data-learning-state", "playing");
  await expect
    .poll(async () => Number(await stage.getAttribute("data-episode")), {
      timeout: 8_000,
    })
    .toBeGreaterThan(0);
  await expect(stage).toHaveAttribute("data-learning-state", "complete", {
    timeout: 35_000,
  });
}

export async function unlockThrough(
  page: Page,
  targetAct: number,
): Promise<void> {
  let active = Number(
    await page.locator("#stage").getAttribute("data-story-act"),
  );
  while (active < targetAct) {
    if (active === 3) {
      const state = await page
        .locator("#stage")
        .getAttribute("data-learning-state");
      if (state !== "complete") await runLearningToCompletion(page);
    }
    await proceedFrom(page, active);
    active += 1;
  }
}

export async function selectPopulation(
  page: Page,
  population: 100 | 1_000 | 10_000 | 100_000 | 1_000_000,
): Promise<void> {
  await page.locator(`button[data-population="${population}"]`).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-bundle-population",
    String(population),
    { timeout: 20_000 },
  );
  await expect(page.locator("#population-loading")).toHaveText("");
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

export async function expectVisibleElementsInsideViewport(
  page: Page,
  selector: string,
): Promise<void> {
  const audit = await page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const rectangle = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() ?? "",
          left: rectangle.left,
          right: rectangle.right,
          top: rectangle.top,
          bottom: rectangle.bottom,
          inside:
            rectangle.left >= 0 &&
            rectangle.right <= innerWidth &&
            rectangle.top >= 8 &&
            rectangle.bottom <= innerHeight,
        };
      }),
  );
  expect(audit, JSON.stringify(audit)).not.toHaveLength(0);
  expect(
    audit.every((entry) => entry.inside),
    JSON.stringify(audit),
  ).toBe(true);
}

export function watchRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    errors.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
    );
  });
  return errors;
}
