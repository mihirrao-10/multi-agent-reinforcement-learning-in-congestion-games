import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  manifestSchema,
  populationBundleSchema,
  type Population,
  type PopulationBundle,
  type StoryManifest,
} from "../src/data/story-schema";

const bundles = new Map<Population, PopulationBundle>();
let manifest: StoryManifest | undefined;

export function loadManifestFixture(): StoryManifest {
  if (manifest) return manifest;
  const raw: unknown = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../public/data/manifest-v3.json"),
      "utf8",
    ),
  );
  manifest = manifestSchema.parse(raw);
  return manifest;
}

export function loadFixture(population: Population = 100): PopulationBundle {
  const cached = bundles.get(population);
  if (cached) return cached;
  const raw: unknown = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        `../public/data/population-${population}-v3.json`,
      ),
      "utf8",
    ),
  );
  const bundle = populationBundleSchema.parse(raw);
  bundles.set(population, bundle);
  return bundle;
}
