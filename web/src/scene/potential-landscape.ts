import * as THREE from "three";

import type { StoryData } from "../data/story-schema";
import { landscapeColor } from "./materials";

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

export class PotentialLandscape {
  readonly group = new THREE.Group();
  private readonly story: StoryData;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly pointMaterial: THREE.PointsMaterial;
  private readonly trajectoryMaterial = new THREE.LineBasicMaterial({
    color: "#fff1d0",
    transparent: true,
    opacity: 0.92,
  });
  private readonly trajectoryGeometry = new THREE.BufferGeometry();
  private readonly trajectoryLine: THREE.Line;
  private readonly activeMarker: THREE.Mesh;
  private readonly equilibriumMarker: THREE.Mesh;
  private readonly optimumMarker: THREE.Mesh;
  private morph = 0;
  private targetMorph = 0;
  private trajectory: readonly number[] = [];
  private activeTrajectoryIndex = 0;
  private readonly cornerVertexIndices: Record<"U" | "L" | "Z", number>;

  constructor(story: StoryData) {
    this.story = story;
    this.cornerVertexIndices = {
      U: this.findVertexIndex([80, 0, 0]),
      L: this.findVertexIndex([0, 80, 0]),
      Z: this.findVertexIndex([0, 0, 80]),
    };
    const vertexCount = story.potentialLandscape.vertices.length;
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array(
      story.potentialLandscape.triangles.length * 3,
    );
    story.potentialLandscape.triangles.forEach((triangle, triangleIndex) => {
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
      metalness: 0.05,
      roughness: 0.82,
      emissive: "#210b07",
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.96,
    });
    const surface = new THREE.Mesh(this.geometry, this.material);
    surface.frustumCulled = false;
    this.pointMaterial = new THREE.PointsMaterial({
      color: "#f2b365",
      size: 0.012,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const latticePoints = new THREE.Points(this.geometry, this.pointMaterial);
    this.trajectoryLine = new THREE.Line(
      this.trajectoryGeometry,
      this.trajectoryMaterial,
    );
    this.activeMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      new THREE.MeshStandardMaterial({
        color: "#fff1d0",
        emissive: "#ffb45b",
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    );
    this.equilibriumMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.105, 0),
      new THREE.MeshStandardMaterial({
        color: "#ff7a3d",
        emissive: "#ff3030",
        emissiveIntensity: 1.2,
        roughness: 0.48,
      }),
    );
    this.optimumMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.022, 8, 24),
      new THREE.MeshStandardMaterial({
        color: "#fff1d0",
        emissive: "#f4b942",
        emissiveIntensity: 1.5,
        roughness: 0.42,
      }),
    );
    this.optimumMarker.rotation.x = Math.PI / 2;
    this.group.add(
      surface,
      latticePoints,
      this.trajectoryLine,
      this.activeMarker,
      this.equilibriumMarker,
      this.optimumMarker,
    );
    this.group.rotation.x = -0.18;
    this.setTrajectory("braess-open-q-learning", 0);
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
    this.trajectory =
      this.story.potentialLandscape.trajectoryVertexIndices[name] ?? [];
    this.activeTrajectoryIndex = Math.max(
      0,
      Math.min(this.trajectory.length - 1, activeIndex),
    );
    const bestResponse = name.endsWith("best-response");
    this.trajectoryMaterial.color.set(bestResponse ? "#ffb45b" : "#fff1d0");
    this.trajectoryMaterial.opacity = bestResponse ? 0.92 : 0.62;
    this.updateTrajectoryGeometry();
  }

  update(reducedMotion: boolean): void {
    const previous = this.morph;
    this.morph = reducedMotion
      ? this.targetMorph
      : THREE.MathUtils.lerp(this.morph, this.targetMorph, 0.055);
    if (Math.abs(previous - this.morph) > 1e-5) {
      this.updateSurfaceGeometry();
      this.updateTrajectoryGeometry();
    }
    this.positionMarkers();
  }

  morphProgress(): number {
    return this.morph;
  }

  morphComplete(): boolean {
    return Math.abs(this.morph - this.targetMorph) < 0.001;
  }

  focusPosition(target: "equilibrium" | "optimum"): THREE.Vector3 {
    const index =
      target === "equilibrium" && this.targetMorph < 0.5
        ? this.story.potentialLandscape.equilibriumVertexIndex
        : this.story.potentialLandscape.optimumVertexIndex;
    return this.worldPositionForVertex(index);
  }

  cornerPosition(route: "U" | "L" | "Z"): THREE.Vector3 {
    return this.worldPositionForVertex(this.cornerVertexIndices[route]);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.pointMaterial.dispose();
    this.trajectoryGeometry.dispose();
    this.trajectoryMaterial.dispose();
    this.disposeMesh(this.activeMarker);
    this.disposeMesh(this.equilibriumMarker);
    this.disposeMesh(this.optimumMarker);
  }

  private updateSurfaceGeometry(): void {
    const positions = this.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    this.story.potentialLandscape.vertices.forEach((vertex, index) => {
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
    const points = this.trajectory.map((index) =>
      this.positionForVertex(index),
    );
    this.trajectoryGeometry.setFromPoints(points);
    const activeVertex = this.trajectory[this.activeTrajectoryIndex];
    if (activeVertex !== undefined)
      this.activeMarker.position.copy(this.positionForVertex(activeVertex));
  }

  private positionMarkers(): void {
    this.equilibriumMarker.position.lerpVectors(
      this.positionForVertex(
        this.story.potentialLandscape.equilibriumVertexIndex,
      ),
      this.positionForVertex(this.story.potentialLandscape.optimumVertexIndex),
      this.morph,
    );
    this.optimumMarker.position.copy(
      this.positionForVertex(this.story.potentialLandscape.optimumVertexIndex),
    );
  }

  private positionForVertex(index: number): THREE.Vector3 {
    const vertex = this.story.potentialLandscape.vertices[index];
    if (!vertex) return new THREE.Vector3();
    const height = interpolateLandscapeHeight(
      vertex.displayHeightOriginal,
      vertex.displayHeightTolled,
      this.morph,
    );
    return new THREE.Vector3(
      vertex.displayCoordinates[0] * 2.4,
      height * 2.25 - 0.47,
      vertex.displayCoordinates[1] * 2.4,
    );
  }

  private worldPositionForVertex(index: number): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(this.positionForVertex(index));
  }

  private findVertexIndex(counts: readonly [number, number, number]): number {
    const index = this.story.potentialLandscape.vertices.findIndex((vertex) =>
      vertex.routeCounts.every((count, route) => count === counts[route]),
    );
    if (index < 0)
      throw new Error(`missing landscape corner ${counts.join(",")}`);
    return index;
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  }
}
