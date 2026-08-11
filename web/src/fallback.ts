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
  private readonly networkView: HTMLElement;
  private readonly landscapeView: HTMLElement;
  private readonly landscapeTitle: SVGTitleElement;
  private readonly landscapeDescription: SVGDescElement;
  private readonly descentPath: SVGPathElement;
  private readonly learningPath: SVGPathElement;
  private readonly equilibriumMarker: SVGElement;
  private readonly optimumMarker: SVGElement;
  private readonly landscapeCopy: HTMLElement;
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
      <div class="fallback-network-view">
      <svg viewBox="0 0 560 300" role="img" aria-labelledby="fallback-title fallback-desc">
        <title id="fallback-title">Braess highway network fallback</title>
        <desc id="fallback-desc">Four glowing white nodes and five continuous translucent flows preserve traffic share color and thickness without WebGL.</desc>
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
      <p>WebGL is unavailable, so a native SVG preserves the same guide state, exact route loads, continuous flow encoding, and journey controls.</p>
      </div>
      <div class="fallback-landscape-view" hidden>
        <svg viewBox="0 0 560 300" role="img" aria-labelledby="fallback-landscape-title fallback-landscape-desc">
          <title id="fallback-landscape-title">Potential landscape fallback</title>
          <desc id="fallback-landscape-desc">A triangular amber potential surface with exact equilibrium and optimum markers.</desc>
          <defs>
            <linearGradient id="fallback-surface-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#30120b"/>
              <stop offset="0.55" stop-color="#b94f27"/>
              <stop offset="1" stop-color="#f4b15f"/>
            </linearGradient>
            <marker id="fallback-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd38a"/>
            </marker>
          </defs>
          <path class="fallback-landscape-surface" d="M 64 238 L 280 38 L 504 238 Z"/>
          <g class="fallback-landscape-grid" fill="none">
            <path d="M 99 205 Q 280 164 468 205"/>
            <path d="M 136 171 Q 280 137 430 171"/>
            <path d="M 174 136 Q 280 112 392 136"/>
            <path d="M 214 100 Q 280 88 353 100"/>
            <path d="M 64 238 Q 205 176 280 38"/>
            <path d="M 174 238 Q 242 155 280 38"/>
            <path d="M 394 238 Q 329 155 280 38"/>
            <path d="M 504 238 Q 365 176 280 38"/>
          </g>
          <path data-fallback-learning d="M 283 171 C 260 157 300 145 278 131 S 296 105 279 91 S 288 65 280 49"/>
          <path data-fallback-descent d="M 283 171 C 291 153 272 143 283 127 S 274 104 282 88 S 276 69 280 54" marker-end="url(#fallback-arrow)"/>
          <path data-fallback-equilibrium data-route-share="0,0,1" d="M 280 27 L 291 38 L 280 49 L 269 38 Z"/>
          <circle data-fallback-optimum data-route-share="0.5,0.5,0" cx="284" cy="238" r="12"/>
          <g class="fallback-landscape-labels">
            <text x="64" y="266">all Upper</text>
            <text x="280" y="24" text-anchor="middle">all Shortcut</text>
            <text x="504" y="266" text-anchor="end">all Lower</text>
          </g>
        </svg>
        <p data-fallback-landscape-copy>A schematic SVG preserves the active potential, exact markers, and path meaning without WebGL.</p>
      </div>`;
    this.container.replaceChildren(wrapper);
    this.networkView = wrapper.querySelector<HTMLElement>(
      ".fallback-network-view",
    )!;
    this.landscapeView = wrapper.querySelector<HTMLElement>(
      ".fallback-landscape-view",
    )!;
    this.landscapeTitle = wrapper.querySelector<SVGTitleElement>(
      "#fallback-landscape-title",
    )!;
    this.landscapeDescription = wrapper.querySelector<SVGDescElement>(
      "#fallback-landscape-desc",
    )!;
    this.descentPath = wrapper.querySelector<SVGPathElement>(
      "[data-fallback-descent]",
    )!;
    this.learningPath = wrapper.querySelector<SVGPathElement>(
      "[data-fallback-learning]",
    )!;
    this.equilibriumMarker = wrapper.querySelector<SVGElement>(
      "[data-fallback-equilibrium]",
    )!;
    this.optimumMarker = wrapper.querySelector<SVGElement>(
      "[data-fallback-optimum]",
    )!;
    this.landscapeCopy = wrapper.querySelector<HTMLElement>(
      "[data-fallback-landscape-copy]",
    )!;
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

  setMode(
    mode: "network" | "landscape",
    trajectory: "q-learning" | "best-response",
    tolled: boolean,
  ): void {
    const landscape = mode === "landscape";
    this.networkView.hidden = landscape;
    this.landscapeView.hidden = !landscape;
    this.container.dataset.sceneMode = mode;
    this.container.dataset.trajectory = trajectory;
    this.container.dataset.tolls = tolled ? "active" : "inactive";
    this.descentPath.style.display =
      trajectory === "best-response" ? "" : "none";
    this.learningPath.style.display =
      trajectory !== "best-response" && !tolled ? "" : "none";
    this.equilibriumMarker.style.display = tolled ? "none" : "";
    this.optimumMarker.style.display = "";
    if (tolled) {
      this.landscapeTitle.textContent = "Tolled potential landscape fallback";
      this.landscapeDescription.textContent =
        "A triangular potential surface where the ring marks an exact tolled equilibrium that is also socially optimal.";
      this.landscapeCopy.textContent =
        "The ring marks the exact tolled equilibrium and social optimum; the SVG is a schematic fallback for the potential surface.";
    } else if (trajectory === "best-response") {
      this.landscapeTitle.textContent = "Strict improvement path fallback";
      this.landscapeDescription.textContent =
        "A triangular Rosenthal potential surface with an arrowed strict improvement path toward a Nash equilibrium.";
      this.landscapeCopy.textContent =
        "The arrowed path shows a strict improvement sequence toward the exact equilibrium diamond.";
    } else {
      this.landscapeTitle.textContent = "Learning path fallback";
      this.landscapeDescription.textContent =
        "A triangular Rosenthal potential surface with a pale learning path and exact equilibrium diamond.";
      this.landscapeCopy.textContent =
        "The pale path is the exported learning trace; the diamond marks an exact Nash equilibrium.";
    }
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
