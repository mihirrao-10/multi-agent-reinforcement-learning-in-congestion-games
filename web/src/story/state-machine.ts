import type { Population, ScenarioId } from "../data/story-schema";

export type SceneMode = "network" | "landscape";
export type PlaybackState = "paused" | "playing" | "complete";
export type CameraMode = "authored" | "explore";
export type FocusTarget =
  "none" | "shortcut" | "bottleneck" | "equilibrium" | "optimum" | "manual";
export type TrajectoryKind = "q-learning" | "best-response";

export interface StoryState {
  readonly activeChapter: number;
  readonly sceneMode: SceneMode;
  readonly scenario: ScenarioId;
  readonly snapshotIndex: number;
  readonly playback: PlaybackState;
  readonly shortcutOpen: boolean;
  readonly tollsActive: boolean;
  readonly cameraMode: CameraMode;
  readonly focusTarget: FocusTarget;
  readonly reducedMotion: boolean;
  readonly userExploring: boolean;
  readonly trajectory: TrajectoryKind;
  readonly population: Population;
  readonly waiting: boolean;
}

export type StoryEvent =
  | { readonly type: "SET_CHAPTER"; readonly chapter: number }
  | { readonly type: "PLAY" }
  | { readonly type: "PAUSE" }
  | { readonly type: "COMPLETE" }
  | { readonly type: "REPLAY" }
  | { readonly type: "SET_SNAPSHOT"; readonly index: number }
  | { readonly type: "TOGGLE_EXPLORE" }
  | { readonly type: "EXIT_EXPLORE" }
  | { readonly type: "FOCUS"; readonly target: FocusTarget }
  | { readonly type: "RESET_VIEW" }
  | { readonly type: "SET_REDUCED_MOTION"; readonly reduced: boolean }
  | { readonly type: "SET_POPULATION"; readonly population: Population }
  | { readonly type: "RESET_PLAYBACK" };

export function initialStoryState(
  reducedMotion: boolean,
  population: Population = 100,
): StoryState {
  return {
    activeChapter: 0,
    sceneMode: "network",
    scenario: "braess-open",
    snapshotIndex: 0,
    playback: "paused",
    shortcutOpen: true,
    tollsActive: false,
    cameraMode: "authored",
    focusTarget: "none",
    reducedMotion,
    userExploring: false,
    trajectory: "q-learning",
    population,
    waiting: true,
  };
}

function chapterPatch(chapter: number): Partial<StoryState> {
  if (chapter === 4) {
    return {
      sceneMode: "landscape",
      scenario: "braess-open",
      shortcutOpen: true,
      tollsActive: false,
      trajectory: "best-response",
      focusTarget: "none",
      playback: "paused",
    };
  }
  if (chapter === 5) {
    return {
      sceneMode: "landscape",
      scenario: "braess-open",
      shortcutOpen: true,
      tollsActive: false,
      trajectory: "q-learning",
      focusTarget: "none",
      playback: "paused",
    };
  }
  if (chapter === 6) {
    return {
      sceneMode: "network",
      scenario: "braess-closed",
      shortcutOpen: false,
      tollsActive: false,
      trajectory: "q-learning",
      focusTarget: "none",
      playback: "paused",
    };
  }
  if (chapter === 7) {
    return {
      sceneMode: "landscape",
      scenario: "braess-tolled",
      shortcutOpen: true,
      tollsActive: true,
      trajectory: "q-learning",
      focusTarget: "optimum",
      playback: "paused",
    };
  }
  if (chapter >= 8) {
    return {
      sceneMode: "network",
      scenario: "braess-tolled",
      shortcutOpen: true,
      tollsActive: true,
      trajectory: "q-learning",
      focusTarget: "none",
      playback: "paused",
    };
  }
  return {
    sceneMode: "network",
    scenario: "braess-open",
    shortcutOpen: true,
    tollsActive: false,
    trajectory: "q-learning",
    focusTarget:
      chapter === 2 ? "bottleneck" : chapter === 1 ? "shortcut" : "none",
  };
}

export function reduceStoryState(
  state: StoryState,
  event: StoryEvent,
): StoryState {
  switch (event.type) {
    case "SET_CHAPTER": {
      const patch = chapterPatch(event.chapter);
      return {
        ...state,
        ...patch,
        activeChapter: event.chapter,
        cameraMode: state.userExploring ? state.cameraMode : "authored",
        focusTarget: state.userExploring
          ? "manual"
          : (patch.focusTarget ?? state.focusTarget),
      };
    }
    case "PLAY":
      return { ...state, playback: "playing", waiting: false };
    case "PAUSE":
      return { ...state, playback: "paused" };
    case "COMPLETE":
      return { ...state, playback: "complete" };
    case "REPLAY":
      return {
        ...state,
        snapshotIndex: 0,
        playback: "playing",
        waiting: false,
      };
    case "SET_SNAPSHOT":
      return { ...state, snapshotIndex: Math.max(0, Math.floor(event.index)) };
    case "TOGGLE_EXPLORE": {
      const exploring = !state.userExploring;
      return {
        ...state,
        userExploring: exploring,
        cameraMode: exploring ? "explore" : "authored",
        focusTarget: exploring ? "manual" : "none",
      };
    }
    case "EXIT_EXPLORE":
      return {
        ...state,
        userExploring: false,
        cameraMode: "authored",
        focusTarget: "none",
      };
    case "FOCUS":
      return { ...state, focusTarget: event.target };
    case "RESET_VIEW":
      return {
        ...state,
        userExploring: false,
        cameraMode: "authored",
        focusTarget: "none",
      };
    case "SET_REDUCED_MOTION":
      return { ...state, reducedMotion: event.reduced };
    case "SET_POPULATION":
      return {
        ...state,
        population: event.population,
        snapshotIndex: 0,
        playback: "paused",
        waiting: true,
      };
    case "RESET_PLAYBACK":
      return { ...state, snapshotIndex: 0, playback: "paused", waiting: true };
  }
}
