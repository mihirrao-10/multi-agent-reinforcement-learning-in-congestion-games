import type { StorySnapshot } from "./data/story-schema";

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

function radius(load: number): number {
  return 2.2 + 9 * Math.sqrt(load / 80);
}

export class NetworkFallback {
  private readonly container: HTMLElement;
  private paths = new Map<string, SVGPathElement>();
  private activeRoute: keyof typeof ROUTE_EDGES | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.hidden = false;
    const wrapper = document.createElement("div");
    wrapper.className = "fallback-network";
    wrapper.innerHTML = `
      <svg viewBox="0 0 560 300" role="img" aria-labelledby="fallback-title fallback-desc">
        <title id="fallback-title">Braess network fallback</title>
        <desc id="fallback-desc">Four nodes and five directed edges show exact route loads without WebGL.</desc>
        <g fill="none" stroke-linecap="round">
          ${Object.entries(PATHS)
            .map(([edge, path]) => `<path data-edge="${edge}" d="${path}" />`)
            .join("")}
        </g>
        <g fill="#f5f5f5" stroke="#000" stroke-width="3">
          <circle cx="58" cy="150" r="10"/><circle cx="250" cy="78" r="9"/>
          <circle cx="250" cy="222" r="9"/><circle cx="502" cy="150" r="10"/>
        </g>
        <g fill="#f5f5f5" font-family="system-ui" font-size="13" text-anchor="middle">
          <text x="58" y="178">S</text><text x="250" y="52">U</text>
          <text x="250" y="256">V</text><text x="502" y="178">T</text>
        </g>
      </svg>
      <p>WebGL is unavailable, so a native SVG preserves the exact network, route loads, and principal metrics.</p>`;
    this.container.replaceChildren(wrapper);
    wrapper.querySelectorAll<SVGPathElement>("[data-edge]").forEach((path) => {
      this.paths.set(path.dataset.edge!, path);
    });
  }

  update(snapshot: StorySnapshot, shortcutOpen: boolean): void {
    for (const [edge, path] of this.paths) {
      const load = snapshot.edgeLoads[edge] ?? 0;
      path.style.strokeWidth = `${radius(load)}`;
      if (edge === "UV") {
        path.style.stroke = "#ffd38a";
        path.dataset.baseOpacity = shortcutOpen ? "1" : "0.08";
      } else if (edge === "UT" || edge === "SV") {
        path.style.stroke = "#f4b942";
        path.dataset.baseOpacity = "1";
      } else {
        const heat = Math.min(1, load / 80);
        path.style.stroke =
          heat > 0.75 ? "#ff3030" : heat > 0.45 ? "#ff7a3d" : "#2cd67b";
        path.dataset.baseOpacity = "1";
      }
    }
    this.applyHighlight();
  }

  highlightRoute(route: keyof typeof ROUTE_EDGES): void {
    this.activeRoute = route;
    this.container.dataset.routeHighlight = route;
    this.applyHighlight();
  }

  private applyHighlight(): void {
    for (const [edge, path] of this.paths) {
      const highlighted =
        this.activeRoute === null || ROUTE_EDGES[this.activeRoute].has(edge);
      path.style.filter = highlighted ? "brightness(1.18)" : "brightness(0.42)";
      const baseOpacity = Number(path.dataset.baseOpacity ?? "1");
      path.style.opacity = String(
        highlighted ? baseOpacity : baseOpacity * 0.24,
      );
    }
  }
}
