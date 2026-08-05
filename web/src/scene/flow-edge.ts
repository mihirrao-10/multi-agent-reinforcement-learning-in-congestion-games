import * as THREE from "three";

import { edgeColor, edgeRadius, type EdgeRole } from "./materials";

export class FlowEdge {
  readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  readonly curve: THREE.CatmullRomCurve3;
  private readonly basePositions: Float32Array;
  private readonly centers: THREE.Vector3[];
  private readonly radialSegments: number;
  private readonly tubularSegments: number;
  private role: EdgeRole;
  private radius = 0.02;

  constructor(curve: THREE.CatmullRomCurve3, role: EdgeRole) {
    this.curve = curve;
    this.role = role;
    this.tubularSegments = 72;
    this.radialSegments = 10;
    const geometry = new THREE.TubeGeometry(
      curve,
      this.tubularSegments,
      1,
      this.radialSegments,
      false,
    );
    const positions = geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    this.basePositions = new Float32Array(positions.array as Float32Array);
    this.centers = Array.from(
      { length: this.tubularSegments + 1 },
      (_, index) => curve.getPointAt(index / this.tubularSegments),
    );
    const material = new THREE.MeshStandardMaterial({
      color: edgeColor(role, 0),
      emissive: edgeColor(role, 0),
      emissiveIntensity: role === "shortcut" ? 0.9 : 0.55,
      metalness: 0.08,
      roughness: 0.54,
      transparent: true,
      opacity: 0.92,
      depthWrite: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.update(0, false);
  }

  update(load: number, focused: boolean, visible = true): void {
    const nextRadius = edgeRadius(load);
    if (Math.abs(nextRadius - this.radius) > 1e-5) {
      this.radius = nextRadius;
      const position = this.mesh.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const target = position.array as Float32Array;
      const ringSize = this.radialSegments + 1;
      const point = new THREE.Vector3();
      const center = new THREE.Vector3();
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const ring = Math.floor(vertex / ringSize);
        center.copy(this.centers[Math.min(ring, this.centers.length - 1)]!);
        point.fromArray(this.basePositions, vertex * 3);
        point.sub(center).multiplyScalar(nextRadius).add(center);
        point.toArray(target, vertex * 3);
      }
      position.needsUpdate = true;
      this.mesh.geometry.computeBoundingSphere();
    }
    const color = edgeColor(this.role, load);
    this.mesh.material.color.copy(color);
    this.mesh.material.emissive.copy(color);
    this.mesh.material.emissiveIntensity = focused
      ? 1.6
      : this.role === "shortcut"
        ? 0.9
        : 0.58;
    const opacity = visible ? (focused ? 1 : 0.9) : 0.05;
    this.mesh.material.opacity = opacity;
    this.mesh.material.userData.baseOpacity = opacity;
  }

  setRole(role: EdgeRole): void {
    this.role = role;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
