import * as THREE from "three";

export type EdgeRole = "variable" | "constant" | "shortcut";

const GREEN = new THREE.Color("#2cd67b");
const AMBER = new THREE.Color("#f4b942");
const ORANGE = new THREE.Color("#ff7a3d");
const RED = new THREE.Color("#ff3030");
export const EDGE_RADIUS_MIN = 0.007;
export const EDGE_RADIUS_SQRT_WEIGHT = 0.021;
export const EDGE_RADIUS_QUADRATIC_WEIGHT = 0.011;
export const EDGE_RADIUS_MAX =
  EDGE_RADIUS_MIN + EDGE_RADIUS_SQRT_WEIGHT + EDGE_RADIUS_QUADRATIC_WEIGHT;
export const REDUCED_MOTION_FLOW_TIME = 1.75;

export const NODE_VISUALS = {
  endpointCoreRadius: 0.148,
  junctionCoreRadius: 0.13,
  haloScale: 1.65,
  coreColor: "#ffffff",
  haloColor: "#ffffff",
} as const;

export function edgeShare(load: number, population = 100): number {
  if (
    !Number.isFinite(load) ||
    !Number.isFinite(population) ||
    population <= 0
  ) {
    throw new Error(
      "edge load and population must be finite with positive population",
    );
  }
  return Math.max(0, Math.min(1, load / population));
}

export function edgeRadius(load: number, population = 100): number {
  const share = edgeShare(load, population);
  return (
    EDGE_RADIUS_MIN +
    EDGE_RADIUS_SQRT_WEIGHT * Math.sqrt(share) +
    EDGE_RADIUS_QUADRATIC_WEIGHT * share ** 2
  );
}

export function edgeColor(
  role: EdgeRole,
  load: number,
  population = 100,
): THREE.Color {
  void role;
  const ratio = edgeShare(load, population);
  if (ratio <= 0.5) return GREEN.clone().lerp(AMBER, ratio / 0.5);
  if (ratio <= 0.76) return AMBER.clone().lerp(ORANGE, (ratio - 0.5) / 0.26);
  return ORANGE.clone().lerp(RED, (ratio - 0.76) / 0.24);
}

export function edgeOpacity(
  role: EdgeRole,
  load: number,
  population = 100,
): number {
  void role;
  return 0.34 + 0.46 * edgeShare(load, population);
}

export function edgeFlowSpeed(
  role: EdgeRole,
  load: number,
  population = 100,
): number {
  void role;
  void load;
  void population;
  return 0.48;
}

export function edgeColorHex(
  role: EdgeRole,
  load: number,
  population = 100,
): string {
  return `#${edgeColor(role, load, population).getHexString()}`;
}

export function landscapeColor(height: number): THREE.Color {
  const value = Math.max(0, Math.min(1, height));
  const low = new THREE.Color("#172b20");
  const middle = new THREE.Color("#783719");
  const high = new THREE.Color("#c93c25");
  return value < 0.52
    ? low.lerp(middle, value / 0.52)
    : middle.lerp(high, (value - 0.52) / 0.48);
}
