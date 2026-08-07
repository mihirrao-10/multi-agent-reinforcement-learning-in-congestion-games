import type { Population } from "../data/story-schema";

export interface JourneyState {
  readonly started: boolean;
  readonly activeAct: number;
  readonly maxUnlockedAct: number;
  readonly learningIntroduced: boolean;
  readonly learningStarted: boolean;
  readonly learningCompleted: boolean;
  readonly selectedPopulation: Population;
  readonly sceneMilestones: {
    readonly landscapeSeen: boolean;
    readonly equilibriumSeen: boolean;
    readonly closedSeen: boolean;
    readonly tollsSeen: boolean;
  };
  readonly underHoodUnlocked: boolean;
}

export type JourneyEvent =
  | { readonly type: "START" }
  | { readonly type: "SET_ACTIVE_ACT"; readonly act: number }
  | { readonly type: "PROCEED" }
  | { readonly type: "START_LEARNING" }
  | { readonly type: "COMPLETE_LEARNING" }
  | { readonly type: "SELECT_POPULATION"; readonly population: Population }
  | { readonly type: "FULL_RESET" };

export interface ConceptVisibility {
  readonly routeNames: boolean;
  readonly networkEncoding: boolean;
  readonly learningMetrics: boolean;
  readonly exploitability: boolean;
  readonly landscapeLegend: boolean;
}

export function initialJourneyState(
  selectedPopulation: Population = 100_000,
): JourneyState {
  return {
    started: false,
    activeAct: 0,
    maxUnlockedAct: 0,
    learningIntroduced: false,
    learningStarted: false,
    learningCompleted: false,
    selectedPopulation,
    sceneMilestones: {
      landscapeSeen: false,
      equilibriumSeen: false,
      closedSeen: false,
      tollsSeen: false,
    },
    underHoodUnlocked: false,
  };
}

function milestonesForAct(
  previous: JourneyState["sceneMilestones"],
  act: number,
): JourneyState["sceneMilestones"] {
  return {
    landscapeSeen: previous.landscapeSeen || act >= 4,
    equilibriumSeen: previous.equilibriumSeen || act >= 5,
    closedSeen: previous.closedSeen || act >= 6,
    tollsSeen: previous.tollsSeen || act >= 7,
  };
}

export function reduceJourneyState(
  state: JourneyState,
  event: JourneyEvent,
): JourneyState {
  switch (event.type) {
    case "START":
      return { ...state, started: true };
    case "SET_ACTIVE_ACT": {
      const act = Math.max(
        0,
        Math.min(state.maxUnlockedAct, Math.floor(event.act)),
      );
      return {
        ...state,
        activeAct: act,
        learningIntroduced: state.learningIntroduced || act >= 3,
        sceneMilestones: milestonesForAct(state.sceneMilestones, act),
      };
    }
    case "PROCEED": {
      if (state.activeAct === 3 && !state.learningCompleted) return state;
      const next = Math.min(10, state.activeAct + 1);
      if (next > state.maxUnlockedAct + 1) return state;
      return {
        ...state,
        activeAct: next,
        maxUnlockedAct: Math.max(state.maxUnlockedAct, next),
        learningIntroduced: state.learningIntroduced || next >= 3,
        sceneMilestones: milestonesForAct(state.sceneMilestones, next),
        underHoodUnlocked: state.underHoodUnlocked || next >= 10,
      };
    }
    case "START_LEARNING":
      if (state.activeAct !== 3 || state.maxUnlockedAct < 3) return state;
      return {
        ...state,
        learningIntroduced: true,
        learningStarted: true,
        learningCompleted: false,
      };
    case "COMPLETE_LEARNING":
      if (!state.learningStarted) return state;
      return { ...state, learningCompleted: true };
    case "SELECT_POPULATION":
      return {
        ...state,
        selectedPopulation: event.population,
        learningStarted: false,
        learningCompleted: false,
      };
    case "FULL_RESET":
      return initialJourneyState();
  }
}

export function conceptVisibility(state: JourneyState): ConceptVisibility {
  return {
    routeNames: state.activeAct >= 1,
    networkEncoding: state.activeAct >= 2,
    learningMetrics: state.learningStarted,
    exploitability: state.activeAct >= 5,
    landscapeLegend: state.activeAct >= 4 && state.activeAct <= 7,
  };
}
