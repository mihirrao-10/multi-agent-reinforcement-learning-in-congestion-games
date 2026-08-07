import { createLearnerChart } from "../charts/learner-chart";
import {
  createLearningChart,
  type LearningChartHandle,
} from "../charts/learning-chart";
import { createRouteShareChart } from "../charts/route-share-chart";
import { createScenarioChart } from "../charts/scenario-chart";
import { loadPopulationBundle } from "../data/story-data";
import type {
  FinalSummary,
  NetworkPresentation,
  Population,
  PopulationBundle,
  ScenarioId,
  StoryManifest,
  StorySnapshot,
} from "../data/story-schema";
import { exactSnapshotAtIndex } from "../data/validation";
import type { NetworkFallback } from "../fallback";
import type { SceneController } from "../scene/scene-controller";
import { ChapterObserver } from "./chapter-observer";
import {
  conceptVisibility,
  initialJourneyState,
  reduceJourneyState,
  type JourneyEvent,
  type JourneyState,
} from "./journey-state";
import {
  initialStoryState,
  reduceStoryState,
  type FocusTarget,
  type StoryEvent,
  type StoryState,
} from "./state-machine";

interface StoryControllerOptions {
  readonly manifest: StoryManifest;
  readonly bundle: PopulationBundle;
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

function scenarioForAct(act: number): ScenarioId {
  if (act === 6) return "braess-closed";
  if (act >= 7) return "braess-tolled";
  return "braess-open";
}

export class StoryController {
  private readonly manifest: StoryManifest;
  private bundle: PopulationBundle;
  private comparisonBundle: PopulationBundle | null = null;
  private comparisonRequest: Promise<void> | null = null;
  private readonly scene: SceneController | null;
  private readonly fallback: NetworkFallback | null;
  private readonly observer: ChapterObserver;
  private journey: JourneyState;
  private visual: StoryState;
  private learningChart: LearningChartHandle | null = null;
  private animationFrame = 0;
  private previousPlaybackTime = 0;
  private populationRequest = 0;
  private lastAnnouncementKey = "";

  private readonly opening = requireElement<HTMLElement>("#opening-screen");
  private readonly main = requireElement<HTMLElement>("#story");
  private readonly startButton =
    requireElement<HTMLButtonElement>("#start-journey");
  private readonly preparation = requireElement<HTMLElement>(
    "#preparation-status",
  );
  private readonly stage = requireElement<HTMLElement>("#stage");
  private readonly canvas =
    requireElement<HTMLCanvasElement>("#congestion-canvas");
  private readonly caption = requireElement<HTMLElement>("#scene-caption");
  private readonly description =
    requireElement<HTMLElement>("#scene-description");
  private readonly playbackStatus =
    requireElement<HTMLElement>("#playback-status");
  private readonly chapterStatus =
    requireElement<HTMLElement>("#chapter-status");
  private readonly stageMetrics = requireElement<HTMLElement>("#stage-metrics");
  private readonly episodeMetric =
    requireElement<HTMLElement>("#metric-episode");
  private readonly routeMetric = requireElement<HTMLElement>("#metric-routes");
  private readonly latencyMetric =
    requireElement<HTMLElement>("#metric-latency");
  private readonly exploitabilityMetric = requireElement<HTMLElement>(
    "#metric-exploitability",
  );
  private readonly playPause = requireElement<HTMLButtonElement>("#play-pause");
  private readonly contextualPlayback = requireElement<HTMLElement>(
    "#contextual-playback",
  );
  private readonly explore = requireElement<HTMLButtonElement>("#explore-view");
  private readonly reset = requireElement<HTMLButtonElement>("#reset-view");
  private readonly focusPrimary =
    requireElement<HTMLButtonElement>("#focus-primary");
  private readonly focusSecondary =
    requireElement<HTMLButtonElement>("#focus-secondary");
  private readonly legend = requireElement<HTMLElement>("#network-legend");
  private readonly directionalPathLegend = requireElement<HTMLElement>(
    "#directional-path-legend",
  );
  private readonly populationLoading = requireElement<HTMLElement>(
    "#population-loading",
  );
  private readonly learningStudyNote = requireElement<HTMLElement>(
    "#learning-study-note",
  );
  private readonly runLearning =
    requireElement<HTMLButtonElement>("#run-learning");
  private readonly runAgain = requireElement<HTMLButtonElement>("#run-again");
  private readonly learningResults =
    requireElement<HTMLElement>("#learning-results");
  private readonly learningSummary = requireElement<HTMLElement>(
    "#learning-complete-summary",
  );

  constructor(options: StoryControllerOptions) {
    this.manifest = options.manifest;
    this.bundle = options.bundle;
    this.journey = initialJourneyState(options.bundle.population);
    if (
      options.bundle.population === options.manifest.comparisonPopulation &&
      options.bundle.comparison
    ) {
      this.comparisonBundle = options.bundle;
    }
    this.scene = options.scene;
    this.fallback = options.fallback;
    this.visual = initialStoryState(
      options.reducedMotion,
      options.bundle.population,
    );
    this.bindControls();
    const chapters = [
      ...document.querySelectorAll<HTMLElement>(".chapter[data-story-act]"),
    ];
    this.observer = new ChapterObserver(chapters, (act) =>
      this.activateAct(act),
    );
    this.populateBundleContent();
    document.body.dataset.bundlePopulation = String(this.bundle.population);
    this.render();
    this.startButton.disabled = false;
    this.preparation.remove();
    document.body.dataset.storyReady = "true";
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    this.observer.destroy();
    window.removeEventListener("keydown", this.guardLockedNavigation);
    window.removeEventListener("hashchange", this.guardHashNavigation);
  }

  syncExplore(exploring: boolean): void {
    if (this.visual.userExploring !== exploring) {
      this.dispatchVisual({ type: "TOGGLE_EXPLORE" });
    }
  }

  markManualInteraction(): void {
    this.dispatchVisual({ type: "FOCUS", target: "manual" });
  }

  exitExplore(): void {
    this.dispatchVisual({ type: "EXIT_EXPLORE" });
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.dispatchVisual({ type: "SET_REDUCED_MOTION", reduced: reducedMotion });
  }

  private dispatchJourney(event: JourneyEvent): void {
    this.journey = reduceJourneyState(this.journey, event);
  }

  private dispatchVisual(event: StoryEvent, announce = false): void {
    this.visual = reduceStoryState(this.visual, event);
    this.render(announce);
  }

  private startJourney(): void {
    if (this.journey.started) return;
    this.clearHash();
    this.dispatchJourney({ type: "START" });
    this.opening.hidden = true;
    this.main.hidden = false;
    document.body.classList.remove("journey-locked");
    document.body.dataset.journeyStarted = "true";
    window.scrollTo({ top: 0, behavior: "auto" });
    this.observer.refresh();
    this.render(true);
  }

  private activateAct(act: number): void {
    if (!this.journey.started || act > this.journey.maxUnlockedAct) return;
    this.dispatchJourney({ type: "SET_ACTIVE_ACT", act });
    this.visual = reduceStoryState(this.visual, {
      type: "SET_CHAPTER",
      chapter: act,
    });
    if (act >= 4 && this.journey.learningCompleted) {
      const snapshots = this.learningSnapshots("braess-open");
      this.visual = reduceStoryState(this.visual, {
        type: "SET_SNAPSHOT",
        index: snapshots.length - 1,
      });
    }
    this.render(true);
    if (act >= 8) void this.ensureComparison();
  }

  private proceed(fromAct: number): void {
    if (
      fromAct !== this.journey.activeAct ||
      fromAct > this.journey.maxUnlockedAct
    )
      return;
    const before = this.journey.maxUnlockedAct;
    this.dispatchJourney({ type: "PROCEED" });
    if (this.journey.maxUnlockedAct === before) return;
    const next = this.journey.maxUnlockedAct;
    const chapter = requireElement<HTMLElement>(`[data-story-act="${next}"]`);
    chapter.hidden = false;
    this.activateAct(next);
    const title =
      chapter.querySelector<HTMLElement>("h2, h1")?.textContent?.trim() ??
      "Next chapter";
    this.chapterStatus.textContent = `${title} unlocked.`;
    this.observer.refresh();
    chapter.scrollIntoView({
      behavior: this.visual.reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }

  private startLearning(replay = false): void {
    if (this.journey.activeAct !== 3) return;
    this.dispatchJourney({ type: "START_LEARNING" });
    this.visual = reduceStoryState(this.visual, {
      type: replay ? "REPLAY" : "PLAY",
    });
    this.visual = reduceStoryState(this.visual, {
      type: "SET_SNAPSHOT",
      index: 0,
    });
    this.learningSummary.textContent = "";
    this.render(true);
  }

  private completeLearning(): void {
    this.dispatchJourney({ type: "COMPLETE_LEARNING" });
    this.visual = reduceStoryState(this.visual, { type: "COMPLETE" });
    const snapshot = this.activeLearningSnapshot();
    this.learningSummary.textContent =
      `The exported learning path finishes at ${profileText(snapshot.routeCounts)}, with average latency ${formatNumber(snapshot.averagePhysicalLatency)} minutes. ${this.studyDisclosure()}`.trim();
    this.playbackStatus.textContent = this.learningSummary.textContent;
    this.render();
  }

  private async selectPopulation(population: Population): Promise<void> {
    if (
      population === this.bundle.population &&
      !this.populationLoading.textContent
    )
      return;
    const request = ++this.populationRequest;
    this.populationLoading.textContent = `Loading the ${population.toLocaleString()}-commuter study...`;
    this.setPopulationButtonsDisabled(true);
    try {
      const bundle = await loadPopulationBundle(population);
      if (request !== this.populationRequest) return;
      this.bundle = bundle;
      if (
        bundle.population === this.manifest.comparisonPopulation &&
        bundle.comparison
      ) {
        this.comparisonBundle = bundle;
      }
      this.scene?.setBundle(bundle);
      this.dispatchJourney({ type: "SELECT_POPULATION", population });
      this.visual = reduceStoryState(this.visual, {
        type: "SET_POPULATION",
        population,
      });
      const targetAct = this.journey.activeAct;
      this.dispatchJourney({ type: "SET_ACTIVE_ACT", act: targetAct });
      this.visual = reduceStoryState(this.visual, {
        type: "SET_CHAPTER",
        chapter: targetAct,
      });
      this.clearRouteHighlight();
      this.populateBundleContent();
      document.body.dataset.bundlePopulation = String(population);
      this.populationLoading.textContent = "";
      this.playbackStatus.textContent = `${population.toLocaleString()} commuters selected. ${this.studyDisclosure()} The current chapter is preserved.`;
      this.render();
      if (targetAct === 3) {
        requireElement<HTMLElement>("#q-learning").scrollIntoView({
          behavior: this.visual.reducedMotion ? "auto" : "smooth",
          block: "center",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown data error";
      this.populationLoading.textContent = `Could not load: ${message}`;
    } finally {
      if (request === this.populationRequest)
        this.setPopulationButtonsDisabled(false);
    }
  }

  private learningSnapshots(scenario: ScenarioId): readonly StorySnapshot[] {
    return this.bundle.learning.scenarios[scenario].representative.snapshots;
  }

  private activeLearningSnapshot(): StorySnapshot {
    return exactSnapshotAtIndex(
      this.learningSnapshots(this.visual.scenario),
      this.visual.snapshotIndex,
    );
  }

  private activePresentation(): NetworkPresentation | null {
    if (this.journey.activeAct <= 3) {
      if (!this.journey.learningStarted || this.visual.waiting) return null;
      return this.activeLearningSnapshot();
    }
    if (this.journey.activeAct === 4) {
      return this.activeLearningSnapshot();
    }
    if (this.journey.activeAct === 5) {
      return this.bundle.scenarioStates["braess-open"].equilibrium;
    }
    const scenario = scenarioForAct(this.journey.activeAct);
    return this.bundle.scenarioStates[scenario].equilibrium;
  }

  private render(announce = false): void {
    const presentation = this.activePresentation();
    const sceneState: StoryState = {
      ...this.visual,
      activeChapter: this.journey.activeAct,
      population: this.bundle.population,
      waiting: presentation === null,
    };
    const snapshots = this.learningSnapshots(sceneState.scenario);
    this.scene?.setState(sceneState, presentation, snapshots.length);
    this.fallback?.update(
      presentation,
      sceneState.shortcutOpen,
      this.bundle.population,
      presentation === null,
    );
    this.renderDataAttributes(sceneState, presentation);
    this.renderControls(sceneState);
    this.renderMetrics(presentation);
    this.renderCaption(presentation);
    if (
      presentation &&
      "episode" in presentation &&
      sceneState.scenario === "braess-open"
    ) {
      this.learningChart?.updateCursor(presentation.episode);
    }
    if (announce) this.announceState(presentation);
  }

  private renderDataAttributes(
    state: StoryState,
    presentation: NetworkPresentation | null,
  ): void {
    this.stage.dataset.storyAct = String(this.journey.activeAct);
    this.stage.dataset.maxUnlockedAct = String(this.journey.maxUnlockedAct);
    this.stage.dataset.sceneMode = state.sceneMode;
    this.stage.dataset.scenario = state.scenario;
    this.stage.dataset.learningState = this.journey.learningStarted
      ? state.playback
      : "not-started";
    this.stage.dataset.shortcut = state.shortcutOpen ? "open" : "closed";
    this.stage.dataset.tolls = state.tollsActive ? "active" : "inactive";
    this.stage.dataset.episode =
      presentation && "episode" in presentation
        ? String(presentation.episode)
        : "";
    this.stage.dataset.routeCounts = presentation
      ? presentation.routeCounts.join(",")
      : "waiting";
    this.stage.dataset.population = String(this.bundle.population);
    this.stage.dataset.flowRendering = "continuous-tubes";
    this.stage.dataset.learningStudyKind =
      this.bundle.learningStudy.learningStudyKind;
    this.stage.dataset.representedPopulation = String(
      this.bundle.learningStudy.representedPopulation,
    );
    this.stage.dataset.simulatedLearners = String(
      this.bundle.learningStudy.simulatedLearners,
    );
    this.stage.dataset.presentationState = presentation
      ? "snapshot"
      : "waiting";
    this.stage.dataset.focusTarget = state.focusTarget;
    this.stage.dataset.userExploring = String(state.userExploring);
    this.stage.dataset.reducedMotion = String(state.reducedMotion);
    this.stage.dataset.trajectory = state.trajectory;
    this.stage.dataset.surface = state.tollsActive
      ? "physical-social-cost"
      : "rosenthal-potential";
  }

  private renderControls(state: StoryState): void {
    const concepts = conceptVisibility(this.journey);
    this.explore.textContent = state.userExploring
      ? "Exit Explore view"
      : "Explore view";
    this.explore.setAttribute("aria-pressed", String(state.userExploring));
    const landscape = state.sceneMode === "landscape";
    this.focusPrimary.hidden = this.journey.activeAct < 1;
    this.focusSecondary.hidden = this.journey.activeAct < 2;
    this.focusPrimary.textContent = landscape
      ? "Focus equilibrium"
      : "Focus shortcut";
    this.focusSecondary.textContent = landscape
      ? "Focus optimum"
      : "Focus bottleneck";
    this.legend.hidden = !(
      concepts.networkEncoding || concepts.landscapeLegend
    );
    this.legend.setAttribute(
      "aria-label",
      landscape
        ? "Potential landscape visual encoding"
        : "Network visual encoding",
    );
    this.directionalPathLegend.hidden = !(
      landscape && state.trajectory === "best-response"
    );
    const learningInProgress =
      this.journey.learningStarted && !this.journey.learningCompleted;
    this.contextualPlayback.hidden = !learningInProgress;
    this.playPause.textContent =
      state.playback === "playing" ? "Pause learning" : "Resume learning";
    this.playPause.setAttribute(
      "aria-pressed",
      String(state.playback === "playing"),
    );
    this.runLearning.hidden = this.journey.learningStarted;
    this.runAgain.hidden = !this.journey.learningCompleted;
    this.learningResults.hidden = !this.journey.learningStarted;
    const learningProceed = requireElement<HTMLButtonElement>(
      '[data-proceed-act="3"]',
    );
    learningProceed.hidden = !this.journey.learningCompleted;
    this.runLearning.textContent = this.isSampledStudy()
      ? `Run sampled learning path for ${this.bundle.population.toLocaleString()} commuters`
      : `Run learning with ${this.bundle.population.toLocaleString()} commuters`;
    document
      .querySelectorAll<HTMLButtonElement>("button[data-population]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(Number(button.dataset.population) === this.bundle.population),
        ),
      );
  }

  private renderMetrics(presentation: NetworkPresentation | null): void {
    const concepts = conceptVisibility(this.journey);
    const hasPresentation = presentation !== null;
    const episodeVisible =
      hasPresentation && "episode" in presentation && concepts.learningMetrics;
    const routesVisible =
      hasPresentation &&
      (concepts.learningMetrics || this.journey.activeAct >= 5);
    const latencyVisible =
      hasPresentation &&
      (concepts.learningMetrics || this.journey.activeAct >= 5);
    const exploitabilityVisible = hasPresentation && concepts.exploitability;
    const visibility: Record<string, boolean> = {
      episode: episodeVisible,
      routes: routesVisible,
      latency: latencyVisible,
      exploitability: exploitabilityVisible,
    };
    Object.entries(visibility).forEach(([metric, visible]) => {
      const row = requireElement<HTMLElement>(`[data-metric="${metric}"]`);
      row.hidden = !visible;
    });
    this.stageMetrics.hidden = !Object.values(visibility).some(Boolean);
    if (!presentation) return;
    this.episodeMetric.textContent =
      "episode" in presentation ? presentation.episode.toLocaleString() : "";
    const padded =
      presentation.routeCounts.length === 2
        ? [...presentation.routeCounts, 0]
        : presentation.routeCounts;
    this.routeMetric.textContent = padded
      .map((count) => count.toLocaleString())
      .join(" / ");
    this.latencyMetric.textContent = `${formatNumber(
      presentation.averagePhysicalLatency,
    )} minutes`;
    this.exploitabilityMetric.textContent = `${formatNumber(
      presentation.exploitability,
    )} minutes`;
  }

  private renderCaption(presentation: NetworkPresentation | null): void {
    if (!presentation) {
      this.caption.textContent =
        "The highway network is ready. No commuting day has been simulated yet.";
      this.description.textContent = `${this.bundle.population.toLocaleString()} commuters are represented at source S. Every road is at guide thickness, no route profile has been applied, and no episode or route metric exists yet. Road width, color, and opacity will show traffic share, while moving light will show direction.`;
    } else if (this.visual.sceneMode === "landscape") {
      const sampled =
        this.bundle.potentialLandscape.sampling.mode !==
        "complete-count-lattice";
      this.caption.textContent = this.visual.tollsActive
        ? `Tolled potential equals physical social cost. The marker uses exact profile ${profileText(presentation.routeCounts)}.`
        : this.visual.trajectory === "best-response"
          ? `${sampled ? "A sampled view of" : ""} Rosenthal potential. The arrows point toward decreasing potential.`
          : `${sampled ? "A sampled view of" : ""} Rosenthal potential. The pale Q-learning trace is not monotone.`;
      this.description.textContent = `Potential landscape for ${this.bundle.population.toLocaleString()} commuters. Active exact profile ${profileText(presentation.routeCounts)}. ${this.bundle.potentialLandscape.sampling.statement} ${this.studyDisclosure()}`;
    } else if (!this.visual.shortcutOpen) {
      this.caption.textContent = `The shortcut is unavailable. Upper and Lower split all ${this.bundle.population.toLocaleString()} commuters at equilibrium.`;
      this.description.textContent = `Shortcut removed. Exact equilibrium route counts ${presentation.routeCounts.join(", ")}, average latency ${formatNumber(presentation.averagePhysicalLatency)} minutes. Thicker and redder flow carries a larger traffic share.`;
    } else if (this.visual.tollsActive) {
      this.caption.textContent = `The shortcut is restored. Toll rings change private cost, while road color and thickness still show traffic share.`;
      this.description.textContent = `Marginal-cost tolls active for ${this.bundle.population.toLocaleString()} commuters. Exact equilibrium ${profileText(presentation.routeCounts)}, physical average latency ${formatNumber(presentation.averagePhysicalLatency)} minutes. Continuous light moves from each road's source toward its target.`;
    } else {
      const episode =
        "episode" in presentation
          ? ` Episode ${presentation.episode.toLocaleString()}.`
          : "";
      this.caption.textContent = `${this.isSampledStudy() ? "Learning path estimated from 10,000 independently simulated commuters" : `Learning uses an exported full-population path for ${this.bundle.population.toLocaleString()} commuters`}.${episode}`;
      this.description.textContent = `The network represents ${this.bundle.population.toLocaleString()} commuters. Shortcut open. Route counts ${presentation.routeCounts.join(", ")}; average physical latency ${formatNumber(presentation.averagePhysicalLatency)} minutes.${episode} Thin green flow means a smaller traffic share, thick red flow means a larger traffic share, and broad moving light shows direction. The central shortcut has zero direct latency. ${this.studyDisclosure()}`;
    }
    this.canvas.setAttribute("aria-label", this.description.textContent);
  }

  private announceState(presentation: NetworkPresentation | null): void {
    const key = `${this.journey.activeAct}:${this.bundle.population}:${this.visual.sceneMode}:${presentation ? presentation.routeCounts.join(",") : "waiting"}`;
    if (key === this.lastAnnouncementKey) return;
    this.lastAnnouncementKey = key;
    this.playbackStatus.textContent = this.description.textContent;
  }

  private populateBundleContent(): void {
    const population = this.bundle.population;
    document
      .querySelectorAll<HTMLElement>("[data-population-text]")
      .forEach(
        (element) => (element.textContent = population.toLocaleString()),
      );
    const open = this.bundle.exactAnalysis["braess-open"];
    const closed = this.bundle.exactAnalysis["braess-closed"];
    const tolled = this.bundle.exactAnalysis["braess-tolled"];
    const values: Record<string, string> = {
      "open-equilibrium-counts": profileText(
        open.pureNashEquilibria[0]!.routeCounts,
      ),
      "open-equilibrium-set": open.pureNashEquilibria
        .map((profile) => profileText(profile.routeCounts))
        .join(", "),
      "open-equilibrium-total": String(open.pureNashEquilibria.length),
      "open-equilibrium-average": formatNumber(
        open.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      ),
      "open-equilibrium-cost": formatNumber(
        open.pureNashEquilibria[0]!.physicalSocialCost.decimal,
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
      "open-pos-fraction": open.priceOfStability.fraction,
      "open-pos-decimal": formatNumber(open.priceOfStability.decimal),
      "closed-equilibrium-counts": profileText(
        closed.pureNashEquilibria[0]!.routeCounts,
      ),
      "closed-equilibrium-average": formatNumber(
        closed.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
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
    const optimumCount = open.socialOptima.length;
    document
      .querySelectorAll<HTMLElement>("[data-optimum-wording]")
      .forEach((element) => {
        element.textContent =
          optimumCount === 1
            ? "the exact optimum"
            : `one of ${optimumCount} tied exact optima`;
      });
    requireElement<HTMLElement>("#landscape-sampling-note").textContent =
      this.bundle.potentialLandscape.sampling.statement;
    this.learningStudyNote.textContent = this.studyDisclosure();
    this.rebuildPopulationCharts();
  }

  private rebuildPopulationCharts(): void {
    const openSnapshots = this.learningSnapshots("braess-open");
    const openExact = this.bundle.exactAnalysis["braess-open"];
    this.learningChart = createLearningChart(
      requireElement("#learning-chart"),
      openSnapshots,
      openExact.pureNashEquilibria[0]!.averagePhysicalLatency.decimal,
      openExact.socialOptima[0]!.averagePhysicalLatency.decimal,
    );
    createRouteShareChart(requireElement("#route-share-chart"), openSnapshots);
    createScenarioChart(requireElement("#scenario-chart"), this.bundle);
  }

  private populateComparison(): void {
    if (!this.comparisonBundle?.comparison) return;
    createLearnerChart(requireElement("#learner-chart"), this.comparisonBundle);
    const comparison = this.comparisonBundle.comparison;
    const block = comparison.scenarios["braess-tolled"];
    const rows: [string, FinalSummary, string][] = [
      [
        "independent Q-learning",
        block.qLearning.representativeSummary,
        "empirical epsilon-zero greedy evaluation",
      ],
      [
        "strict best response",
        block.bestResponse.representativeSummary,
        "exact potential descent to pure Nash",
      ],
      [
        "full-information Hedge",
        block.hedge.representativeSummary,
        "external-regret control, not last-iterate Nash",
      ],
    ];
    const body = requireElement<HTMLTableSectionElement>(
      "#learner-table tbody",
    );
    body.replaceChildren(
      ...rows.map(([name, summary, statement]) => {
        const row = document.createElement("tr");
        [
          name,
          profileText(summary.finalGreedyRouteCounts),
          `${formatNumber(summary.physicalSocialCost)} commuter-minutes`,
          `${formatNumber(summary.exploitability)} minutes`,
          statement,
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        return row;
      }),
    );
  }

  private ensureComparison(): Promise<void> {
    if (this.comparisonBundle?.comparison) {
      this.populateComparison();
      return Promise.resolve();
    }
    if (this.comparisonRequest) return this.comparisonRequest;
    const status = requireElement<HTMLElement>("#comparison-loading");
    status.textContent = "Loading the replicated 100-commuter comparison...";
    this.comparisonRequest = loadPopulationBundle(
      this.manifest.comparisonPopulation,
    )
      .then((bundle) => {
        if (!bundle.comparison) {
          throw new Error("the canonical comparison data is missing");
        }
        this.comparisonBundle = bundle;
        this.populateComparison();
        status.textContent = "";
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "unknown data error";
        status.textContent = `Could not load the comparison: ${message}`;
      })
      .finally(() => {
        this.comparisonRequest = null;
      });
    return this.comparisonRequest;
  }

  private isSampledStudy(): boolean {
    return (
      this.bundle.learningStudy.learningStudyKind === "sampled-population-proxy"
    );
  }

  private studyDisclosure(): string {
    const study = this.bundle.learningStudy;
    if (!this.isSampledStudy()) {
      return `This is a full-population study with ${study.simulatedLearners.toLocaleString()} separate independent Q-learners.`;
    }
    return `Learning path estimated from ${study.simulatedLearners.toLocaleString()} independently simulated commuters; exact markers use the full population of ${study.representedPopulation.toLocaleString()}.`;
  }

  private bindControls(): void {
    this.startButton.addEventListener("click", () => this.startJourney());
    this.playPause.addEventListener("click", () => {
      this.dispatchVisual(
        { type: this.visual.playback === "playing" ? "PAUSE" : "PLAY" },
        true,
      );
    });
    this.runLearning.addEventListener("click", () => this.startLearning(false));
    this.runAgain.addEventListener("click", () => this.startLearning(true));
    this.explore.addEventListener("click", () => this.scene?.toggleExplore());
    this.reset.addEventListener("click", () => {
      this.scene?.resetView();
      this.dispatchVisual({ type: "RESET_VIEW" });
    });
    this.focusPrimary.addEventListener("click", () => {
      const target: FocusTarget =
        this.visual.sceneMode === "landscape" ? "equilibrium" : "shortcut";
      this.dispatchVisual({ type: "FOCUS", target }, true);
      this.scene?.focus(target);
    });
    this.focusSecondary.addEventListener("click", () => {
      const target: FocusTarget =
        this.visual.sceneMode === "landscape" ? "optimum" : "bottleneck";
      this.dispatchVisual({ type: "FOCUS", target }, true);
      this.scene?.focus(target);
    });
    document
      .querySelectorAll<HTMLButtonElement>("[data-proceed-act]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          this.proceed(Number(button.dataset.proceedAct)),
        );
      });
    document
      .querySelectorAll<HTMLButtonElement>("[data-route-focus]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const route = button.dataset.routeFocus;
          if (route !== "U" && route !== "L" && route !== "Z") return;
          document
            .querySelectorAll<HTMLButtonElement>("[data-route-focus]")
            .forEach((candidate) =>
              candidate.setAttribute(
                "aria-pressed",
                String(candidate === button),
              ),
            );
          this.scene?.highlightRoute(route);
          this.fallback?.highlightRoute(route);
          this.stage.dataset.routeHighlight = route;
          this.caption.textContent = `${button.textContent?.trim() ?? route} is highlighted as one complete route action.`;
        });
      });
    document
      .querySelectorAll<HTMLButtonElement>("button[data-population]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const population = Number(button.dataset.population);
          if (
            population === 1_000 ||
            population === 10_000 ||
            population === 100_000
          ) {
            void this.selectPopulation(population);
          }
        });
      });
    requireElement<HTMLButtonElement>("#replay-experiment").addEventListener(
      "click",
      () => {
        void this.fullReplay();
      },
    );
    window.addEventListener("keydown", this.guardLockedNavigation);
    window.addEventListener("hashchange", this.guardHashNavigation);
  }

  private readonly tick = (timestamp: number): void => {
    this.animationFrame = requestAnimationFrame(this.tick);
    if (!this.journey.started || this.visual.playback !== "playing") {
      this.previousPlaybackTime = timestamp;
      return;
    }
    const interval = this.visual.reducedMotion ? 260 : 72;
    if (timestamp - this.previousPlaybackTime < interval) return;
    this.previousPlaybackTime = timestamp;
    const snapshots = this.learningSnapshots(this.visual.scenario);
    const step = this.visual.reducedMotion
      ? Math.max(1, Math.floor(snapshots.length / 4))
      : 1;
    const next = this.visual.snapshotIndex + step;
    if (next >= snapshots.length - 1) {
      this.visual = reduceStoryState(this.visual, {
        type: "SET_SNAPSHOT",
        index: snapshots.length - 1,
      });
      this.completeLearning();
      return;
    }
    this.dispatchVisual({ type: "SET_SNAPSHOT", index: next });
  };

  private async fullReplay(): Promise<void> {
    const defaultBundle = await loadPopulationBundle(
      this.manifest.defaultPopulation,
    );
    this.bundle = defaultBundle;
    this.scene?.setBundle(defaultBundle);
    this.journey = initialJourneyState(defaultBundle.population);
    this.visual = initialStoryState(
      this.visual.reducedMotion,
      defaultBundle.population,
    );
    document
      .querySelectorAll<HTMLElement>(".chapter[data-story-act]")
      .forEach((chapter) => {
        chapter.hidden = Number(chapter.dataset.storyAct) !== 0;
        chapter.classList.toggle(
          "is-active",
          Number(chapter.dataset.storyAct) === 0,
        );
      });
    this.clearRouteHighlight();
    this.scene?.resetView();
    this.populateBundleContent();
    this.learningSummary.textContent = "";
    this.playbackStatus.textContent = "";
    this.chapterStatus.textContent = "";
    this.main.hidden = true;
    this.opening.hidden = false;
    document.body.classList.add("journey-locked");
    document.body.dataset.journeyStarted = "false";
    document.body.dataset.bundlePopulation = String(defaultBundle.population);
    this.clearHash();
    window.scrollTo({ top: 0, behavior: "auto" });
    this.render();
    this.startButton.focus({ preventScroll: true });
  }

  private clearRouteHighlight(): void {
    delete this.stage.dataset.routeHighlight;
    this.fallback?.clearHighlight();
    document
      .querySelectorAll<HTMLButtonElement>("[data-route-focus]")
      .forEach((button) => button.setAttribute("aria-pressed", "false"));
  }

  private setPopulationButtonsDisabled(disabled: boolean): void {
    document
      .querySelectorAll<HTMLButtonElement>("button[data-population]")
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  private clearHash(): void {
    if (!window.location.hash) return;
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  private readonly guardLockedNavigation = (event: KeyboardEvent): void => {
    if (this.journey.started) return;
    if (["End", "PageDown", "PageUp", "Home", " "].includes(event.key)) {
      event.preventDefault();
    }
  };

  private readonly guardHashNavigation = (): void => {
    const target = window.location.hash
      ? document.querySelector<HTMLElement>(window.location.hash)
      : null;
    if (!this.journey.started || target?.hidden) {
      this.clearHash();
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };
}
