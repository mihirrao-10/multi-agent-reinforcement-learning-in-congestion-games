import { describe, expect, it } from "vitest";

import {
  allocateVisualCohorts,
  cohortLegend,
  visibleBeadBudget,
} from "../src/scene/cohorts";

describe("honest population cohorts", () => {
  it("uses one bead per agent for 100 and bounds both scale presets", () => {
    expect(visibleBeadBudget(100)).toBe(100);
    expect(visibleBeadBudget(1_000)).toBe(180);
    expect(visibleBeadBudget(10_000)).toBe(180);
  });

  it("uses deterministic largest remainders while preserving exact route totals", () => {
    const first = allocateVisualCohorts([437, 438, 125], 1_000);
    const second = allocateVisualCohorts([437, 438, 125], 1_000);
    expect(second).toEqual(first);
    expect(first).toHaveLength(180);
    const represented = [0, 0, 0];
    const visible = [0, 0, 0];
    first.forEach((cohort) => {
      represented[cohort.routeIndex]! += cohort.representedAgents;
      visible[cohort.routeIndex]! += 1;
    });
    expect(represented).toEqual([437, 438, 125]);
    expect(visible).toEqual([79, 79, 22]);
  });

  it("never erases a positive route and labels weighted beads honestly", () => {
    const cohorts = allocateVisualCohorts([9_998, 1, 1], 10_000);
    expect(new Set(cohorts.map((cohort) => cohort.routeIndex))).toEqual(
      new Set([0, 1, 2]),
    );
    expect(cohortLegend(10_000, cohorts.length)).toContain("about 56 agents");
    expect(cohortLegend(100, 100)).toBe(
      "One visible bead represents one agent.",
    );
  });
});
