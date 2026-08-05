import type { ScenarioId, StoryData, StorySnapshot } from "./story-schema";

export class StoryConsistencyError extends Error {
  override readonly name = "StoryConsistencyError";
}

function assertClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9) {
    throw new StoryConsistencyError(
      `${label} disagrees: ${actual} versus ${expected}`,
    );
  }
}

export function deriveEdgeLoads(
  counts: readonly number[],
  scenario: ScenarioId,
): Record<string, number> {
  const [upper = 0, lower = 0, shortcut = 0] = counts;
  if (counts.reduce((total, value) => total + value, 0) !== 80) {
    throw new StoryConsistencyError("route counts must sum to eighty");
  }
  if (scenario === "braess-closed" && counts.length !== 2) {
    throw new StoryConsistencyError(
      "closed scenario must have two route counts",
    );
  }
  return {
    SU: upper + shortcut,
    UT: upper,
    SV: lower,
    VT: lower + shortcut,
    UV: shortcut,
  };
}

export function derivePhysicalRouteCosts(
  counts: readonly number[],
  scenario: ScenarioId,
): number[] {
  const loads = deriveEdgeLoads(counts, scenario);
  const upper = loads.SU! / 2 + 45;
  const lower = 45 + loads.VT! / 2;
  if (scenario === "braess-closed") return [upper, lower];
  return [upper, lower, loads.SU! / 2 + loads.VT! / 2];
}

export function derivePhysicalSocialCost(
  counts: readonly number[],
  scenario: ScenarioId,
): number {
  const loads = deriveEdgeLoads(counts, scenario);
  return loads.SU! ** 2 / 2 + loads.VT! ** 2 / 2 + 45 * (loads.UT! + loads.SV!);
}

export function validateSnapshot(
  snapshot: StorySnapshot,
  scenario: ScenarioId,
): void {
  const routeCount = scenario === "braess-closed" ? 2 : 3;
  if (snapshot.routeCounts.length !== routeCount) {
    throw new StoryConsistencyError(
      "snapshot route dimension disagrees with scenario",
    );
  }
  const assignmentCounts = Array.from({ length: routeCount }, () => 0);
  for (const assignment of snapshot.assignments) {
    if (assignment < 0 || assignment >= routeCount) {
      throw new StoryConsistencyError(
        "snapshot contains an unavailable route assignment",
      );
    }
    assignmentCounts[assignment]! += 1;
  }
  if (
    assignmentCounts.some(
      (count, index) => count !== snapshot.routeCounts[index],
    )
  ) {
    throw new StoryConsistencyError("assignments disagree with route counts");
  }
  const loads = deriveEdgeLoads(snapshot.routeCounts, scenario);
  for (const [edge, load] of Object.entries(loads)) {
    if (snapshot.edgeLoads[edge] !== load) {
      throw new StoryConsistencyError(`edge load ${edge} disagrees`);
    }
  }
  const routeCosts = derivePhysicalRouteCosts(snapshot.routeCounts, scenario);
  routeCosts.forEach((cost, index) =>
    assertClose(
      snapshot.routePhysicalCosts[index]!,
      cost,
      `route cost ${index}`,
    ),
  );
  const socialCost = derivePhysicalSocialCost(snapshot.routeCounts, scenario);
  assertClose(snapshot.physicalSocialCost, socialCost, "physical social cost");
  assertClose(
    snapshot.averagePhysicalLatency,
    socialCost / 80,
    "average latency",
  );
}

export function validateStoryConsistency(story: StoryData): void {
  if (story.potentialLandscape.vertices.length !== 3321) {
    throw new StoryConsistencyError(
      "potential landscape must contain 3321 vertices",
    );
  }
  if (story.potentialLandscape.triangles.length !== 6400) {
    throw new StoryConsistencyError(
      "potential landscape must contain 6400 triangles",
    );
  }
  const stateKeys = new Set<string>();
  for (const vertex of story.potentialLandscape.vertices) {
    const key = vertex.routeCounts.join(",");
    if (
      stateKeys.has(key) ||
      vertex.routeCounts.reduce((sum, value) => sum + value, 0) !== 80
    ) {
      throw new StoryConsistencyError(
        "potential landscape has a duplicate or invalid state",
      );
    }
    stateKeys.add(key);
  }
  for (const triangle of story.potentialLandscape.triangles) {
    if (
      new Set(triangle).size !== 3 ||
      triangle.some(
        (index) =>
          index < 0 || index >= story.potentialLandscape.vertices.length,
      )
    ) {
      throw new StoryConsistencyError(
        "potential landscape has an invalid triangle",
      );
    }
  }
  for (const scenario of [
    "braess-open",
    "braess-closed",
    "braess-tolled",
  ] as const) {
    const block = story.experiments.scenarios[scenario];
    for (const learner of [block.qLearning, block.hedge]) {
      let previousEpisode = -1;
      for (const snapshot of learner.representative.snapshots) {
        if (snapshot.episode <= previousEpisode) {
          throw new StoryConsistencyError(
            "snapshot episodes must increase strictly",
          );
        }
        validateSnapshot(snapshot, scenario);
        previousEpisode = snapshot.episode;
      }
    }
  }
  const open = story.exactAnalysis["braess-open"];
  const closed = story.exactAnalysis["braess-closed"];
  const tolled = story.exactAnalysis["braess-tolled"];
  if (open.pureNashEquilibria[0]?.routeCounts.join(",") !== "0,0,80") {
    throw new StoryConsistencyError("open equilibrium is not canonical");
  }
  if (open.socialOptima[0]?.routeCounts.join(",") !== "35,35,10") {
    throw new StoryConsistencyError("open optimum is not canonical");
  }
  if (closed.pureNashEquilibria[0]?.routeCounts.join(",") !== "40,40") {
    throw new StoryConsistencyError("closed equilibrium is not canonical");
  }
  if (tolled.pureNashEquilibria[0]?.routeCounts.join(",") !== "35,35,10") {
    throw new StoryConsistencyError("tolled equilibrium is not canonical");
  }
}

export function exactSnapshotAtIndex(
  snapshots: readonly StorySnapshot[],
  index: number,
): StorySnapshot {
  if (snapshots.length === 0)
    throw new StoryConsistencyError("trajectory has no snapshots");
  const bounded = Math.max(
    0,
    Math.min(snapshots.length - 1, Math.round(index)),
  );
  return snapshots[bounded]!;
}
