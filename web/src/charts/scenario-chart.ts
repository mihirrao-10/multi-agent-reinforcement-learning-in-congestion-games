import type { StoryData } from "../data/story-schema";
import {
  appendTitleAndDescription,
  linearScale,
  svgElement,
} from "./svg-utils";

export function createScenarioChart(
  container: HTMLElement,
  story: StoryData,
): void {
  const width = 520;
  const height = 220;
  const scenarios = [
    { key: "braess-open" as const, label: "open" },
    { key: "braess-closed" as const, label: "removed" },
    { key: "braess-tolled" as const, label: "tolled" },
  ];
  const y = linearScale([85, 125], [height - 38, 18]);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}` });
  appendTitleAndDescription(
    svg,
    "Exact and learned latency by incentive scenario",
    "Each group separates exact equilibrium, representative Q-learning greedy evaluation, and physical optimum average latency in minutes.",
  );
  scenarios.forEach((scenario, scenarioIndex) => {
    const exact = story.exactAnalysis[scenario.key];
    const learned =
      story.learning.scenarios[scenario.key].representative.summary;
    const values = [
      exact.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      learned.averagePhysicalLatency,
      exact.socialOptima[0]!.averagePhysicalLatency.decimal,
    ];
    const center = 95 + scenarioIndex * 160;
    values.forEach((value, valueIndex) => {
      const x = center + (valueIndex - 1) * 27;
      const line = svgElement("line", {
        x1: x,
        x2: x,
        y1: y(85),
        y2: y(value),
        stroke:
          valueIndex === 0
            ? "#ff7a3d"
            : valueIndex === 1
              ? "#fff1d0"
              : "#2cd67b",
        "stroke-width": valueIndex === 1 ? 4 : 2,
      });
      const point = svgElement("circle", {
        cx: x,
        cy: y(value),
        r: valueIndex === 1 ? 4 : 3,
        class: "chart-point",
      });
      svg.append(line, point);
    });
    const label = svgElement("text", {
      x: center,
      y: height - 12,
      "text-anchor": "middle",
      class: "chart-label",
    });
    label.textContent = scenario.label;
    svg.append(label);
  });
  const legend = svgElement("text", { x: 12, y: 13, class: "chart-label" });
  legend.textContent =
    "orange exact equilibrium  ·  cream learned  ·  green optimum";
  svg.append(legend);
  container.replaceChildren(svg);
}
