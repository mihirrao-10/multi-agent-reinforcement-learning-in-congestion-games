import * as THREE from "three";

import {
  EDGE_RADIUS_MIN,
  REDUCED_MOTION_FLOW_TIME,
  edgeColor,
  edgeFlowSpeed,
  edgeOpacity,
  edgeRadius,
  type EdgeRole,
} from "./materials";

const FLOW_VERTEX_SHADER = `
  varying vec2 vFlowUv;
  varying float vRim;
  uniform float uShell;

  void main() {
    vFlowUv = uv;
    vec3 expanded = position + normal * uShell;
    vec3 viewPosition = (modelViewMatrix * vec4(expanded, 1.0)).xyz;
    vec3 viewNormal = normalize(normalMatrix * normal);
    vRim = pow(1.0 - abs(dot(viewNormal, normalize(-viewPosition))), 2.0);
    gl_Position = projectionMatrix * vec4(viewPosition, 1.0);
  }
`;

const FLOW_FRAGMENT_SHADER = `
  varying vec2 vFlowUv;
  varying float vRim;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFlowOffset;
  uniform float uPhase;
  uniform float uFocus;
  uniform float uLayer;
  uniform float uSceneOpacity;

  void main() {
    const float TAU = 6.28318530718;
    float phaseA = TAU * (vFlowUv.x * 1.18 - uFlowOffset + uPhase);
    float phaseB = TAU * (vFlowUv.x * 0.57 - uFlowOffset * 0.48 + uPhase * 1.73);
    float phaseC = TAU * (vFlowUv.x * 0.31 - uFlowOffset * 0.24 + uPhase * 0.63);
    float broadA = 0.5 + 0.5 * sin(phaseA);
    float broadB = 0.5 + 0.5 * sin(phaseB);
    float broadC = 0.5 + 0.5 * sin(phaseC);
    float flowingLight = 0.72 + broadA * 0.13 + broadB * 0.09 + broadC * 0.06;
    float focusLift = 1.0 + uFocus * 0.24;
    vec3 bodyColor = uColor * flowingLight * focusLift + vec3(vRim * 0.08);
    vec3 glowColor = uColor * (0.68 + broadB * 0.18 + vRim * 0.35) * focusLift;
    vec3 color = mix(bodyColor, glowColor, uLayer);
    float bodyAlpha = uOpacity * (0.86 + broadA * 0.09 + broadB * 0.05);
    float glowAlpha = uOpacity * (0.11 + broadA * 0.035 + vRim * 0.055);
    float alpha = mix(bodyAlpha, glowAlpha, uLayer) * uSceneOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

interface FlowUniforms {
  uColor: { value: THREE.Color };
  uOpacity: { value: number };
  uFlowOffset: { value: number };
  uPhase: { value: number };
  uFocus: { value: number };
  uLayer: { value: number };
  uShell: { value: number };
  uSceneOpacity: { value: number };
}

function createMaterial(
  phase: number,
  layer: "body" | "glow",
): THREE.ShaderMaterial & { uniforms: FlowUniforms } {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#2cd67b") },
      uOpacity: { value: 0.34 },
      uFlowOffset: { value: 0 },
      uPhase: { value: phase },
      uFocus: { value: 0 },
      uLayer: { value: layer === "glow" ? 1 : 0 },
      uShell: { value: 0 },
      uSceneOpacity: { value: 1 },
    },
    vertexShader: FLOW_VERTEX_SHADER,
    fragmentShader: FLOW_FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: layer === "glow" ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  }) as THREE.ShaderMaterial & { uniforms: FlowUniforms };
}

function dampingFactor(rate: number, seconds: number): number {
  return 1 - Math.exp(-rate * Math.max(0, seconds));
}

export class FlowEdge {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  readonly glowMesh: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  readonly curve: THREE.CatmullRomCurve3;
  private readonly basePositions: Float32Array;
  private readonly centers: THREE.Vector3[];
  private readonly radialSegments = 12;
  private readonly tubularSegments = 80;
  private readonly bodyMaterial: THREE.ShaderMaterial & {
    uniforms: FlowUniforms;
  };
  private readonly glowMaterial: THREE.ShaderMaterial & {
    uniforms: FlowUniforms;
  };
  private role: EdgeRole;
  private radius = EDGE_RADIUS_MIN;
  private targetRadius = EDGE_RADIUS_MIN;
  private opacity = 0.34;
  private targetOpacity = 0.34;
  private speed = 0.42;
  private targetSpeed = 0.42;
  private focus = 0;
  private targetFocus = 0;
  private readonly color = new THREE.Color("#2cd67b");
  private readonly targetColor = new THREE.Color("#2cd67b");
  private flowOffset = 0;
  private lastElapsed: number | null = null;

  constructor(curve: THREE.CatmullRomCurve3, role: EdgeRole, phase = 0) {
    this.curve = curve;
    this.role = role;
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
    this.bodyMaterial = createMaterial(phase, "body");
    this.glowMaterial = createMaterial(phase, "glow");
    this.mesh = new THREE.Mesh(geometry, this.bodyMaterial);
    this.glowMesh = new THREE.Mesh(geometry, this.glowMaterial);
    this.mesh.frustumCulled = false;
    this.glowMesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.glowMesh.renderOrder = 0;
    this.group.add(this.glowMesh, this.mesh);
    this.update(0, 100, false);
    this.applyCurrent(true);
  }

  update(
    load: number,
    population: number,
    focused: boolean,
    visible = true,
  ): void {
    this.targetRadius = edgeRadius(load, population);
    this.targetColor.copy(edgeColor(this.role, load, population));
    this.targetOpacity = visible ? edgeOpacity(this.role, load, population) : 0;
    this.targetSpeed = edgeFlowSpeed(this.role, load, population);
    this.targetFocus = focused ? 1 : 0;
  }

  animate(elapsedSeconds: number, reducedMotion: boolean): void {
    const frameSeconds =
      this.lastElapsed === null
        ? 1 / 60
        : Math.max(0, Math.min(0.1, elapsedSeconds - this.lastElapsed));
    this.lastElapsed = elapsedSeconds;
    if (reducedMotion) {
      this.radius = this.targetRadius;
      this.opacity = this.targetOpacity;
      this.speed = this.targetSpeed;
      this.focus = this.targetFocus;
      this.color.copy(this.targetColor);
      this.flowOffset = REDUCED_MOTION_FLOW_TIME;
    } else {
      const quantitativeMix = dampingFactor(6.5, frameSeconds);
      this.radius = THREE.MathUtils.lerp(
        this.radius,
        this.targetRadius,
        quantitativeMix,
      );
      this.opacity = THREE.MathUtils.lerp(
        this.opacity,
        this.targetOpacity,
        quantitativeMix,
      );
      this.speed = THREE.MathUtils.lerp(
        this.speed,
        this.targetSpeed,
        quantitativeMix,
      );
      this.focus = THREE.MathUtils.lerp(
        this.focus,
        this.targetFocus,
        dampingFactor(8, frameSeconds),
      );
      this.color.lerp(this.targetColor, quantitativeMix);
      this.flowOffset += frameSeconds * this.speed;
    }
    this.applyCurrent(reducedMotion);
  }

  setRole(role: EdgeRole): void {
    this.role = role;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.bodyMaterial.dispose();
    this.glowMaterial.dispose();
  }

  private applyCurrent(forceGeometry: boolean): void {
    const geometryRadius = Number(this.mesh.userData.geometryRadius ?? -1);
    if (forceGeometry || Math.abs(this.radius - geometryRadius) > 0.00008) {
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
        point.sub(center).multiplyScalar(this.radius).add(center);
        point.toArray(target, vertex * 3);
      }
      position.needsUpdate = true;
      this.mesh.geometry.computeBoundingSphere();
      this.mesh.userData.geometryRadius = this.radius;
    }
    for (const material of [this.bodyMaterial, this.glowMaterial]) {
      material.uniforms.uColor.value.copy(this.color);
      material.uniforms.uOpacity.value = this.opacity;
      material.uniforms.uFlowOffset.value = this.flowOffset;
      material.uniforms.uFocus.value = this.focus;
    }
    this.glowMaterial.uniforms.uShell.value = 0.004 + this.radius * 0.06;
  }
}
