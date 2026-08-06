import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  conceptVisibility,
  initialJourneyState,
  reduceJourneyState,
} from "../src/story/journey-state";

describe("progressive journey state", () => {
  it("ships a title-only locked shell with a disabled Start until data is ready", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../index.html"),
      "utf8",
    );
    const document = new DOMParser().parseFromString(source, "text/html");
    const opening = document.querySelector("#opening-screen");
    expect(opening?.querySelector("h1")?.textContent?.trim()).toBe(
      "When Every Agent Finds the Shortcut",
    );
    expect(
      opening?.querySelector("#start-journey")?.hasAttribute("disabled"),
    ).toBe(true);
    expect(document.querySelector("#story")?.hasAttribute("hidden")).toBe(true);
    expect(
      document.querySelectorAll(".chapter[data-story-act]:not([hidden])"),
    ).toHaveLength(1);
  });

  it("Start never starts learning and Proceed unlocks exactly one act", () => {
    let state = reduceJourneyState(initialJourneyState(), { type: "START" });
    expect(state.started).toBe(true);
    expect(state.learningStarted).toBe(false);
    expect(state.maxUnlockedAct).toBe(0);
    state = reduceJourneyState(state, { type: "PROCEED" });
    expect(state.activeAct).toBe(1);
    expect(state.maxUnlockedAct).toBe(1);
    expect(
      reduceJourneyState(state, { type: "SET_ACTIVE_ACT", act: 10 }).activeAct,
    ).toBe(1);
  });

  it("keeps measurements hidden until learning and exploitability hidden until act 5", () => {
    let state = initialJourneyState();
    expect(conceptVisibility(state)).toEqual({
      routeNames: false,
      networkEncoding: false,
      learningMetrics: false,
      exploitability: false,
      landscapeLegend: false,
    });
    state = { ...state, activeAct: 3, maxUnlockedAct: 3 };
    expect(conceptVisibility(state).learningMetrics).toBe(false);
    state = reduceJourneyState(state, { type: "START_LEARNING" });
    expect(conceptVisibility(state).learningMetrics).toBe(true);
    state = { ...state, activeAct: 5, maxUnlockedAct: 5 };
    expect(conceptVisibility(state).exploitability).toBe(true);
  });

  it("gates the landscape, resets playback on population change, and fully replays", () => {
    let state = {
      ...initialJourneyState(),
      started: true,
      activeAct: 3,
      maxUnlockedAct: 3,
    };
    expect(reduceJourneyState(state, { type: "PROCEED" })).toEqual(state);
    state = reduceJourneyState(state, { type: "START_LEARNING" });
    state = reduceJourneyState(state, { type: "COMPLETE_LEARNING" });
    state = reduceJourneyState(state, { type: "PROCEED" });
    expect(state.maxUnlockedAct).toBe(4);
    state = reduceJourneyState(state, {
      type: "SELECT_POPULATION",
      population: 10_000,
    });
    expect(state.selectedPopulation).toBe(10_000);
    expect(state.learningStarted).toBe(false);
    expect(state.learningCompleted).toBe(false);
    expect(state.maxUnlockedAct).toBe(4);
    expect(reduceJourneyState(state, { type: "FULL_RESET" })).toEqual(
      initialJourneyState(),
    );
  });
});
