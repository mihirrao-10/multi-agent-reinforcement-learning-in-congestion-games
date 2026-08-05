import { describe, expect, it } from "vitest";

import {
  initialStoryState,
  reduceStoryState,
} from "../src/story/state-machine";

describe("typed story state machine", () => {
  it("makes chapter transitions reversible and internally consistent", () => {
    const initial = initialStoryState(false);
    const potential = reduceStoryState(initial, {
      type: "SET_CHAPTER",
      chapter: 4,
    });
    expect(potential.sceneMode).toBe("landscape");
    expect(potential.trajectory).toBe("best-response");
    const closed = reduceStoryState(potential, {
      type: "SET_CHAPTER",
      chapter: 6,
    });
    expect(closed.sceneMode).toBe("network");
    expect(closed.scenario).toBe("braess-closed");
    expect(closed.shortcutOpen).toBe(false);
    const tolled = reduceStoryState(closed, {
      type: "SET_CHAPTER",
      chapter: 7,
    });
    expect(tolled.sceneMode).toBe("landscape");
    expect(tolled.tollsActive).toBe(true);
  });

  it("preserves manual camera exploration across chapter changes", () => {
    const exploring = reduceStoryState(initialStoryState(false), {
      type: "TOGGLE_EXPLORE",
    });
    const changed = reduceStoryState(exploring, {
      type: "SET_CHAPTER",
      chapter: 5,
    });
    expect(changed.userExploring).toBe(true);
    expect(changed.focusTarget).toBe("manual");
    expect(
      reduceStoryState(changed, { type: "EXIT_EXPLORE" }).userExploring,
    ).toBe(false);
  });

  it("retains all data while enabling reduced motion", () => {
    const state = reduceStoryState(initialStoryState(false), {
      type: "SET_REDUCED_MOTION",
      reduced: true,
    });
    expect(state.reducedMotion).toBe(true);
    expect(state.scenario).toBe("braess-open");
  });
});
