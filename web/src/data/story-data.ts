import {
  manifestSchema,
  populationBundleSchema,
  type Population,
  type PopulationBundle,
  type StoryManifest,
} from "./story-schema";
import {
  validateBundleConsistency,
  validateManifestConsistency,
} from "./validation";

let cachedManifest: StoryManifest | null = null;
const bundleCache = new Map<Population, PopulationBundle>();

async function fetchValidated<T>(
  path: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`data request failed with status ${response.status}`);
  return parse(await response.json());
}

export async function loadManifest(): Promise<StoryManifest> {
  if (cachedManifest) return cachedManifest;
  cachedManifest = await fetchValidated("manifest-v2.json", (payload) => {
    const result = manifestSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `manifest validation failed: ${result.error.issues[0]?.message ?? "unknown issue"}`,
      );
    }
    validateManifestConsistency(result.data);
    return result.data;
  });
  return cachedManifest;
}

export async function loadPopulationBundle(
  population: Population,
): Promise<PopulationBundle> {
  const cached = bundleCache.get(population);
  if (cached) return cached;
  const manifest = await loadManifest();
  const descriptor = manifest.populations.find(
    (entry) => entry.agents === population,
  );
  if (!descriptor)
    throw new Error(`population ${population} is not in the manifest`);
  const bundle = await fetchValidated(descriptor.bundle, (payload) => {
    const result = populationBundleSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(
        `population bundle validation failed: ${result.error.issues[0]?.message ?? "unknown issue"}`,
      );
    }
    validateBundleConsistency(result.data);
    return result.data;
  });
  if (bundle.population !== population)
    throw new Error("population bundle identity disagrees");
  bundleCache.set(population, bundle);
  return bundle;
}

export async function loadInitialData(): Promise<{
  manifest: StoryManifest;
  bundle: PopulationBundle;
}> {
  const manifest = await loadManifest();
  const bundle = await loadPopulationBundle(manifest.defaultPopulation);
  return { manifest, bundle };
}

export const loadStoryData = (): Promise<PopulationBundle> =>
  loadPopulationBundle(100);

export function clearStoryCacheForTests(): void {
  cachedManifest = null;
  bundleCache.clear();
}
