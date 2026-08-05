import * as THREE from "three";

import type { StorySnapshot } from "../data/story-schema";
import { AgentParticles } from "./agent-particles";
import { FlowEdge } from "./flow-edge";

type EdgeId = "SU" | "UT" | "SV" | "VT" | "UV";

const NODE_POSITIONS: Record<"S" | "U" | "V" | "T", THREE.Vector3> = {
  S: new THREE.Vector3(-1.65, 0, 0),
  U: new THREE.Vector3(0, 0.82, -0.24),
  V: new THREE.Vector3(0, -0.82, 0.24),
  T: new THREE.Vector3(1.65, 0, 0),
};

export const ROUTE_EDGE_IDS: readonly (readonly EdgeId[])[] = [
  ["SU", "UT"],
  ["SV", "VT"],
  ["SU", "UV", "VT"],
];

function curve(points: THREE.Vector3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

export class CongestionScene {
  readonly group = new THREE.Group();
  readonly curves: Record<EdgeId, THREE.CatmullRomCurve3>;
  private readonly edges: Record<EdgeId, FlowEdge>;
  private readonly particles: AgentParticles;
  private readonly tollBands: THREE.Mesh[] = [];
  private snapshot: StorySnapshot | null = null;
  private shortcutOpen = true;
  private focusedEdges = new Set<EdgeId>();

  constructor() {
    this.curves = {
      SU: curve([
        NODE_POSITIONS.S,
        new THREE.Vector3(-1.08, 0.25, -0.28),
        new THREE.Vector3(-0.48, 0.74, -0.42),
        NODE_POSITIONS.U,
      ]),
      UT: curve([
        NODE_POSITIONS.U,
        new THREE.Vector3(0.5, 1.05, 0.05),
        new THREE.Vector3(1.13, 0.46, 0.34),
        NODE_POSITIONS.T,
      ]),
      SV: curve([
        NODE_POSITIONS.S,
        new THREE.Vector3(-1.04, -0.35, 0.34),
        new THREE.Vector3(-0.48, -1.01, 0.44),
        NODE_POSITIONS.V,
      ]),
      VT: curve([
        NODE_POSITIONS.V,
        new THREE.Vector3(0.5, -1.08, -0.06),
        new THREE.Vector3(1.12, -0.45, -0.32),
        NODE_POSITIONS.T,
      ]),
      UV: curve([
        NODE_POSITIONS.U,
        new THREE.Vector3(0.2, 0.35, -0.08),
        new THREE.Vector3(-0.18, -0.34, 0.08),
        NODE_POSITIONS.V,
      ]),
    };
    this.edges = {
      SU: new FlowEdge(this.curves.SU, "variable"),
      UT: new FlowEdge(this.curves.UT, "constant"),
      SV: new FlowEdge(this.curves.SV, "constant"),
      VT: new FlowEdge(this.curves.VT, "variable"),
      UV: new FlowEdge(this.curves.UV, "shortcut"),
    };
    Object.values(this.edges).forEach((edge) => this.group.add(edge.mesh));
    this.createNodes();
    this.createTollBands();
    this.particles = new AgentParticles(this.curves);
    this.group.add(this.particles.mesh);
  }

  setSnapshot(snapshot: StorySnapshot): void {
    this.snapshot = snapshot;
    this.particles.setSnapshot(snapshot);
    this.updateEdges();
  }

  setScenario(shortcutOpen: boolean, tollsActive: boolean): void {
    this.shortcutOpen = shortcutOpen;
    this.tollBands.forEach((band) => {
      band.visible = tollsActive;
    });
    this.updateEdges();
  }

  focus(target: "none" | "shortcut" | "bottleneck" | "U" | "L" | "Z"): void {
    this.focusedEdges.clear();
    if (target === "shortcut") this.focusedEdges.add("UV");
    if (target === "bottleneck") {
      this.focusedEdges.add("SU");
      this.focusedEdges.add("VT");
    }
    if (target === "U" || target === "L" || target === "Z") {
      const routeIndex = { U: 0, L: 1, Z: 2 }[target];
      ROUTE_EDGE_IDS[routeIndex]?.forEach((edge) =>
        this.focusedEdges.add(edge),
      );
    }
    this.updateEdges();
  }

  focusPosition(target: "shortcut" | "bottleneck"): THREE.Vector3 {
    if (target === "shortcut") return this.curves.UV.getPointAt(0.5);
    return this.curves.SU.getPointAt(0.55)
      .clone()
      .lerp(this.curves.VT.getPointAt(0.45), 0.5);
  }

  update(elapsedSeconds: number, reducedMotion: boolean): void {
    this.particles.update(elapsedSeconds, reducedMotion);
    if (!reducedMotion) {
      this.tollBands.forEach((band, index) => {
        band.rotation.z += 0.0007 * (index === 0 ? 1 : -1);
      });
    }
  }

  dispose(): void {
    Object.values(this.edges).forEach((edge) => edge.dispose());
    this.particles.dispose();
    this.group.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !Object.values(this.edges).some((edge) => edge.mesh === object)
      ) {
        const mesh = object as THREE.Mesh<
          THREE.BufferGeometry,
          THREE.Material | THREE.Material[]
        >;
        mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material))
          material.forEach((entry) => entry.dispose());
        else material.dispose();
      }
    });
  }

  private updateEdges(): void {
    if (!this.snapshot) return;
    for (const [identifier, edge] of Object.entries(this.edges) as [
      EdgeId,
      FlowEdge,
    ][]) {
      edge.update(
        this.snapshot.edgeLoads[identifier] ?? 0,
        this.focusedEdges.has(identifier),
        identifier !== "UV" || this.shortcutOpen,
      );
    }
  }

  private createNodes(): void {
    for (const [identifier, position] of Object.entries(NODE_POSITIONS)) {
      const isEndpoint = identifier === "S" || identifier === "T";
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(isEndpoint ? 0.095 : 0.078, 24, 18),
        new THREE.MeshStandardMaterial({
          color: isEndpoint ? "#fff1d0" : "#f4b942",
          emissive: isEndpoint ? "#ffb24b" : "#c66225",
          emissiveIntensity: isEndpoint ? 1.5 : 0.85,
          roughness: 0.4,
          metalness: 0.08,
        }),
      );
      node.position.copy(position);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(isEndpoint ? 0.17 : 0.13, 20, 14),
        new THREE.MeshBasicMaterial({
          color: isEndpoint ? "#ffb24b" : "#ff7a3d",
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
        }),
      );
      halo.position.copy(position);
      this.group.add(node, halo);
      if (isEndpoint) {
        const light = new THREE.PointLight("#ff9d42", 0.32, 1.4, 2);
        light.position.copy(position);
        this.group.add(light);
      }
    }
  }

  private createTollBands(): void {
    for (const edgeId of ["SU", "VT"] as const) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.009, 8, 32),
        new THREE.MeshBasicMaterial({
          color: "#fff1d0",
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      band.position.copy(this.curves[edgeId].getPointAt(0.55));
      band.rotation.set(Math.PI / 2.7, 0.45, edgeId === "SU" ? 0.3 : -0.3);
      band.visible = false;
      this.tollBands.push(band);
      this.group.add(band);
    }
  }
}

export { NODE_POSITIONS };
