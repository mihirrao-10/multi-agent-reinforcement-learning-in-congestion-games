import type { StorySnapshot } from "../data/story-schema";
import {
  appendTitleAndDescription,
  linePath,
  linearScale,
  svgElement,
} from "./svg-utils";

export function createRouteShareChart(
  container: HTMLElement,
  snapshots: readonly StorySnapshot[],
): void {
  const width = 520;
  const height = 150;
  const margin = { left: 42, right: 12, top: 18, bottom: 24 };
  const maximumEpisode = snapshots.at(-1)?.episode ?? 1;
  const population =
    snapshots[0]?.routeCounts.reduce((sum, count) => sum + count, 0) ?? 1;
  const x = linearScale(
    [0, maximumEpisode],
    [margin.left, width - margin.right],
  );
  const y = linearScale([0, 1], [height - margin.bottom, margin.top]);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}` });
  appendTitleAndDescription(
    svg,
    "Route shares through Q-learning",
    "Three lines show the exact Upper, Lower, and Shortcut shares at exported training episodes.",
  );
  const classes = [
    "chart-line chart-line-secondary",
    "chart-line",
    "chart-line chart-line-muted",
  ];
  const labels = ["Upper", "Lower", "Shortcut"];
  for (let route = 0; route < 3; route += 1) {
    const path = svgElement("path", {
      d: linePath(
        snapshots.map((snapshot) => ({
          x: x(snapshot.episode),
          y: y((snapshot.routeCounts[route] ?? 0) / population),
        })),
      ),
      class: classes[route]!,
    });
    const label = svgElement("text", {
      x: width - margin.right,
      y: 14 + route * 12,
      "text-anchor": "end",
      class: "chart-label",
    });
    label.textContent = labels[route]!;
    svg.append(path, label);
  }
  const axisLabel = svgElement("text", {
    x: margin.left,
    y: height - 5,
    class: "chart-axis",
  });
  axisLabel.textContent = "episode";
  svg.append(axisLabel);
  container.replaceChildren(svg);
}
