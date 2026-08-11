import { describe, expect, it } from "vitest";

import { createLearningChart } from "../src/charts/learning-chart";
import { createRouteShareChart } from "../src/charts/route-share-chart";
import { linePath, linearScale } from "../src/charts/svg-utils";
import { loadFixture } from "./fixtures";

describe("native SVG charts", () => {
  it("uses stable linear scales and path generation", () => {
    const scale = linearScale([0, 10], [20, 120]);
    expect(scale(0)).toBe(20);
    expect(scale(5)).toBe(70);
    expect(
      linePath([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe("M1.00,2.00 L3.00,4.00");
  });

  it("renders accessible exact-snapshot timeline and cursor", () => {
    const container = document.createElement("div");
    const story = loadFixture();
    const snapshots =
      story.learning.scenarios["braess-open"].representative.snapshots;
    const handle = createLearningChart(container, snapshots, 120, 90);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.querySelector("title")?.textContent).toContain("Q-learning");
    handle.updateCursor(5000);
    expect(svg?.dataset.currentEpisode).toBe("5000");
  });

  it("keeps the route legend above the plot and maps labels to line colors", () => {
    const container = document.createElement("div");
    const snapshots =
      loadFixture().learning.scenarios["braess-open"].representative.snapshots;
    createRouteShareChart(container, snapshots);
    const labels = [
      ...container.querySelectorAll<SVGTextElement>("text"),
    ].filter((label) =>
      ["Upper", "Lower", "Shortcut"].includes(label.textContent ?? ""),
    );
    expect(labels.map((label) => label.getAttribute("y"))).toEqual([
      "12",
      "12",
      "12",
    ]);
    expect(labels.map((label) => label.getAttribute("class"))).toEqual([
      "chart-label chart-label-secondary",
      "chart-label chart-label-primary",
      "chart-label chart-label-muted",
    ]);
  });
});
