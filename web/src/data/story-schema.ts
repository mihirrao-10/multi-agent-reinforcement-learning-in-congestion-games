import { z } from "zod";

export const scenarioIdSchema = z.enum([
  "braess-open",
  "braess-closed",
  "braess-tolled",
]);
export type ScenarioId = z.infer<typeof scenarioIdSchema>;

const exactNumberSchema = z.object({
  numerator: z.number().int(),
  denominator: z.number().int().positive(),
  fraction: z.string().min(1),
  decimal: z.number().finite(),
});

const exactProfileSchema = z.object({
  routeCounts: z.array(z.number().int().nonnegative()).min(2).max(3),
  physicalSocialCost: exactNumberSchema,
  averagePhysicalLatency: exactNumberSchema,
  rosenthalPotential: exactNumberSchema,
  perceivedPotential: exactNumberSchema.optional(),
  exploitability: exactNumberSchema,
});

const exactScenarioSchema = z.object({
  countStateCount: z.number().int().positive(),
  pureNashEquilibria: z.array(exactProfileSchema).min(1),
  socialOptima: z.array(exactProfileSchema).min(1),
  priceOfAnarchy: exactNumberSchema,
  priceOfStability: exactNumberSchema,
  potentialIdentity: z.object({
    validated: z.boolean(),
    feasibleDeviationChecks: z.number().int().nonnegative(),
    arithmetic: z.string(),
  }),
  tolledPotentialIdentity: z.object({
    validated: z.boolean(),
    countStateChecks: z.number().int().nonnegative(),
  }),
});

export const storySnapshotSchema = z.object({
  episode: z.number().int().nonnegative(),
  epsilon: z.number().finite().min(0).max(1),
  routeCounts: z.array(z.number().int().nonnegative()).min(2).max(3),
  assignments: z.array(z.number().int().nonnegative()).length(80),
  edgeLoads: z.record(z.string(), z.number().int().nonnegative()),
  edgePhysicalLatencies: z.record(
    z.string(),
    z.number().finite().nonnegative(),
  ),
  routePhysicalCosts: z.array(z.number().finite().nonnegative()).min(2).max(3),
  routePerceivedCosts: z.array(z.number().finite().nonnegative()).min(2).max(3),
  physicalSocialCost: z.number().finite().nonnegative(),
  averagePhysicalLatency: z.number().finite().nonnegative(),
  totalTollPayment: z.number().finite().nonnegative(),
  rosenthalPotential: z.number().finite().nonnegative(),
  perceivedPotential: z.number().finite().nonnegative(),
  exploitability: z.number().finite().nonnegative(),
  regret: z.object({
    meanAverage: z.number().finite(),
    maximumAverage: z.number().finite(),
  }),
  policyEntropy: z.number().finite().nonnegative(),
});

export type StorySnapshot = z.infer<typeof storySnapshotSchema>;

const finalSummarySchema = z.object({
  seed: z.number().int().nonnegative(),
  trainingFinalRouteCounts: z
    .array(z.number().int().nonnegative())
    .min(2)
    .max(3),
  finalGreedyRouteCounts: z.array(z.number().int().nonnegative()).min(2).max(3),
  finalGreedyAssignments: z.array(z.number().int().nonnegative()).length(80),
  physicalSocialCost: z.number().finite().nonnegative(),
  averagePhysicalLatency: z.number().finite().nonnegative(),
  exploitability: z.number().finite().nonnegative(),
  distanceFromExactEquilibrium: z.number().finite().nonnegative(),
  distanceFromSocialOptimum: z.number().finite().nonnegative(),
  meanAverageExternalRegret: z.number().finite(),
  maximumAverageExternalRegret: z.number().finite(),
});

export type FinalSummary = z.infer<typeof finalSummarySchema>;

const aggregateMetricSchema = z.object({
  mean: z.number().finite(),
  standardDeviation: z.number().finite().nonnegative(),
  standardError: z.number().finite().nonnegative(),
  minimum: z.number().finite(),
  maximum: z.number().finite(),
});

const learnerBlockSchema = z.object({
  learner: z.string().min(1),
  seedList: z.array(z.number().int().nonnegative()).min(1),
  representativeSelection: z.object({
    rule: z.string().min(1),
    representativeSeed: z.number().int().nonnegative(),
  }),
  perSeedFinalSummaries: z.array(finalSummarySchema).min(1),
  aggregate: z
    .object({
      runs: z.number().int().positive(),
      physicalSocialCost: aggregateMetricSchema,
      averagePhysicalLatency: aggregateMetricSchema,
      exploitability: aggregateMetricSchema,
      distanceFromExactEquilibrium: aggregateMetricSchema,
      distanceFromSocialOptimum: aggregateMetricSchema,
      meanAverageExternalRegret: aggregateMetricSchema,
      maximumAverageExternalRegret: aggregateMetricSchema,
    })
    .passthrough(),
  representative: z.object({
    summary: finalSummarySchema,
    snapshots: z.array(storySnapshotSchema),
    learnerState: z.record(z.string(), z.unknown()),
  }),
  runtime: z.record(z.string(), z.unknown()),
});

export type LearnerBlock = z.infer<typeof learnerBlockSchema>;

const landscapeVertexSchema = z.object({
  routeCounts: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  displayCoordinates: z.tuple([z.number().finite(), z.number().finite()]),
  originalPotential: z.number().finite(),
  physicalSocialCost: z.number().finite(),
  tolledPotential: z.number().finite(),
  exploitability: z.number().finite().nonnegative(),
  isUntolledEquilibrium: z.boolean(),
  isPhysicalOptimum: z.boolean(),
  displayHeightOriginal: z.number().finite(),
  displayHeightTolled: z.number().finite(),
});

export type LandscapeVertex = z.infer<typeof landscapeVertexSchema>;

export const storySchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  model: z.object({
    identifier: z.literal("atomic-braess-80-v1"),
    agentCount: z.literal(80),
    nodes: z.array(
      z.object({
        id: z.enum(["S", "U", "V", "T"]),
        label: z.string(),
        position: z.tuple([z.number(), z.number(), z.number()]),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.enum(["SU", "UT", "SV", "VT", "UV"]),
        source: z.string(),
        target: z.string(),
        physicalLatency: z.string(),
        toll: z.string(),
      }),
    ),
    routes: z.array(
      z.object({
        id: z.enum(["U", "L", "Z"]),
        numericCode: z.number().int().min(0).max(2),
        label: z.string(),
        edges: z.array(z.string()),
      }),
    ),
    routeCodeMapping: z.record(z.string(), z.string()),
    units: z.string(),
    conventions: z.record(z.string(), z.string()),
    scenarios: z.array(
      z.object({
        id: scenarioIdSchema,
        shortcutOpen: z.boolean(),
        tollsActive: z.boolean(),
        routeCodes: z.array(z.number().int()),
      }),
    ),
  }),
  seedPolicy: z.record(z.string(), z.unknown()),
  exactAnalysis: z.object({
    "braess-open": exactScenarioSchema,
    "braess-closed": exactScenarioSchema,
    "braess-tolled": exactScenarioSchema,
  }),
  experiments: z.object({
    configuration: z.record(z.string(), z.unknown()),
    scenarios: z.object({
      "braess-open": z.object({
        qLearning: learnerBlockSchema,
        hedge: learnerBlockSchema,
        bestResponse: learnerBlockSchema,
      }),
      "braess-closed": z.object({
        qLearning: learnerBlockSchema,
        hedge: learnerBlockSchema,
        bestResponse: learnerBlockSchema,
      }),
      "braess-tolled": z.object({
        qLearning: learnerBlockSchema,
        hedge: learnerBlockSchema,
        bestResponse: learnerBlockSchema,
      }),
    }),
  }),
  potentialLandscape: z.object({
    vertices: z.array(landscapeVertexSchema),
    triangles: z.array(
      z.tuple([z.number().int(), z.number().int(), z.number().int()]),
    ),
    equilibriumVertexIndex: z.number().int().nonnegative(),
    optimumVertexIndex: z.number().int().nonnegative(),
    heightTransform: z.object({
      formula: z.string(),
      sharedScale: z.number().finite().positive(),
      originalMinimum: z.number().finite(),
      tolledMinimum: z.number().finite(),
      meaning: z.string(),
    }),
    cornerLabels: z.array(z.string()).length(3),
    trajectoryVertexIndices: z.record(
      z.string(),
      z.array(z.number().int().nonnegative()),
    ),
  }),
  benchmarks: z.record(z.string(), z.unknown()),
  provenance: z.record(z.string(), z.unknown()),
});

export type StoryData = z.infer<typeof storySchema>;
