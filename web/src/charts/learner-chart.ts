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
  const width = 520;
  const height = 220;
  const block = story.experiments.scenarios["braess-tolled"];
  const learners = [
    { label: "Q-learning", summary: block.qLearning.representative.summary },
    {
      label: "best response",
      summary: block.bestResponse.representative.summary,
    },
    { label: "Hedge", summary: block.hedge.representative.summary },
  ];
  const socialX = linearScale([5175, 5185], [155, 330]);
  const exploitX = linearScale(
    [0, Math.max(1, ...learners.map((item) => item.summary.exploitability))],
    [370, 500],
  );
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}` });
  appendTitleAndDescription(
    svg,
    "Tolled representative learner comparison",
    "Separate labeled scales compare physical social cost and final exploitability. The metrics are not merged onto one scale.",
  );
  const socialLabel = svgElement("text", {
    x: 155,
    y: 20,
    class: "chart-axis",
  });
  socialLabel.textContent = "physical social cost (5175 to 5185)";
  const exploitLabel = svgElement("text", {
    x: 370,
    y: 20,
    class: "chart-axis",
  });
  exploitLabel.textContent = "exploitability (0 to 1)";
  svg.append(socialLabel, exploitLabel);
  learners.forEach((learner, index) => {
    const y = 62 + index * 54;
    const label = svgElement("text", { x: 12, y: y + 4, class: "chart-label" });
    label.textContent = learner.label;
    const socialLine = svgElement("line", {
      x1: socialX(5175),
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
