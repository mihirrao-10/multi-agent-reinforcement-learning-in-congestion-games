import * as THREE from "three";

import type { LandscapePoint, PopulationBundle } from "../data/story-schema";
import { landscapeColor } from "./materials";

const TRAJECTORY_REVEAL_DELAY_SECONDS = 0.45;
const TRAJECTORY_REVEAL_DURATION_SECONDS = 6.2;
const BEST_RESPONSE_TRAJECTORY = "braess-open-best-response";

export function interpolateLandscapeHeight(
  original: number,
  tolled: number,
  morph: number,
): number {
  return THREE.MathUtils.lerp(
    original,
    tolled,
    THREE.MathUtils.clamp(morph, 0, 1),
  );
}

export function arrowDirectionIsDescending(
  points: readonly LandscapePoint[],
): boolean {
  return points.every(
    (point, index) =>
      index === 0 ||
      point.displayHeightOriginal < points[index - 1]!.displayHeightOriginal,
  );
}

export class PotentialLandscape {
  readonly group = new THREE.Group();
  private readonly bundle: PopulationBundle;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly pointMaterial: THREE.PointsMaterial;
  private readonly trajectoryMaterial = new THREE.LineBasicMaterial({
    color: "#fff1d0",
    transparent: true,
    opacity: 0.9,
  });
  private readonly trajectoryGeometry = new THREE.BufferGeometry();
  private readonly trajectoryLine: THREE.Line;
  private readonly trajectoryHeadGeometry = new THREE.BufferGeometry();
  private readonly trajectoryHeadLine: THREE.Line;
  private readonly arrowGroup = new THREE.Group();
  private readonly arrowGeometry: THREE.ConeGeometry;
  private readonly ownsArrowGeometry: boolean;
  private readonly activeMarker: THREE.Mesh;
  private readonly equilibriumMarkers: THREE.Mesh[];
  private readonly optimumMarkers: THREE.Mesh[];
  private morph = 0;
  private targetMorph = 0;
  private trajectory: readonly LandscapePoint[] = [];
  private trajectoryName = "";
  private arrowTrajectoryName = "";
  private directionalArrows = false;
  private activeTrajectoryIndex = 0;
  private trajectoryRevealProgressValue = 1;
  private trajectoryRevealDelay = 0;
  private trajectoryRevealActive = false;
  private activeMarkerEnabled = false;
  private readonly cornerPoints: Record<"U" | "L" | "Z", LandscapePoint>;

  constructor(
    bundle: PopulationBundle,
    sharedArrowGeometry?: THREE.ConeGeometry,
  ) {
    this.bundle = bundle;
    this.arrowGeometry =
      sharedArrowGeometry ?? new THREE.ConeGeometry(0.035, 0.09, 8);
    this.ownsArrowGeometry = sharedArrowGeometry === undefined;
    this.cornerPoints = {
      U: this.cornerPoint([bundle.population, 0, 0]),
      L: this.cornerPoint([0, bundle.population, 0]),
      Z: this.cornerPoint([0, 0, bundle.population]),
    };
    const vertices = bundle.potentialLandscape.vertices;
    const positions = new Float32Array(vertices.length * 3);
    const colors = new Float32Array(vertices.length * 3);
    const IndexArray = vertices.length > 21_845 ? Uint32Array : Uint16Array;
    const indices = new IndexArray(
      bundle.potentialLandscape.triangles.length * 3,
    );
    bundle.potentialLandscape.triangles.forEach((triangle, triangleIndex) => {
      indices.set(triangle, triangleIndex * 3);
    });
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.updateSurfaceGeometry();
    this.geometry.computeVertexNormals();
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      metalness: 0.03,
      roughness: 0.84,
      emissive: "#210b07",
      emissiveIntensity: 0.34,
      transparent: true,
      opacity: 0.94,
    });
    const surface = new THREE.Mesh(this.geometry, this.material);
    surface.frustumCulled = false;
    this.pointMaterial = new THREE.PointsMaterial({
      color: "#f2b365",
      size: 0.012,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    });
    const latticePoints = new THREE.Points(this.geometry, this.pointMaterial);
    this.trajectoryLine = new THREE.Line(
      this.trajectoryGeometry,
      this.trajectoryMaterial,
    );
    this.trajectoryHeadLine = new THREE.Line(
      this.trajectoryHeadGeometry,
      this.trajectoryMaterial,
    );
    this.trajectoryHeadLine.visible = false;
    this.activeMarker = this.marker("active");
    this.equilibriumMarkers = bundle.potentialLandscape.markers.equilibria.map(
      () => this.marker("equilibrium"),
    );
    this.optimumMarkers = bundle.potentialLandscape.markers.optima.map(() =>
      this.marker("optimum"),
    );
    this.group.add(
      surface,
      latticePoints,
      this.trajectoryLine,
      this.trajectoryHeadLine,
      this.arrowGroup,
      this.activeMarker,
      ...this.equilibriumMarkers,
      ...this.optimumMarkers,
    );
    this.group.rotation.x = -0.18;
    this.setTrajectory("braess-open-q-learning", 0);
    const bestResponse =
      this.bundle.potentialLandscape.trajectories[BEST_RESPONSE_TRAJECTORY] ??
      [];
    if (bestResponse.length >= 2) {
      this.rebuildArrows(
        bestResponse.map((point) => this.positionForPoint(point)),
      );
      this.arrowTrajectoryName = BEST_RESPONSE_TRAJECTORY;
      this.updateArrowVisibility(Number.NEGATIVE_INFINITY);
    }
  }

  setTolled(active: boolean, immediate = false): void {
    this.targetMorph = active ? 1 : 0;
    if (immediate) {
      this.morph = this.targetMorph;
      this.updateSurfaceGeometry();
      this.updateTrajectoryGeometry();
    }
  }

  setTrajectory(name: string, activeIndex: number): void {
    const trajectoryChanged = name !== this.trajectoryName;
    const previousIndex = this.activeTrajectoryIndex;
    if (trajectoryChanged) {
      this.trajectoryName = name;
      this.trajectory = this.bundle.potentialLandscape.trajectories[name] ?? [];
    }
    this.activeTrajectoryIndex = Math.max(
      0,
      Math.min(this.trajectory.length - 1, activeIndex),
    );
    const bestResponse = name.endsWith("best-response");
    this.directionalArrows = bestResponse;
    this.trajectoryMaterial.color.set(bestResponse ? "#ffb45b" : "#fff1d0");
    this.trajectoryMaterial.opacity = bestResponse ? 0.92 : 0.55;
    if (trajectoryChanged) {
      this.trajectoryRevealProgressValue = bestResponse ? 0 : 1;
      this.trajectoryRevealDelay = bestResponse
        ? TRAJECTORY_REVEAL_DELAY_SECONDS
        : 0;
      this.trajectoryRevealActive = bestResponse;
      this.updateTrajectoryGeometry();
    } else if (
      this.activeTrajectoryIndex !== previousIndex &&
      !this.trajectoryRevealActive
    ) {
      this.positionActiveMarker();
    }
  }

  trajectoryLength(name: string): number {
    return this.bundle.potentialLandscape.trajectories[name]?.length ?? 0;
  }

  setActiveMarkerVisible(visible: boolean): void {
    this.activeMarkerEnabled = visible;
    this.activeMarker.visible = visible && this.trajectory.length > 0;
  }

  update(reducedMotion: boolean, frameSeconds: number): void {
    const previous = this.morph;
    this.morph = reducedMotion
      ? this.targetMorph
      : THREE.MathUtils.damp(this.morph, this.targetMorph, 4, frameSeconds);
    if (Math.abs(previous - this.morph) > 1e-5) {
      this.updateSurfaceGeometry();
      this.updateTrajectoryGeometry();
    }
    if (this.trajectoryRevealActive) {
      if (reducedMotion) {
        this.trajectoryRevealProgressValue = 1;
        this.trajectoryRevealActive = false;
      } else if (this.trajectoryRevealDelay > 0) {
        this.trajectoryRevealDelay = Math.max(
          0,
          this.trajectoryRevealDelay - frameSeconds,
        );
      } else {
        this.trajectoryRevealProgressValue = Math.min(
          1,
          this.trajectoryRevealProgressValue +
            frameSeconds / TRAJECTORY_REVEAL_DURATION_SECONDS,
        );
        if (this.trajectoryRevealProgressValue >= 1) {
          this.trajectoryRevealActive = false;
        }
      }
      this.updateTrajectoryRevealGeometry();
    }
    this.positionMarkers();
  }

  trajectoryRevealProgress(): number {
    return this.trajectoryRevealProgressValue;
  }

  trajectoryRevealComplete(): boolean {
    return !this.trajectoryRevealActive;
  }

  restartTrajectoryReveal(): void {
    if (!this.directionalArrows || this.trajectory.length < 2) return;
    this.trajectoryRevealProgressValue = 0;
    this.trajectoryRevealDelay = TRAJECTORY_REVEAL_DELAY_SECONDS;
    this.trajectoryRevealActive = true;
    this.updateTrajectoryRevealGeometry();
  }

  morphProgress(): number {
    return this.morph;
  }

  morphComplete(): boolean {
    return Math.abs(this.morph - this.targetMorph) < 0.001;
  }

  focusPosition(target: "equilibrium" | "optimum"): THREE.Vector3 {
    const markers =
      target === "equilibrium" && this.targetMorph < 0.5
        ? this.bundle.potentialLandscape.markers.equilibria
        : this.bundle.potentialLandscape.markers.optima;
    const marker = markers[0];
    return marker
      ? this.worldPositionForPoint(this.markerPoint(marker))
      : new THREE.Vector3();
  }

  cornerPosition(route: "U" | "L" | "Z"): THREE.Vector3 {
    return this.worldPositionForPoint(this.cornerPoints[route]);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.pointMaterial.dispose();
    this.trajectoryGeometry.dispose();
    this.trajectoryHeadGeometry.dispose();
    this.trajectoryMaterial.dispose();
    this.disposeMesh(this.activeMarker);
    this.equilibriumMarkers.forEach((marker) => this.disposeMesh(marker));
    this.optimumMarkers.forEach((marker) => this.disposeMesh(marker));
    this.disposeArrowMaterials();
    if (this.ownsArrowGeometry) this.arrowGeometry.dispose();
  }

  private updateSurfaceGeometry(): void {
    const positions = this.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    this.bundle.potentialLandscape.vertices.forEach((vertex, index) => {
      const height = interpolateLandscapeHeight(
        vertex.displayHeightOriginal,
        vertex.displayHeightTolled,
        this.morph,
      );
      positions.setXYZ(
        index,
        vertex.displayCoordinates[0] * 2.4,
        height * 2.25 - 0.52,
        vertex.displayCoordinates[1] * 2.4,
      );
      const color = landscapeColor(height);
      colors.setXYZ(index, color.r, color.g, color.b);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  private updateTrajectoryGeometry(): void {
    const points = this.trajectory.map((point) => this.positionForPoint(point));
    this.trajectoryGeometry.setFromPoints(points);
    if (this.directionalArrows) {
      if (this.arrowTrajectoryName !== this.trajectoryName) {
        this.rebuildArrows(points);
        this.arrowTrajectoryName = this.trajectoryName;
      } else {
        this.positionArrows(points);
      }
    } else {
      this.updateArrowVisibility(Number.NEGATIVE_INFINITY);
    }
    this.updateTrajectoryRevealGeometry(points);
  }

  private updateTrajectoryRevealGeometry(
    positionedPoints = this.trajectory.map((point) =>
      this.positionForPoint(point),
    ),
  ): void {
    if (positionedPoints.length === 0) {
      this.trajectoryGeometry.setDrawRange(0, 0);
      this.trajectoryHeadLine.visible = false;
      this.activeMarker.visible = false;
      return;
    }
    this.activeMarker.visible = this.activeMarkerEnabled;
    if (!this.trajectoryRevealActive) {
      this.trajectoryGeometry.setDrawRange(0, positionedPoints.length);
      this.trajectoryHeadLine.visible = false;
      this.positionActiveMarker();
      this.updateArrowVisibility(
        this.directionalArrows
          ? positionedPoints.length - 1
          : Number.NEGATIVE_INFINITY,
      );
      return;
    }
    const scaledProgress =
      this.trajectoryRevealProgressValue * (positionedPoints.length - 1);
    const firstIndex = Math.floor(scaledProgress);
    const secondIndex = Math.min(positionedPoints.length - 1, firstIndex + 1);
    const segmentProgress = scaledProgress - firstIndex;
    const first = positionedPoints[firstIndex]!;
    const second = positionedPoints[secondIndex]!;
    const head = first.clone().lerp(second, segmentProgress);
    this.trajectoryGeometry.setDrawRange(0, firstIndex + 1);
    this.trajectoryHeadGeometry.setFromPoints([first, head]);
    this.trajectoryHeadLine.visible = secondIndex > firstIndex;
    this.activeMarker.position.copy(head);
    this.updateArrowVisibility(
      this.directionalArrows ? scaledProgress : Number.NEGATIVE_INFINITY,
    );
  }

  private positionActiveMarker(): void {
    const active = this.trajectory[this.activeTrajectoryIndex];
    if (active) this.activeMarker.position.copy(this.positionForPoint(active));
  }

  private rebuildArrows(points: readonly THREE.Vector3[]): void {
    this.disposeArrowMaterials();
    this.arrowGroup.clear();
    if (points.length < 2) return;
    const interval = Math.max(1, Math.floor((points.length - 1) / 10));
    for (let index = interval; index < points.length; index += interval) {
      const previous = points[index - 1]!;
      const current = points[index]!;
      const direction = current.clone().sub(previous);
      if (direction.lengthSq() < 1e-8) continue;
      const arrow = new THREE.Mesh(
        this.arrowGeometry,
        new THREE.MeshBasicMaterial({
          color: "#ffd38a",
          depthTest: true,
          transparent: true,
          opacity: 0,
        }),
      );
      arrow.position.copy(current).add(new THREE.Vector3(0, 0.018, 0));
      arrow.userData.trajectoryIndex = index;
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      );
      this.arrowGroup.add(arrow);
    }
  }

  private positionArrows(points: readonly THREE.Vector3[]): void {
    this.arrowGroup.children.forEach((arrow) => {
      const index = Number(arrow.userData.trajectoryIndex ?? -1);
      if (index <= 0 || index >= points.length) return;
      const previous = points[index - 1]!;
      const current = points[index]!;
      const direction = current.clone().sub(previous);
      if (direction.lengthSq() < 1e-8) return;
      arrow.position.copy(current).add(new THREE.Vector3(0, 0.018, 0));
      arrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize(),
      );
    });
  }

  private updateArrowVisibility(visibleTrajectoryIndex: number): void {
    this.arrowGroup.children.forEach((arrow) => {
      const trajectoryIndex = Number(
        arrow.userData.trajectoryIndex ?? Number.POSITIVE_INFINITY,
      );
      const reveal = THREE.MathUtils.smoothstep(
        visibleTrajectoryIndex - trajectoryIndex,
        0,
        3,
      );
      const material = (arrow as THREE.Mesh).material as THREE.Material;
      material.userData.baseOpacity = reveal;
      material.opacity = reveal;
      // Keep every cone renderable, even while transparent, so the GPU uploads
      // them during the reveal delay instead of at first appearance.
      arrow.visible = true;
      arrow.scale.setScalar(1);
    });
  }

  private disposeArrowMaterials(): void {
    this.arrowGroup.children.forEach((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
  }

  private positionMarkers(): void {
    this.bundle.potentialLandscape.markers.equilibria.forEach(
      (marker, index) => {
        this.equilibriumMarkers[index]!.position.copy(
          this.positionForPoint(this.markerPoint(marker)),
        );
      },
    );
    this.bundle.potentialLandscape.markers.optima.forEach((marker, index) => {
      this.optimumMarkers[index]!.position.copy(
        this.positionForPoint(this.markerPoint(marker)),
      );
    });
  }

  private positionForPoint(point: LandscapePoint): THREE.Vector3 {
    const height = interpolateLandscapeHeight(
      point.displayHeightOriginal,
      point.displayHeightTolled,
      this.morph,
    );
    return new THREE.Vector3(
      point.displayCoordinates[0] * 2.4,
      height * 2.25 - 0.47,
      point.displayCoordinates[1] * 2.4,
    );
  }

  private worldPositionForPoint(point: LandscapePoint): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(this.positionForPoint(point));
  }

  private markerPoint(
    marker: PopulationBundle["potentialLandscape"]["markers"]["equilibria"][number],
  ): LandscapePoint {
    const transform = this.bundle.potentialLandscape.heightTransform;
    return {
      routeCounts: marker.routeCounts,
      displayCoordinates: marker.displayCoordinates,
      displayHeightOriginal:
        (marker.originalPotential - transform.originalMinimum) /
        transform.sharedScale,
      displayHeightTolled:
        (marker.tolledPotential - transform.tolledMinimum) /
        transform.sharedScale,
    };
  }

  private cornerPoint(counts: [number, number, number]): LandscapePoint {
    const vertex = this.bundle.potentialLandscape.vertices.find((candidate) =>
      candidate.routeCounts.every((count, index) => count === counts[index]),
    );
    if (!vertex)
      throw new Error(`missing landscape corner ${counts.join(",")}`);
    return vertex;
  }

  private marker(kind: "active" | "equilibrium" | "optimum"): THREE.Mesh {
    if (kind === "equilibrium") {
      return new THREE.Mesh(
        new THREE.OctahedronGeometry(0.095, 0),
        new THREE.MeshStandardMaterial({
          color: "#ff7a3d",
          emissive: "#ff3030",
          emissiveIntensity: 1.25,
          roughness: 0.45,
          transparent: true,
        }),
      );
    }
    if (kind === "optimum") {
      const marker = new THREE.Mesh(
        new THREE.TorusGeometry(0.084, 0.018, 8, 24),
        new THREE.MeshStandardMaterial({
          color: "#fff1d0",
          emissive: "#f4b942",
          emissiveIntensity: 1.5,
          roughness: 0.4,
          transparent: true,
        }),
      );
      marker.rotation.x = Math.PI / 2;
      return marker;
    }
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 16, 12),
      new THREE.MeshStandardMaterial({
        color: "#fff1d0",
        emissive: "#ffb45b",
        emissiveIntensity: 2.2,
        roughness: 0.3,
        transparent: true,
      }),
    );
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  }
}
