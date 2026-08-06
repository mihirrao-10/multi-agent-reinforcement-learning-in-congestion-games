export interface VisualCohort {
  readonly routeIndex: number;
  readonly representedAgents: number;
  readonly ordinalOnRoute: number;
  readonly visibleOnRoute: number;
}

export function visibleBeadBudget(population: number): number {
  return population <= 100 ? population : 180;
}

export function allocateVisualCohorts(
  routeCounts: readonly number[],
  population: number,
  budget = visibleBeadBudget(population),
): VisualCohort[] {
  if (
    population <= 0 ||
    budget <= 0 ||
    routeCounts.some((count) => !Number.isInteger(count) || count < 0) ||
    routeCounts.reduce((sum, count) => sum + count, 0) !== population
  ) {
    throw new Error("visual cohort inputs are inconsistent");
  }
  const visibleTotal = Math.min(population, budget);
  const quotas = routeCounts.map(
    (count) => (count * visibleTotal) / population,
  );
  const visible = quotas.map((quota, index) =>
    routeCounts[index]! > 0 ? Math.max(1, Math.floor(quota)) : 0,
  );
  while (visible.reduce((sum, value) => sum + value, 0) < visibleTotal) {
    const candidates = routeCounts
      .map((count, index) => ({
        index,
        remainder: quotas[index]! - Math.floor(quotas[index]!),
        count,
      }))
      .filter(({ count }) => count > 0)
      .sort(
        (left, right) =>
          right.remainder - left.remainder || left.index - right.index,
      );
    for (const candidate of candidates) {
      if (visible.reduce((sum, value) => sum + value, 0) >= visibleTotal) break;
      visible[candidate.index]! += 1;
    }
  }
  while (visible.reduce((sum, value) => sum + value, 0) > visibleTotal) {
    const candidate = visible
      .map((count, index) => ({ index, count, remainder: quotas[index]! % 1 }))
      .filter(({ count }) => count > 1)
      .sort(
        (left, right) =>
          left.remainder - right.remainder || right.index - left.index,
      )[0];
    if (!candidate)
      throw new Error("visual cohort minimums exceed the bead budget");
    visible[candidate.index]! -= 1;
  }
  const cohorts: VisualCohort[] = [];
  routeCounts.forEach((count, routeIndex) => {
    const beadCount = visible[routeIndex]!;
    if (beadCount === 0) return;
    const baseWeight = Math.floor(count / beadCount);
    const extra = count % beadCount;
    for (let ordinal = 0; ordinal < beadCount; ordinal += 1) {
      cohorts.push({
        routeIndex,
        representedAgents: baseWeight + (ordinal < extra ? 1 : 0),
        ordinalOnRoute: ordinal,
        visibleOnRoute: beadCount,
      });
    }
  });
  if (
    cohorts.reduce((sum, cohort) => sum + cohort.representedAgents, 0) !==
      population ||
    routeCounts.some(
      (count, route) =>
        count > 0 && !cohorts.some((cohort) => cohort.routeIndex === route),
    )
  ) {
    throw new Error("visual cohorts lost exact route representation");
  }
  return cohorts;
}

export function cohortLegend(population: number, visibleCount: number): string {
  if (population <= 100) return "One visible bead represents one agent.";
  return `One visible bead represents about ${Math.round(population / visibleCount).toLocaleString()} agents; exact route counts remain in the metrics.`;
}
