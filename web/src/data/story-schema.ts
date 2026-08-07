import { z } from "zod";

export const scenarioIdSchema = z.enum([
  "braess-open",
  "braess-closed",
  "braess-tolled",
]);
export type ScenarioId = z.infer<typeof scenarioIdSchema>;

export const populationSchema = z.union([
  z.literal(100),
  z.literal(1_000),
  z.literal(10_000),
  z.literal(100_000),
  z.literal(1_000_000),
]);
export type Population = z.infer<typeof populationSchema>;

export const learningStudyKindSchema = z.enum([
  "full-population",
  "sampled-population-proxy",
]);
export type LearningStudyKind = z.infer<typeof learningStudyKindSchema>;

export const learningStudySchema = z.object({
  learningStudyKind: learningStudyKindSchema,
  representedPopulation: populationSchema,
  simulatedLearners: z.number().int().positive().max(10_000),
  samplingDescription: z.string().min(1),
});
export type LearningStudy = z.infer<typeof learningStudySchema>;

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
  perceivedPotential: exactNumberSchema,
  exploitability: exactNumberSchema,
});

const exactScenarioSchema = z.object({
  countStateCount: z.number().int().positive(),
  pureNashEquilibria: z.array(exactProfileSchema).min(1),
  socialOptima: z.array(exactProfileSchema).min(1),
  priceOfAnarchy: exactNumberSchema,
  priceOfStability: exactNumberSchema,
  potentialIdentity: z.object({
    validated: z.literal(true),
    feasibleDeviationChecks: z.number().int().positive(),
    arithmetic: z.string().min(1),
    method: z.string().min(1),
  }),
  tolledPotentialIdentity: z.object({
    validated: z.boolean(),
    countStateChecks: z.number().int().nonnegative(),
  }),
});

export const storySnapshotSchema = z.object({
  episode: z.number().int().positive(),
  epsilon: z.number().finite().min(0).max(1),
  routeCounts: z.array(z.number().int().nonnegative()).min(2).max(3),
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

export const presentationProfileSchema = storySnapshotSchema.omit({
  episode: true,
  epsilon: true,
  regret: true,
  policyEntropy: true,
});
export type PresentationProfile = z.infer<typeof presentationProfileSchema>;
export type NetworkPresentation = StorySnapshot | PresentationProfile;

const finalSummarySchema = z.object({
  seed: z.number().int().nonnegative(),
  trainingFinalRouteCounts: z
    .array(z.number().int().nonnegative())
    .min(2)
    .max(3),
  finalGreedyRouteCounts: z.array(z.number().int().nonnegative()).min(2).max(3),
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
    snapshots: z.array(storySnapshotSchema).min(1),
    learnerState: z.object({
      qValueShape: z.tuple([
        z.number().int().positive(),
        z.number().int().min(2).max(3),
      ]),
      finalEvaluationEpsilon: z.literal(0),
      feedback: z.string().min(1),
      selectedActionOnlyUpdates: z.literal(true),
      simultaneousActionSelection: z.literal(true),
    }),
  }),
  runtime: z.record(z.string(), z.unknown()),
  routeShareScaling: z
    .object({
      method: z.string().min(1),
      representedPopulation: populationSchema,
      simulatedLearners: z.number().int().positive(),
      costsRecomputedFromScaledIntegerCounts: z.literal(true),
    })
    .optional(),
});
export type LearnerBlock = z.infer<typeof learnerBlockSchema>;

const landscapeVertexSchema = z.object({
  routeCounts: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  displayCoordinates: z.tuple([z.number().finite(), z.number().finite()]),
  originalPotential: z.number().finite(),
  physicalSocialCost: z.number().finite(),
  tolledPotential: z.number().finite(),
  displayHeightOriginal: z.number().finite(),
  displayHeightTolled: z.number().finite(),
});
export type LandscapeVertex = z.infer<typeof landscapeVertexSchema>;

const landscapePointSchema = z.object({
  routeCounts: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  displayCoordinates: z.tuple([z.number().finite(), z.number().finite()]),
  displayHeightOriginal: z.number().finite(),
  displayHeightTolled: z.number().finite(),
});
export type LandscapePoint = z.infer<typeof landscapePointSchema>;

const markerSchema = z.object({
  routeCounts: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  displayCoordinates: z.tuple([z.number().finite(), z.number().finite()]),
  originalPotential: z.number().finite(),
  tolledPotential: z.number().finite(),
});

const comparisonLearnerSchema = z.object({
  learner: z.string(),
  seedCount: z.number().int().positive(),
  representativeSelection: z.record(z.string(), z.unknown()),
  representativeSummary: finalSummarySchema,
  aggregate: z.record(z.string(), z.unknown()),
});
export type ComparisonLearner = z.infer<typeof comparisonLearnerSchema>;

const comparisonScenarioSchema = z.object({
  qLearning: comparisonLearnerSchema,
  bestResponse: comparisonLearnerSchema,
  hedge: comparisonLearnerSchema,
});

export const manifestSchema = z.object({
  schemaVersion: z.literal("3.0.0"),
  model: z.object({
    identifier: z.literal("atomic-braess-60-minute-v3"),
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
    latencyRule: z.string(),
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
  defaultPopulation: z.literal(100_000),
  comparisonPopulation: z.literal(100),
  populations: z
    .array(
      z.object({
        agents: populationSchema,
        label: z.string(),
        bundle: z.string(),
        learningStudyKind: learningStudyKindSchema,
        representedPopulation: populationSchema,
        simulatedLearners: z.number().int().positive(),
        samplingDescription: z.string().min(1),
        study: z.string(),
      }),
    )
    .length(5),
  seedPolicy: z.record(z.string(), z.unknown()),
});
export type StoryManifest = z.infer<typeof manifestSchema>;

export const populationBundleSchema = z.object({
  schemaVersion: z.literal("3.0.0"),
  modelIdentifier: z.literal("atomic-braess-60-minute-v3"),
  population: populationSchema,
  learningStudy: learningStudySchema,
  waitingState: z.object({
    kind: z.literal("preExperiment"),
    waitingCount: populationSchema,
    edgeLoads: z.record(z.string(), z.literal(0)),
    metricsAvailable: z.literal(false),
  }),
  exactAnalysis: z.object({
    "braess-open": exactScenarioSchema,
    "braess-closed": exactScenarioSchema,
    "braess-tolled": exactScenarioSchema,
  }),
  scenarioStates: z.object({
    "braess-open": z.object({
      equilibrium: presentationProfileSchema,
      optimum: presentationProfileSchema,
    }),
    "braess-closed": z.object({
      equilibrium: presentationProfileSchema,
      optimum: presentationProfileSchema,
    }),
    "braess-tolled": z.object({
      equilibrium: presentationProfileSchema,
      optimum: presentationProfileSchema,
    }),
  }),
  learning: z.object({
    study: learningStudySchema,
    configuration: z.record(z.string(), z.unknown()),
    scenarios: z.object({
      "braess-open": learnerBlockSchema,
      "braess-closed": learnerBlockSchema,
      "braess-tolled": learnerBlockSchema,
    }),
  }),
  potentialLandscape: z.object({
    sampling: z.object({
      mode: z.enum([
        "complete-count-lattice",
        "deterministic-barycentric-sample",
      ]),
      resolution: z.number().int().positive(),
      sampledVertexCount: z.number().int().positive(),
      fullCountStateCount: z.number().int().positive(),
      statement: z.string(),
    }),
    vertices: z.array(landscapeVertexSchema),
    triangles: z.array(
      z.tuple([z.number().int(), z.number().int(), z.number().int()]),
    ),
    markers: z.object({
      equilibria: z.array(markerSchema).min(1),
      optima: z.array(markerSchema).min(1),
    }),
    heightTransform: z.object({
      formula: z.string(),
      sharedScale: z.number().finite().positive(),
      originalMinimum: z.number().finite(),
      tolledMinimum: z.number().finite(),
      meaning: z.string(),
    }),
    cornerLabels: z.array(z.string()).length(3),
    trajectories: z.record(z.string(), z.array(landscapePointSchema).min(1)),
    bestResponseAudit: z.object({
      rawStepCount: z.number().int().positive(),
      renderedPointCount: z.number().int().positive(),
      rawPathValidated: z.literal(true),
      pathPopulation: z.number().int().positive(),
      representedPopulation: populationSchema,
      scaledForDisplay: z.boolean(),
      everyMoveIsOneAgent: z.boolean(),
      everySimulatedMoveIsOneLearner: z.literal(true),
      strictlyDecreasingPotential: z.literal(true),
      simulatedPotentialStrictlyDecreasing: z.literal(true),
      renderedDescription: z.string(),
    }),
  }),
  comparison: z
    .object({
      population: z.literal(100),
      scope: z.string(),
      scenarios: z.object({
        "braess-open": comparisonScenarioSchema,
        "braess-closed": comparisonScenarioSchema,
        "braess-tolled": comparisonScenarioSchema,
      }),
    })
    .optional(),
  provenance: z.record(z.string(), z.unknown()),
});
export type PopulationBundle = z.infer<typeof populationBundleSchema>;
export type StoryData = PopulationBundle;
