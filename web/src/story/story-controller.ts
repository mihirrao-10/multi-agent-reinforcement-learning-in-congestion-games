import type {
  FinalSummary,
  LearnerBlock,
  StoryData,
  StorySnapshot,
} from "../data/story-schema";
import { exactSnapshotAtIndex } from "../data/validation";
import type { NetworkFallback } from "../fallback";
import type { SceneController } from "../scene/scene-controller";
import { createLearnerChart } from "../charts/learner-chart";
import {
  createLearningChart,
  type LearningChartHandle,
} from "../charts/learning-chart";
import { createRouteShareChart } from "../charts/route-share-chart";
import { createScenarioChart } from "../charts/scenario-chart";
import { ChapterObserver } from "./chapter-observer";
import {
  initialStoryState,
  reduceStoryState,
  type FocusTarget,
  type StoryEvent,
  type StoryState,
} from "./state-machine";

interface StoryControllerOptions {
  readonly story: StoryData;
  readonly scene: SceneController | null;
  readonly fallback: NetworkFallback | null;
  readonly reducedMotion: boolean;
}

const requireElement = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element)
    throw new Error(`required interface element is missing: ${selector}`);
  return element;
};

function formatNumber(value: number, digits = 6): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function profileText(counts: readonly number[]): string {
  return `(${counts.join(", ")})`;
}

export class StoryController {
  private readonly story: StoryData;
  private readonly scene: SceneController | null;
  private readonly fallback: NetworkFallback | null;
  private readonly observer: ChapterObserver;
  private readonly learningChart: LearningChartHandle;
  private state: StoryState;
  private animationFrame = 0;
  private previousPlaybackTime = 0;
  private lastAnnouncementKey = "";

  private readonly canvas =
    requireElement<HTMLCanvasElement>("#congestion-canvas");
  private readonly stage = requireElement<HTMLElement>("#stage");
  private readonly caption = requireElement<HTMLElement>("#scene-caption");
  private readonly description =
    requireElement<HTMLElement>("#scene-description");
  private readonly status = requireElement<HTMLElement>("#playback-status");
  private readonly episodeMetric =
    requireElement<HTMLElement>("#metric-episode");
  private readonly routeMetric = requireElement<HTMLElement>("#metric-routes");
  private readonly latencyMetric =
    requireElement<HTMLElement>("#metric-latency");
  private readonly exploitabilityMetric = requireElement<HTMLElement>(
    "#metric-exploitability",
  );
  private readonly playPause = requireElement<HTMLButtonElement>("#play-pause");
  private readonly replay = requireElement<HTMLButtonElement>("#replay");
  private readonly explore = requireElement<HTMLButtonElement>("#explore-view");
  private readonly reset = requireElement<HTMLButtonElement>("#reset-view");
  private readonly focusPrimary =
    requireElement<HTMLButtonElement>("#focus-primary");
  private readonly focusSecondary =
    requireElement<HTMLButtonElement>("#focus-secondary");
  private readonly legend = requireElement<HTMLElement>(".network-legend");

  constructor(options: StoryControllerOptions) {
    this.story = options.story;
    this.scene = options.scene;
    this.fallback = options.fallback;
    this.state = initialStoryState(options.reducedMotion);
    this.populateExactText();
    this.populateMethodology();
    this.populateLearnerTable();
    const openSnapshots =
      this.story.experiments.scenarios["braess-open"].qLearning.representative
        .snapshots;
    const openExact = this.story.exactAnalysis["braess-open"];
    this.learningChart = createLearningChart(
      requireElement("#learning-chart"),
      openSnapshots,
      openExact.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      openExact.socialOptima[0]!.averagePhysicalLatency.decimal,
    );
    createRouteShareChart(requireElement("#route-share-chart"), openSnapshots);
    createScenarioChart(requireElement("#scenario-chart"), this.story);
    createLearnerChart(requireElement("#learner-chart"), this.story);
    this.bindControls();
    const chapters = [
      ...document.querySelectorAll<HTMLElement>(".chapter[data-story-act]"),
    ];
    this.observer = new ChapterObserver(chapters, (chapter) =>
      this.setChapter(chapter),
    );
    this.render(true);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.observer.destroy();
  }

  syncExplore(exploring: boolean): void {
    if (this.state.userExploring !== exploring)
      this.dispatch({ type: "TOGGLE_EXPLORE" });
  }

  markManualInteraction(): void {
    this.dispatch({ type: "FOCUS", target: "manual" });
  }

  exitExplore(): void {
    this.dispatch({ type: "EXIT_EXPLORE" });
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.dispatch({ type: "SET_REDUCED_MOTION", reduced: reducedMotion });
  }

  private dispatch(event: StoryEvent, announce = false): void {
    this.state = reduceStoryState(this.state, event);
    this.render(announce);
  }

  private setChapter(chapter: number): void {
    this.dispatch({ type: "SET_CHAPTER", chapter }, true);
    const snapshots = this.activeSnapshots();
    let index = this.state.snapshotIndex;
    if (chapter === 0 || chapter === 1) index = 0;
    else if (chapter === 2) index = Math.round(snapshots.length * 0.34);
    else if (chapter === 4 || chapter === 5 || chapter === 6 || chapter >= 8) {
      index = snapshots.length - 1;
    } else if (chapter === 7) index = 0;
    this.dispatch({ type: "SET_SNAPSHOT", index });
    if (chapter === 7 && !this.state.reducedMotion)
      this.dispatch({ type: "PLAY" }, true);
  }

  private activeSnapshots(): readonly StorySnapshot[] {
    return this.story.experiments.scenarios[this.state.scenario].qLearning
      .representative.snapshots;
  }

  private activeSnapshot(): StorySnapshot {
    return exactSnapshotAtIndex(
      this.activeSnapshots(),
      this.state.snapshotIndex,
    );
  }

  private render(announce = false): void {
    const snapshots = this.activeSnapshots();
    const snapshot = this.activeSnapshot();
    this.scene?.setState(this.state, snapshot, snapshots.length);
    this.fallback?.update(snapshot, this.state.shortcutOpen);
    this.stage.dataset.storyAct = String(this.state.activeChapter);
    this.stage.dataset.sceneMode = this.state.sceneMode;
    this.stage.dataset.scenario = this.state.scenario;
    this.stage.dataset.learningState = this.state.playback;
    this.stage.dataset.shortcut = this.state.shortcutOpen ? "open" : "closed";
    this.stage.dataset.tolls = this.state.tollsActive ? "active" : "inactive";
    this.stage.dataset.episode = String(snapshot.episode);
    this.stage.dataset.routeCounts = snapshot.routeCounts.join(",");
    this.stage.dataset.focusTarget = this.state.focusTarget;
    this.stage.dataset.userExploring = String(this.state.userExploring);
    this.stage.dataset.reducedMotion = String(this.state.reducedMotion);
    this.stage.dataset.trajectory = this.state.trajectory;
    this.stage.dataset.surface = this.state.tollsActive
      ? "physical-social-cost"
      : "rosenthal-potential";
    this.episodeMetric.textContent = snapshot.episode.toLocaleString();
    const paddedCounts =
      this.state.scenario === "braess-closed"
        ? [...snapshot.routeCounts, 0]
        : snapshot.routeCounts;
    this.routeMetric.textContent = paddedCounts.join(" / ");
    this.latencyMetric.textContent = formatNumber(
      snapshot.averagePhysicalLatency,
    );
    this.exploitabilityMetric.textContent = formatNumber(
      snapshot.exploitability,
    );
    this.playPause.textContent =
      this.state.playback === "playing" ? "Pause learning" : "Play learning";
    this.playPause.setAttribute(
      "aria-pressed",
      String(this.state.playback === "playing"),
    );
    this.explore.textContent = this.state.userExploring
      ? "Exit Explore view"
      : "Explore view";
    this.explore.setAttribute("aria-pressed", String(this.state.userExploring));
    const landscape = this.state.sceneMode === "landscape";
    this.legend.setAttribute(
      "aria-label",
      landscape
        ? "Potential landscape visual encoding"
        : "Network visual encoding",
    );
    this.focusPrimary.textContent = landscape
      ? "Focus equilibrium"
      : "Focus shortcut";
    this.focusSecondary.textContent = landscape
      ? "Focus optimum"
      : "Focus bottleneck";
    this.caption.textContent = this.captionText(snapshot);
    this.description.textContent = this.descriptionText(snapshot);
    this.canvas.setAttribute("aria-label", this.description.textContent);
    if (this.state.scenario === "braess-open")
      this.learningChart.updateCursor(snapshot.episode);
    if (announce) this.announceState(snapshot);
  }

  private captionText(snapshot: StorySnapshot): string {
    if (this.state.sceneMode === "landscape") {
      return this.state.tollsActive
        ? `Tolled potential equals physical social cost. Exact state ${profileText(snapshot.routeCounts)}.`
        : `Rosenthal potential over all 3,321 count states. Active state ${profileText(snapshot.routeCounts)}.`;
    }
    if (!this.state.shortcutOpen) {
      return `Shortcut removed. Exact episode ${snapshot.episode.toLocaleString()}, route split ${profileText(snapshot.routeCounts)}.`;
    }
    if (this.state.tollsActive) {
      return `Marginal-cost tolls active. Exact episode ${snapshot.episode.toLocaleString()}, physical average ${formatNumber(snapshot.averagePhysicalLatency)}.`;
    }
    return `Shortcut open. Exact episode ${snapshot.episode.toLocaleString()}, physical average ${formatNumber(snapshot.averagePhysicalLatency)}.`;
  }

  private descriptionText(snapshot: StorySnapshot): string {
    const mode =
      this.state.sceneMode === "network"
        ? "three-dimensional braided network"
        : "triangular three-dimensional potential landscape";
    const shortcut = this.state.shortcutOpen ? "open" : "removed";
    const tolls = this.state.tollsActive
      ? "marginal-cost tolls active"
      : "no tolls";
    const focus =
      this.state.focusTarget === "equilibrium"
        ? " Focus is on the exact equilibrium."
        : this.state.focusTarget === "optimum"
          ? " Focus is on the exact physical optimum."
          : this.state.focusTarget === "shortcut"
            ? " Focus is on the zero-cost shortcut."
            : this.state.focusTarget === "bottleneck"
              ? " Focus is on the variable-latency bottlenecks."
              : "";
    return `${mode}; shortcut ${shortcut}; ${tolls}; exact route counts ${snapshot.routeCounts.join(", ")}; average physical latency ${formatNumber(snapshot.averagePhysicalLatency)}.${focus}`;
  }

  private announceState(snapshot: StorySnapshot): void {
    const key = `${this.state.activeChapter}:${this.state.sceneMode}:${this.state.scenario}:${Math.floor(this.state.snapshotIndex / Math.max(1, this.activeSnapshots().length / 4))}`;
    if (key === this.lastAnnouncementKey) return;
    this.lastAnnouncementKey = key;
    this.status.textContent = this.descriptionText(snapshot);
  }

  private bindControls(): void {
    this.playPause.addEventListener("click", () => {
      this.dispatch(
        { type: this.state.playback === "playing" ? "PAUSE" : "PLAY" },
        true,
      );
    });
    this.replay.addEventListener("click", () =>
      this.dispatch({ type: "REPLAY" }, true),
    );
    this.explore.addEventListener("click", () => this.scene?.toggleExplore());
    this.reset.addEventListener("click", () => {
      this.scene?.resetView();
      this.dispatch({ type: "RESET_VIEW" });
    });
    this.focusPrimary.addEventListener("click", () => {
      const target: FocusTarget =
        this.state.sceneMode === "landscape" ? "equilibrium" : "shortcut";
      this.dispatch({ type: "FOCUS", target }, true);
      this.scene?.focus(target);
    });
    this.focusSecondary.addEventListener("click", () => {
      const target: FocusTarget =
        this.state.sceneMode === "landscape" ? "optimum" : "bottleneck";
      this.dispatch({ type: "FOCUS", target }, true);
      this.scene?.focus(target);
    });
    requireElement<HTMLButtonElement>("#begin-learning").addEventListener(
      "click",
      () => {
        this.dispatch({ type: "REPLAY" }, true);
        document.querySelector("#q-learning")?.scrollIntoView({
          behavior: this.state.reducedMotion ? "auto" : "smooth",
          block: "center",
        });
      },
    );
    requireElement<HTMLButtonElement>("#replay-experiment").addEventListener(
      "click",
      () => {
        this.dispatch({ type: "SET_CHAPTER", chapter: 0 }, true);
        this.dispatch({ type: "REPLAY" });
        document.querySelector("#arrival")?.scrollIntoView({
          behavior: this.state.reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      },
    );
    document
      .querySelectorAll<HTMLButtonElement>("[data-route-focus]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const route = button.dataset.routeFocus;
          if (route === "U" || route === "L" || route === "Z") {
            this.scene?.highlightRoute(route);
            this.fallback?.highlightRoute(route);
            this.stage.dataset.routeHighlight = route;
            this.caption.textContent = `${button.textContent?.trim() ?? route} highlighted as one complete route action.`;
          }
        });
      });
  }

  private readonly tick = (timestamp: number): void => {
    this.animationFrame = requestAnimationFrame(this.tick);
    if (this.state.playback !== "playing") {
      this.previousPlaybackTime = timestamp;
      return;
    }
    const interval = this.state.reducedMotion ? 700 : 78;
    if (timestamp - this.previousPlaybackTime < interval) return;
    this.previousPlaybackTime = timestamp;
    const snapshots = this.activeSnapshots();
    const step = this.state.reducedMotion
      ? Math.max(1, Math.floor(snapshots.length / 7))
      : 1;
    const next = this.state.snapshotIndex + step;
    if (next >= snapshots.length - 1) {
      this.dispatch({ type: "SET_SNAPSHOT", index: snapshots.length - 1 });
      this.dispatch({ type: "COMPLETE" }, true);
      return;
    }
    this.dispatch({ type: "SET_SNAPSHOT", index: next });
    const quarter = Math.floor(next / Math.max(1, snapshots.length / 4));
    if (
      quarter > Math.floor((next - step) / Math.max(1, snapshots.length / 4))
    ) {
      this.announceState(this.activeSnapshot());
    }
  };

  private populateExactText(): void {
    const open = this.story.exactAnalysis["braess-open"];
    const closed = this.story.exactAnalysis["braess-closed"];
    const tolled = this.story.exactAnalysis["braess-tolled"];
    const values: Record<string, string> = {
      "open-equilibrium-counts": profileText(
        open.pureNashEquilibria[0]!.routeCounts,
      ),
      "open-equilibrium-average": formatNumber(
        open.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      ),
      "open-equilibrium-cost": formatNumber(
        open.pureNashEquilibria[0]!.physicalSocialCost.decimal,
      ),
      "open-equilibrium-exploitability": formatNumber(
        open.pureNashEquilibria[0]!.exploitability.decimal,
      ),
      "open-optimum-counts": profileText(open.socialOptima[0]!.routeCounts),
      "open-optimum-average": formatNumber(
        open.socialOptima[0]!.averagePhysicalLatency.decimal,
      ),
      "open-optimum-cost": formatNumber(
        open.socialOptima[0]!.physicalSocialCost.decimal,
      ),
      "open-poa-fraction": open.priceOfAnarchy.fraction,
      "open-poa-decimal": formatNumber(open.priceOfAnarchy.decimal),
      "closed-equilibrium-counts": profileText(
        closed.pureNashEquilibria[0]!.routeCounts,
      ),
      "closed-equilibrium-average": formatNumber(
        closed.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      ),
      "closed-equilibrium-cost": formatNumber(
        closed.pureNashEquilibria[0]!.physicalSocialCost.decimal,
      ),
      "tolled-equilibrium-counts": profileText(
        tolled.pureNashEquilibria[0]!.routeCounts,
      ),
    };
    document
      .querySelectorAll<HTMLElement>("[data-exact]")
      .forEach((element) => {
        element.textContent = values[element.dataset.exact ?? ""] ?? "";
      });
  }

  private populateMethodology(): void {
    const configuration = this.story.experiments.configuration;
    const q = configuration.qLearning as Record<string, unknown>;
    const values: [string, string][] = [
      ["schema", this.story.schemaVersion],
      ["agents", String(configuration.agents)],
      ["Q-learning seeds per scenario", String(configuration.seedCount)],
      ["episodes", String(q.episodes)],
      ["alpha", String(q.alpha)],
      ["epsilon floor", String(q.epsilonFloor)],
      ["generator", String(this.story.seedPolicy.bitGenerator)],
      [
        "landscape vertices",
        this.story.potentialLandscape.vertices.length.toLocaleString(),
      ],
    ];
    const list = requireElement<HTMLDListElement>("#methodology-list");
    list.replaceChildren(
      ...values.map(([label, value]) => {
        const row = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = label;
        const definition = document.createElement("dd");
        definition.textContent = value;
        row.append(term, definition);
        return row;
      }),
    );
  }

  private populateLearnerTable(): void {
    const block = this.story.experiments.scenarios["braess-tolled"];
    const rows: [string, LearnerBlock, string][] = [
      [
        "independent Q-learning",
        block.qLearning,
        "empirical epsilon-zero greedy evaluation",
      ],
      [
        "strict best response",
        block.bestResponse,
        "exact potential descent to pure Nash",
      ],
      [
        "full-information Hedge",
        block.hedge,
        "external-regret control, not last-iterate Nash",
      ],
    ];
    const body = requireElement<HTMLTableSectionElement>(
      "#learner-table tbody",
    );
    body.replaceChildren(
      ...rows.map(([name, learner, statement]) =>
        this.learnerRow(name, learner.representative.summary, statement),
      ),
    );
  }

  private learnerRow(
    name: string,
    summary: FinalSummary,
    statement: string,
  ): HTMLTableRowElement {
    const row = document.createElement("tr");
    const values = [
      name,
      profileText(summary.finalGreedyRouteCounts),
      formatNumber(summary.physicalSocialCost),
      formatNumber(summary.exploitability),
      statement,
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }
}
