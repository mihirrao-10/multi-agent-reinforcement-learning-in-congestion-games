import type { NetworkPresentation } from "./data/story-schema";
import {
  edgeColorHex,
  edgeOpacity,
  edgeRadius,
  type EdgeRole,
} from "./scene/materials";

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

type EdgeId = keyof typeof PATHS;

function edgeRole(edge: EdgeId): EdgeRole {
  if (edge === "UV") return "shortcut";
  if (edge === "UT" || edge === "SV") return "constant";
  return "variable";
}

export class NetworkFallback {
  private readonly container: HTMLElement;
  private readonly paths = new Map<EdgeId, SVGPathElement>();
  private readonly glows = new Map<EdgeId, SVGPathElement>();
  private readonly highlights = new Map<EdgeId, SVGPathElement>();
  private activeRoute: keyof typeof ROUTE_EDGES | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.hidden = false;
    this.container.dataset.flowRendering = "continuous-lines";
    const wrapper = document.createElement("div");
    wrapper.className = "fallback-network";
    wrapper.innerHTML = `
      <svg viewBox="0 0 560 300" role="img" aria-labelledby="fallback-title fallback-desc">
        <title id="fallback-title">Braess highway network fallback</title>
        <desc id="fallback-desc">Four glowing white nodes and five continuous translucent flows preserve traffic-share color and thickness without WebGL.</desc>
        <g class="fallback-flow-glows" fill="none" stroke-linecap="round">
          ${Object.entries(PATHS)
            .map(
              ([edge, path]) => `<path data-glow-edge="${edge}" d="${path}" />`,
            )
            .join("")}
        </g>
        <g class="fallback-flow-bodies" fill="none" stroke-linecap="round">
          ${Object.entries(PATHS)
            .map(([edge, path]) => `<path data-edge="${edge}" d="${path}" />`)
            .join("")}
        </g>
        <g class="fallback-flow-highlights" fill="none" stroke-linecap="round">
          ${Object.entries(PATHS)
            .map(
              ([edge, path]) => `<path data-flow-edge="${edge}" d="${path}" />`,
            )
            .join("")}
        </g>
        <g class="fallback-node-halos" fill="#ffffff" opacity="0.13">
          <circle cx="58" cy="150" r="23"/><circle cx="250" cy="78" r="20"/>
          <circle cx="250" cy="222" r="20"/><circle cx="502" cy="150" r="23"/>
        </g>
        <g class="fallback-node-cores" fill="#ffffff">
          <circle cx="58" cy="150" r="14"/><circle cx="250" cy="78" r="12"/>
          <circle cx="250" cy="222" r="12"/><circle cx="502" cy="150" r="14"/>
        </g>
        <g fill="#ffffff" font-family="system-ui" font-size="13" text-anchor="middle">
          <text x="58" y="184">S</text><text x="250" y="48">U</text>
          <text x="250" y="260">V</text><text x="502" y="184">T</text>
        </g>
      </svg>
      <p>WebGL is unavailable, so a native SVG preserves the same guide state, exact route loads, continuous-flow encoding, and journey controls.</p>`;
    this.container.replaceChildren(wrapper);
    wrapper.querySelectorAll<SVGPathElement>("[data-edge]").forEach((path) => {
      this.paths.set(path.dataset.edge as EdgeId, path);
    });
    wrapper
      .querySelectorAll<SVGPathElement>("[data-glow-edge]")
      .forEach((path) => {
        this.glows.set(path.dataset.glowEdge as EdgeId, path);
      });
    wrapper
      .querySelectorAll<SVGPathElement>("[data-flow-edge]")
      .forEach((path) => {
        this.highlights.set(path.dataset.flowEdge as EdgeId, path);
      });
  }

  update(
    snapshot: NetworkPresentation | null,
    shortcutOpen: boolean,
    population: number,
    waiting: boolean,
  ): void {
    this.container.dataset.population = String(population);
    for (const [edge, path] of this.paths) {
      const load = waiting ? 0 : (snapshot?.edgeLoads[edge] ?? 0);
      const role = edgeRole(edge);
      const radius = edgeRadius(load, population);
      const color = edgeColorHex(role, load, population);
      const visible = edge !== "UV" || shortcutOpen;
      const opacity = visible ? edgeOpacity(role, load, population) : 0;
      path.style.strokeWidth = `${Math.max(1.8, radius * 180)}`;
      path.style.stroke = color;
      path.dataset.baseOpacity = String(opacity);
      const glow = this.glows.get(edge);
      if (glow) {
        glow.style.strokeWidth = `${Math.max(4.2, radius * 180 + 4)}`;
        glow.style.stroke = color;
        glow.dataset.baseOpacity = String(opacity * 0.2);
      }
      const highlight = this.highlights.get(edge);
      if (highlight) {
        highlight.style.strokeWidth = `${Math.max(1.2, radius * 46)}`;
        highlight.dataset.baseOpacity = String(visible ? opacity * 0.52 : 0);
      }
    }
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

  private applyHighlight(): void {
    for (const [edge, path] of this.paths) {
      const highlighted =
        this.activeRoute === null || ROUTE_EDGES[this.activeRoute].has(edge);
      for (const element of [
        path,
        this.glows.get(edge),
        this.highlights.get(edge),
      ]) {
        if (!element) continue;
        element.style.filter = highlighted
          ? "brightness(1.14)"
          : "brightness(0.42)";
        const baseOpacity = Number(element.dataset.baseOpacity ?? "1");
        element.style.opacity = String(
          highlighted ? baseOpacity : baseOpacity * 0.2,
        );
      }
    }
  }
}
