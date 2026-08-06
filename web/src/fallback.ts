import type { NetworkPresentation } from "./data/story-schema";
import { allocateVisualCohorts, visibleBeadBudget } from "./scene/cohorts";
import { edgeColorHex, edgeRadius } from "./scene/materials";

const PATHS = {
  SU: "M 58 150 C 120 80, 180 65, 250 78",
  UT: "M 250 78 C 330 55, 410 82, 502 150",
  SV: "M 58 150 C 120 220, 180 235, 250 222",
  VT: "M 250 222 C 330 245, 410 218, 502 150",
  UV: "M 250 78 C 268 118, 232 182, 250 222",
} as const;

const ROUTE_EDGES = {
  U: new Set(["SU", "UT"]),
  L: new Set(["SV", "VT"]),
  Z: new Set(["SU", "UV", "VT"]),
} as const;
const ROUTES = [
  ["SU", "UT"],
  ["SV", "VT"],
  ["SU", "UV", "VT"],
] as const;

type EdgeId = keyof typeof PATHS;

export class NetworkFallback {
  private readonly container: HTMLElement;
  private readonly paths = new Map<EdgeId, SVGPathElement>();
  private readonly beadLayer: SVGGElement;
  private activeRoute: keyof typeof ROUTE_EDGES | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.hidden = false;
    const wrapper = document.createElement("div");
    wrapper.className = "fallback-network";
    wrapper.innerHTML = `
      <svg viewBox="0 0 560 300" role="img" aria-labelledby="fallback-title fallback-desc">
        <title id="fallback-title">Braess network fallback</title>
        <desc id="fallback-desc">Four bright nodes and five thin joined edges show the same population-aware journey without WebGL.</desc>
        <g fill="none" stroke-linecap="round">
          ${Object.entries(PATHS)
            .map(([edge, path]) => `<path data-edge="${edge}" d="${path}" />`)
            .join("")}
        </g>
        <g class="fallback-beads" fill="#fff1d0"></g>
        <g fill="#fff9e8" stroke="#ffb84d" stroke-width="4">
          <circle cx="58" cy="150" r="11"/><circle cx="250" cy="78" r="10"/>
          <circle cx="250" cy="222" r="10"/><circle cx="502" cy="150" r="11"/>
        </g>
        <g fill="#f5f5f5" font-family="system-ui" font-size="13" text-anchor="middle">
          <text x="58" y="181">S</text><text x="250" y="50">U</text>
          <text x="250" y="258">V</text><text x="502" y="181">T</text>
        </g>
      </svg>
      <p>WebGL is unavailable, so a native SVG preserves the same waiting state, route loads, cohort weights, and journey controls.</p>`;
    this.container.replaceChildren(wrapper);
    wrapper.querySelectorAll<SVGPathElement>("[data-edge]").forEach((path) => {
      this.paths.set(path.dataset.edge as EdgeId, path);
    });
    const beadLayer = wrapper.querySelector<SVGGElement>(".fallback-beads");
    if (!beadLayer) throw new Error("fallback bead layer is missing");
    this.beadLayer = beadLayer;
  }

  update(
    snapshot: NetworkPresentation | null,
    shortcutOpen: boolean,
    population: number,
    waiting: boolean,
  ): void {
    for (const [edge, path] of this.paths) {
      const load = waiting ? 0 : (snapshot?.edgeLoads[edge] ?? 0);
      path.style.strokeWidth = `${Math.max(1.5, edgeRadius(load, population) * 150)}`;
      const role =
        edge === "UV"
          ? "shortcut"
          : edge === "UT" || edge === "SV"
            ? "constant"
            : "variable";
      path.style.stroke = edgeColorHex(role, load, population);
      path.dataset.baseOpacity = edge === "UV" && !shortcutOpen ? "0" : "1";
    }
    this.renderBeads(snapshot, population, waiting);
    this.applyHighlight();
  }

  highlightRoute(route: keyof typeof ROUTE_EDGES): void {
    this.activeRoute = route;
    this.container.dataset.routeHighlight = route;
    this.applyHighlight();
  }

  clearHighlight(): void {
    this.activeRoute = null;
    delete this.container.dataset.routeHighlight;
    this.applyHighlight();
  }

  private renderBeads(
    snapshot: NetworkPresentation | null,
    population: number,
    waiting: boolean,
  ): void {
    const namespace = "http://www.w3.org/2000/svg";
    const circles: SVGCircleElement[] = [];
    if (waiting || !snapshot) {
      const count = visibleBeadBudget(population);
      for (let index = 0; index < count; index += 1) {
        const circle = document.createElementNS(namespace, "circle");
        const angle = (index * 2.399963) % (Math.PI * 2);
        const radius = 4 + Math.floor(index / 28) * 2.2;
        circle.setAttribute("cx", String(58 + Math.cos(angle) * radius));
        circle.setAttribute("cy", String(150 + Math.sin(angle) * radius));
        circle.setAttribute("r", "1.7");
        circles.push(circle);
      }
    } else {
      const counts =
        snapshot.routeCounts.length === 2
          ? [...snapshot.routeCounts, 0]
          : snapshot.routeCounts;
      const cohorts = allocateVisualCohorts(counts, population);
      cohorts.forEach((cohort) => {
        const route = ROUTES[cohort.routeIndex]!;
        const phase = (cohort.ordinalOnRoute + 0.5) / cohort.visibleOnRoute;
        const edgeIndex = Math.min(
          route.length - 1,
          Math.floor(phase * route.length),
        );
        const path = this.paths.get(route[edgeIndex]!);
        if (!path) return;
        const local = (phase * route.length) % 1;
        const point = path.getPointAtLength(path.getTotalLength() * local);
        const circle = document.createElementNS(namespace, "circle");
        circle.setAttribute("cx", String(point.x));
        circle.setAttribute("cy", String(point.y));
        circle.setAttribute("r", "1.8");
        circles.push(circle);
      });
    }
    this.beadLayer.replaceChildren(...circles);
  }

  private applyHighlight(): void {
    for (const [edge, path] of this.paths) {
      const highlighted =
        this.activeRoute === null || ROUTE_EDGES[this.activeRoute].has(edge);
      path.style.filter = highlighted ? "brightness(1.18)" : "brightness(0.42)";
      const baseOpacity = Number(path.dataset.baseOpacity ?? "1");
      path.style.opacity = String(
        highlighted ? baseOpacity : baseOpacity * 0.2,
      );
    }
  }
}
