import type { StorySnapshot } from "../data/story-schema";
import {
  appendTitleAndDescription,
  linePath,
  linearScale,
  svgElement,
} from "./svg-utils";

export interface LearningChartHandle {
  readonly updateCursor: (episode: number) => void;
}

export function createLearningChart(
  container: HTMLElement,
  snapshots: readonly StorySnapshot[],
  equilibriumAverage: number,
  optimumAverage: number,
): LearningChartHandle {
  const width = 520;
  const height = 220;
  const margin = { left: 42, right: 12, top: 18, bottom: 30 };
  const maximumEpisode = snapshots.at(-1)?.episode ?? 1;
  const values = snapshots.map((snapshot) => snapshot.averagePhysicalLatency);
  const minimum = Math.min(optimumAverage, ...values) - 2;
  const maximum = Math.max(equilibriumAverage, ...values) + 2;
  const x = linearScale(
    [0, maximumEpisode],
    [margin.left, width - margin.right],
  );
  const y = linearScale(
    [minimum, maximum],
    [height - margin.bottom, margin.top],
  );
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}` });
  appendTitleAndDescription(
    svg,
    "Independent Q-learning latency over exact exported episodes",
    `Average physical latency evolves through training. Reference lines mark Nash latency ${equilibriumAverage} and optimum latency ${optimumAverage}.`,
  );
  for (const value of [optimumAverage, equilibriumAverage]) {
    svg.append(
      svgElement("line", {
        x1: margin.left,
        x2: width - margin.right,
        y1: y(value),
        y2: y(value),
        class: "chart-reference",
      }),
    );
  }
  const path = svgElement("path", {
    d: linePath(
      snapshots.map((snapshot) => ({
        x: x(snapshot.episode),
        y: y(snapshot.averagePhysicalLatency),
      })),
    ),
    class: "chart-line",
  });
  const cursor = svgElement("line", {
    x1: x(0),
    x2: x(0),
    y1: margin.top,
    y2: height - margin.bottom,
    class: "chart-cursor",
  });
  const axisLabel = svgElement("text", {
    x: margin.left,
    y: height - 7,
    class: "chart-axis",
  });
  axisLabel.textContent = "episode";
  const latencyLabel = svgElement("text", {
    x: margin.left,
    y: 11,
    class: "chart-axis",
  });
  latencyLabel.textContent = "average physical latency";
  const equilibriumLabel = svgElement("text", {
    x: width - margin.right,
    y: y(equilibriumAverage) - 4,
    "text-anchor": "end",
    class: "chart-label",
  });
  equilibriumLabel.textContent = `Nash ${equilibriumAverage}`;
  const optimumLabel = svgElement("text", {
    x: width - margin.right,
    y: y(optimumAverage) - 4,
    "text-anchor": "end",
    class: "chart-label",
  });
  optimumLabel.textContent = `optimum ${optimumAverage}`;
  svg.append(
    path,
    cursor,
    axisLabel,
    latencyLabel,
    equilibriumLabel,
    optimumLabel,
  );
  container.replaceChildren(svg);
  return {
    updateCursor: (episode: number) => {
      const coordinate = x(Math.max(0, Math.min(maximumEpisode, episode)));
      cursor.setAttribute("x1", String(coordinate));
      cursor.setAttribute("x2", String(coordinate));
      svg.dataset.currentEpisode = String(episode);
    },
  };
}
