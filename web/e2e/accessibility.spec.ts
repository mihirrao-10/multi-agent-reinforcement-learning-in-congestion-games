import { expect, test } from "@playwright/test";

import { expectNoIntersection, openStory } from "./helpers";

test("semantic navigation, names, chart summaries, and focus are available", async ({
  page,
}) => {
  await openStory(page);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("article.story-chapters")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Skip to the story" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play learning", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Explore view" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#congestion-canvas")).toHaveAttribute(
    "aria-label",
    /exact route counts 17, 32, 31/,
  );
  await expect(page.locator("#scene-description")).toContainText(
    "average physical latency 66.76875",
  );
  await expect(page.locator("#learning-chart svg title")).toHaveText(
    "Independent Q-learning latency over exact exported episodes",
  );
  await expect(page.locator("#learning-chart svg desc")).toContainText(
    "Reference lines mark Nash latency 80 and optimum latency 64.6875",
  );
  await expect(page.locator(".network-legend")).toHaveAttribute(
    "aria-label",
    "Network visual encoding",
  );

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to the story" });
  await expect(skipLink).toBeFocused();
  expect(
    await skipLink.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe("none");

  await expectNoIntersection(page, "#arrival h1", "#arrival .hero-subtitle");
  await expectNoIntersection(page, ".visual-column", "#arrival .chapter-copy");
});

test("repository and all required documentation links are exposed", async ({
  page,
}) => {
  await openStory(page);
  const expected = {
    Repository:
      "https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games",
    "Interview guide":
      "https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games/blob/main/docs/interview-guide.md",
    "Course map":
      "https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games/blob/main/docs/course-map.md",
    "Experiment methodology":
      "https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games/blob/main/docs/experiment-methodology.md",
  };
  for (const [name, href] of Object.entries(expected)) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      href,
    );
  }
});
