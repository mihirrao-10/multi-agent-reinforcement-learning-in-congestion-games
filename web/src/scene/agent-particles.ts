import * as THREE from "three";

import type { NetworkPresentation } from "../data/story-schema";
import {
  allocateVisualCohorts,
  visibleBeadBudget,
  type VisualCohort,
} from "./cohorts";

type EdgeId = "SU" | "UT" | "SV" | "VT" | "UV";

const ROUTES: readonly (readonly EdgeId[])[] = [
  ["SU", "UT"],
  ["SV", "VT"],
  ["SU", "UV", "VT"],
];
const SOURCE = new THREE.Vector3(-1.65, 0, 0);
const MAX_VISIBLE_BEADS = 180;

export class AgentParticles {
  readonly mesh: THREE.InstancedMesh;
  private readonly curves: Record<EdgeId, THREE.CatmullRomCurve3>;
  private snapshot: NetworkPresentation | null = null;
  private population = 100;
  private waiting = true;
  private cohorts: readonly VisualCohort[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly quaternion = new THREE.Quaternion();

  constructor(curves: Record<EdgeId, THREE.CatmullRomCurve3>) {
    this.curves = curves;
    const geometry = new THREE.SphereGeometry(0.021, 10, 8);
    const material = new THREE.MeshStandardMaterial({
      color: "#fff7df",
      emissive: "#ffc36b",
      emissiveIntensity: 2.35,
      roughness: 0.28,
      metalness: 0,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_VISIBLE_BEADS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  setPresentation(
    snapshot: NetworkPresentation | null,
    population: number,
    waiting: boolean,
  ): void {
    this.snapshot = snapshot;
    this.population = population;
    this.waiting = waiting;
    if (waiting || !snapshot) {
      const count = visibleBeadBudget(population);
      const base = Math.floor(population / count);
      const extra = population % count;
      this.cohorts = Array.from({ length: count }, (_, ordinal) => ({
        routeIndex: -1,
        representedAgents: base + (ordinal < extra ? 1 : 0),
        ordinalOnRoute: ordinal,
        visibleOnRoute: count,
      }));
    } else {
      const counts =
        snapshot.routeCounts.length === 2
          ? [...snapshot.routeCounts, 0]
          : snapshot.routeCounts;
      this.cohorts = allocateVisualCohorts(counts, population);
    }
    this.mesh.count = this.cohorts.length;
  }

  update(elapsedSeconds: number, reducedMotion: boolean): void {
    if (this.waiting || !this.snapshot) {
      this.updateWaiting();
      return;
    }
    const edgeLatencies = this.snapshot.edgePhysicalLatencies;
    this.cohorts.forEach((cohort, visibleIndex) => {
      const route = ROUTES[cohort.routeIndex] ?? ROUTES[0]!;
      const routeCost = Math.max(
        1,
        this.snapshot?.routePhysicalCosts[cohort.routeIndex] ?? 1,
      );
      const phase =
        (cohort.ordinalOnRoute + 0.5) / cohort.visibleOnRoute +
        cohort.routeIndex * 0.071;
      const cycleSeconds = Math.max(4.8, routeCost / 8.8);
      const progress = reducedMotion
        ? phase % 1
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
        Math.max(0.025, Math.min(0.975, localProgress)),
      );
      this.scale.setScalar(0.88 + 0.1 * ((visibleIndex % 5) / 4));
      this.matrix.compose(position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(visibleIndex, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private updateWaiting(): void {
    this.cohorts.forEach((cohort, index) => {
      const proportion = (index + 0.5) / this.cohorts.length;
      const angle = index * 2.399963 + 0.4;
      const radius = 0.125 + Math.sqrt(proportion) * 0.16;
      const position = SOURCE.clone().add(
        new THREE.Vector3(
          -0.055 + radius * Math.cos(angle),
          radius * Math.sin(angle),
          0.035 + 0.04 * Math.sin(angle * 2),
        ),
      );
      this.scale.setScalar(
        0.82 + Math.min(0.18, cohort.representedAgents / this.population),
      );
      this.matrix.compose(position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  }
}
