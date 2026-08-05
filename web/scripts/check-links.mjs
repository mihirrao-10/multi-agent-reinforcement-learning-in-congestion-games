import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const ids = new Set(
  [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
);
const localLinks = [...html.matchAll(/href="#([^"]+)"/g)].map(
  (match) => match[1],
);
const missing = localLinks.filter((target) => !ids.has(target));
if (missing.length > 0) {
  throw new Error(`Missing local link targets: ${missing.join(", ")}`);
}
const required = [
  "https://github.com/mihirrao-10/multi-agent-reinforcement-learning-in-congestion-games",
  "blob/main/docs/interview-guide.md",
  "blob/main/docs/course-map.md",
];
for (const link of required) {
  if (!html.includes(link)) throw new Error(`Required link is absent: ${link}`);
}
