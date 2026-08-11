import type { StoryData } from "../data/story-schema";
import {
  appendTitleAndDescription,
  linearScale,
  svgElement,
} from "./svg-utils";

export function createLearnerChart(
  container: HTMLElement,
  story: StoryData,
): void {
  const comparison = story.comparison;
  if (!comparison) {
    container.replaceChildren();
    return;
  }
  const width = 520;
  const height = 220;
  const block = comparison.scenarios["braess-tolled"];
  const learners = [
    { label: "Q-learning", summary: block.qLearning.representativeSummary },
    {
      label: "best response",
      summary: block.bestResponse.representativeSummary,
    },
    { label: "Hedge", summary: block.hedge.representativeSummary },
  ];
  const costs = learners.map((item) => item.summary.physicalSocialCost);
  const minimumCost = Math.floor(Math.min(...costs));
  const maximumCost = Math.max(minimumCost + 1, Math.ceil(Math.max(...costs)));
  const maximumExploitability = Math.max(
    1,
    ...learners.map((item) => item.summary.exploitability),
  );
  const socialX = linearScale([minimumCost, maximumCost], [155, 330]);
  const exploitX = linearScale([0, maximumExploitability], [370, 500]);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}` });
  appendTitleAndDescription(
    svg,
    "Tolled learner comparison with one hundred agents",
    "Separate scales compare exported physical social cost and final exploitability for three methods with different information.",
  );
  const socialLabel = svgElement("text", {
    x: 155,
    y: 20,
    class: "chart-axis",
  });
  socialLabel.textContent = `social cost in commuter minutes (${minimumCost} to ${maximumCost})`;
  const exploitLabel = svgElement("text", {
    x: 370,
    y: 20,
    class: "chart-axis",
  });
  exploitLabel.textContent = `exploitability in minutes (0 to ${maximumExploitability})`;
  svg.append(socialLabel, exploitLabel);
  learners.forEach((learner, index) => {
    const y = 62 + index * 54;
    const label = svgElement("text", { x: 12, y: y + 4, class: "chart-label" });
    label.textContent = learner.label;
    const socialLine = svgElement("line", {
      x1: socialX(minimumCost),
      x2: socialX(learner.summary.physicalSocialCost),
      y1: y,
      y2: y,
      stroke: "#ff7a3d",
      "stroke-width": 3,
    });
    const socialPoint = svgElement("circle", {
      cx: socialX(learner.summary.physicalSocialCost),
      cy: y,
      r: 4,
      fill: "#fff1d0",
    });
    const exploitLine = svgElement("line", {
      x1: exploitX(0),
      x2: exploitX(learner.summary.exploitability),
      y1: y,
      y2: y,
      stroke: "#8a8a8a",
      "stroke-width": 3,
    });
    const exploitPoint = svgElement("circle", {
      cx: exploitX(learner.summary.exploitability),
      cy: y,
      r: 4,
      fill: "#2cd67b",
    });
    svg.append(label, socialLine, socialPoint, exploitLine, exploitPoint);
  });
  container.replaceChildren(svg);
}
