import * as THREE from "three";

export type EdgeRole = "variable" | "constant" | "shortcut";

const GREEN = new THREE.Color("#2cd67b");
const AMBER = new THREE.Color("#f4b942");
const ORANGE = new THREE.Color("#ff7a3d");
const RED = new THREE.Color("#ff3030");

export function edgeRadius(load: number, population = 100): number {
  const bounded = Math.max(0, Math.min(population, load));
  return 0.007 + 0.019 * Math.sqrt(bounded / population);
}

export function edgeColor(
  role: EdgeRole,
  load: number,
  population = 100,
): THREE.Color {
  if (load === 0) return GREEN.clone();
  const latency =
    role === "shortcut"
      ? 0
      : role === "constant"
        ? 45
        : (40 * load) / population;
  const ratio = Math.max(0, Math.min(1, latency / 45));
  if (ratio <= 0.5) return GREEN.clone().lerp(AMBER, ratio / 0.5);
  if (ratio <= 0.76) return AMBER.clone().lerp(ORANGE, (ratio - 0.5) / 0.26);
  return ORANGE.clone().lerp(RED, (ratio - 0.76) / 0.24);
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
