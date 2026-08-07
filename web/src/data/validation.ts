import type {
  NetworkPresentation,
  PopulationBundle,
  ScenarioId,
  StoryManifest,
  StorySnapshot,
} from "./story-schema";

export class StoryConsistencyError extends Error {
  override readonly name = "StoryConsistencyError";
}

function assertClose(actual: number, expected: number, label: string): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1e-8) {
    throw new StoryConsistencyError(
      `${label} disagrees: ${actual} versus ${expected}`,
    );
  }
}

export function deriveEdgeLoads(
  counts: readonly number[],
  scenario: ScenarioId,
  population = 100,
): Record<string, number> {
  const [upper = 0, lower = 0, shortcut = 0] = counts;
  if (counts.reduce((total, value) => total + value, 0) !== population) {
    throw new StoryConsistencyError(`route counts must sum to ${population}`);
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
  population = 100,
): number[] {
  const loads = deriveEdgeLoads(counts, scenario, population);
  const upper = (60 * loads.SU!) / population + 60;
  const lower = 60 + (60 * loads.VT!) / population;
  if (scenario === "braess-closed") return [upper, lower];
  return [upper, lower, (60 * (loads.SU! + loads.VT!)) / population];
}

export function derivePhysicalSocialCost(
  counts: readonly number[],
  scenario: ScenarioId,
  population = 100,
): number {
  const loads = deriveEdgeLoads(counts, scenario, population);
  return (
    (60 * (loads.SU! ** 2 + loads.VT! ** 2)) / population +
    60 * (loads.UT! + loads.SV!)
  );
}

export function validateSnapshot(
  snapshot: StorySnapshot,
  scenario: ScenarioId,
  population = 100,
): void {
  validatePresentation(snapshot, scenario, population);
}

export function validatePresentation(
  snapshot: NetworkPresentation,
  scenario: ScenarioId,
  population = 100,
): void {
  const routeCount = scenario === "braess-closed" ? 2 : 3;
  if (snapshot.routeCounts.length !== routeCount) {
    throw new StoryConsistencyError(
      "snapshot route dimension disagrees with scenario",
    );
  }
  const loads = deriveEdgeLoads(snapshot.routeCounts, scenario, population);
  for (const [edge, load] of Object.entries(loads)) {
    if (snapshot.edgeLoads[edge] !== load) {
      throw new StoryConsistencyError(`edge load ${edge} disagrees`);
    }
  }
  const routeCosts = derivePhysicalRouteCosts(
    snapshot.routeCounts,
    scenario,
    population,
  );
  routeCosts.forEach((cost, index) =>
    assertClose(
      snapshot.routePhysicalCosts[index]!,
      cost,
      `route cost ${index}`,
    ),
  );
  const socialCost = derivePhysicalSocialCost(
    snapshot.routeCounts,
    scenario,
    population,
  );
  assertClose(snapshot.physicalSocialCost, socialCost, "physical social cost");
  assertClose(
    snapshot.averagePhysicalLatency,
    socialCost / population,
    "average latency",
  );
}

export function validateManifestConsistency(manifest: StoryManifest): void {
  const populations = manifest.populations.map((entry) => entry.agents);
  if (populations.join(",") !== "1000,10000,100000") {
    throw new StoryConsistencyError("manifest population options disagree");
  }
  if (
    manifest.comparisonBundle !== "population-100-v3.json" ||
    new Set(manifest.populations.map((entry) => entry.bundle)).size !== 3
  ) {
    throw new StoryConsistencyError("population bundle paths must be distinct");
  }
  for (const entry of manifest.populations) {
    const sampled = entry.agents >= 100_000;
    if (
      entry.bundle !== `population-${entry.agents}-v3.json` ||
      entry.representedPopulation !== entry.agents ||
      entry.learningStudyKind !==
        (sampled ? "sampled-population-proxy" : "full-population") ||
      entry.simulatedLearners !== (sampled ? 10_000 : entry.agents)
    ) {
      throw new StoryConsistencyError(
        "manifest learning-study metadata disagrees",
      );
    }
  }
}

export function validateBundleConsistency(bundle: PopulationBundle): void {
  const population = bundle.population;
  const sampled = population >= 100_000;
  const expectedStudyKind = sampled
    ? "sampled-population-proxy"
    : "full-population";
  const expectedLearners = sampled ? 10_000 : population;
  if (
    bundle.learningStudy.learningStudyKind !== expectedStudyKind ||
    bundle.learningStudy.representedPopulation !== population ||
    bundle.learningStudy.simulatedLearners !== expectedLearners ||
    JSON.stringify(bundle.learning.study) !==
      JSON.stringify(bundle.learningStudy)
  ) {
    throw new StoryConsistencyError("bundle learning-study metadata disagrees");
  }
  if (
    bundle.waitingState.waitingCount !== population ||
    Object.values(bundle.waitingState.edgeLoads).some((load) => load !== 0)
  ) {
    throw new StoryConsistencyError("pre-experiment waiting state disagrees");
  }
  for (const scenario of [
    "braess-open",
    "braess-closed",
    "braess-tolled",
  ] as const) {
    validatePresentation(
      bundle.scenarioStates[scenario].equilibrium,
      scenario,
      population,
    );
    validatePresentation(
      bundle.scenarioStates[scenario].optimum,
      scenario,
      population,
    );
    const learner = bundle.learning.scenarios[scenario];
    let previousEpisode = 0;
    for (const snapshot of learner.representative.snapshots) {
      if (snapshot.episode <= previousEpisode) {
        throw new StoryConsistencyError(
          "snapshot episodes must increase strictly",
        );
      }
      validateSnapshot(snapshot, scenario, population);
      previousEpisode = snapshot.episode;
    }
    if (
      learner.representative.learnerState.qValueShape[0] !== expectedLearners
    ) {
      throw new StoryConsistencyError(
        "learner shape disagrees with population",
      );
    }
    if (sampled) {
      if (
        learner.routeShareScaling?.representedPopulation !== population ||
        learner.routeShareScaling.simulatedLearners !== expectedLearners ||
        !learner.routeShareScaling.costsRecomputedFromScaledIntegerCounts
      ) {
        throw new StoryConsistencyError(
          "sampled route-share scaling metadata disagrees",
        );
      }
    } else if (learner.routeShareScaling) {
      throw new StoryConsistencyError(
        "full-population study is incorrectly labeled sampled",
      );
    }
  }
  const open = bundle.exactAnalysis["braess-open"];
  const closed = bundle.exactAnalysis["braess-closed"];
  const tolled = bundle.exactAnalysis["braess-tolled"];
  if (
    open.pureNashEquilibria[0]?.routeCounts.join(",") !== `0,0,${population}`
  ) {
    throw new StoryConsistencyError("open equilibrium disagrees");
  }
  if (
    closed.pureNashEquilibria[0]!.routeCounts.reduce(
      (sum, value) => sum + value,
      0,
    ) !== population ||
    tolled.pureNashEquilibria[0]!.routeCounts.reduce(
      (sum, value) => sum + value,
      0,
    ) !== population
  ) {
    throw new StoryConsistencyError("scenario profile population disagrees");
  }
  const landscape = bundle.potentialLandscape;
  const pathAudit = landscape.bestResponseAudit;
  const renderedPath = landscape.trajectories["braess-open-best-response"]!;
  if (
    pathAudit.pathPopulation !== population ||
    pathAudit.representedPopulation !== population ||
    pathAudit.scaledForDisplay ||
    !pathAudit.everyMoveIsOneAgent ||
    pathAudit.renderedPointCount !== renderedPath.length ||
    pathAudit.rawStepCount < renderedPath.length
  ) {
    throw new StoryConsistencyError("best-response path audit disagrees");
  }
  if (landscape.vertices.length !== landscape.sampling.sampledVertexCount) {
    throw new StoryConsistencyError("landscape sample count disagrees");
  }
  if (
    new Set(landscape.vertices.map((vertex) => vertex.routeCounts.join(",")))
      .size !== landscape.vertices.length
  ) {
    throw new StoryConsistencyError(
      "landscape contains duplicate exact states",
    );
  }
  if (
    population > 100 &&
    landscape.sampling.mode !== "deterministic-barycentric-sample"
  ) {
    throw new StoryConsistencyError("large landscape must be labeled sampled");
  }
  if ((population === 100) !== Boolean(bundle.comparison)) {
    throw new StoryConsistencyError("comparison population scope disagrees");
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
