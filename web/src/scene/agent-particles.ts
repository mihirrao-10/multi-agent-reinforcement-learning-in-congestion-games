import * as THREE from "three";

import type { StorySnapshot } from "../data/story-schema";

type EdgeId = "SU" | "UT" | "SV" | "VT" | "UV";

const ROUTES: readonly (readonly EdgeId[])[] = [
  ["SU", "UT"],
  ["SV", "VT"],
  ["SU", "UV", "VT"],
];

export function particleEdgeAllocation(
  assignments: readonly number[],
): Record<EdgeId, number> {
  const allocation: Record<EdgeId, number> = {
    SU: 0,
    UT: 0,
    SV: 0,
    VT: 0,
    UV: 0,
  };
  for (const assignment of assignments) {
    for (const edge of ROUTES[assignment] ?? []) allocation[edge] += 1;
  }
  return allocation;
}

export class AgentParticles {
  readonly mesh: THREE.InstancedMesh;
  private readonly curves: Record<EdgeId, THREE.CatmullRomCurve3>;
  private snapshot: StorySnapshot | null = null;
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly quaternion = new THREE.Quaternion();

  constructor(curves: Record<EdgeId, THREE.CatmullRomCurve3>) {
    this.curves = curves;
    const geometry = new THREE.SphereGeometry(0.026, 8, 6);
    const material = new THREE.MeshStandardMaterial({
      color: "#fff1d0",
      emissive: "#ffb85c",
      emissiveIntensity: 1.9,
      roughness: 0.38,
      metalness: 0,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, 80);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }

  setSnapshot(snapshot: StorySnapshot): void {
    this.snapshot = snapshot;
  }

  update(elapsedSeconds: number, reducedMotion: boolean): void {
    if (!this.snapshot) return;
    const edgeLatencies = this.snapshot.edgePhysicalLatencies;
    for (let agent = 0; agent < 80; agent += 1) {
      const routeIndex = this.snapshot.assignments[agent] ?? 0;
      const route = ROUTES[routeIndex] ?? ROUTES[0]!;
      const routeCost = Math.max(
        1,
        this.snapshot.routePhysicalCosts[routeIndex] ?? 1,
      );
      const phase = (agent * 0.61803398875 + routeIndex * 0.17) % 1;
      const cycleSeconds = Math.max(4.4, routeCost / 9.5);
      const progress = reducedMotion
        ? phase
        : (phase + elapsedSeconds / cycleSeconds) % 1;
      const durations = route.map((edge) =>
        Math.max(0.04, edgeLatencies[edge] ?? 0),
      );
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      let cursor = progress * total;
      let selectedEdge = route[route.length - 1]!;
      let localProgress = 1;
      for (let index = 0; index < route.length; index += 1) {
        const duration = durations[index]!;
        if (cursor <= duration) {
          selectedEdge = route[index]!;
          localProgress = duration > 0 ? cursor / duration : 0.5;
          break;
        }
        cursor -= duration;
      }
      const position = this.curves[selectedEdge].getPointAt(
        Math.max(0, Math.min(1, localProgress)),
      );
      this.scale.setScalar(0.82 + 0.16 * ((agent % 5) / 4));
      this.matrix.compose(position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(agent, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  }
}
