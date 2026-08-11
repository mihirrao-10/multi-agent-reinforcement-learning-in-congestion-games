import * as THREE from "three";

import type {
  NetworkPresentation,
  PopulationBundle,
} from "../data/story-schema";
import type { FocusTarget, StoryState } from "../story/state-machine";
import { cameraPoseForChapter } from "./camera-poses";
import { CongestionScene, NODE_POSITIONS } from "./congestion-scene";
import {
  NODE_VISUALS,
  edgeColorHex,
  edgeRadius,
  type EdgeRole,
} from "./materials";
import { OrbitController } from "./orbit-controller";
import { PotentialLandscape } from "./potential-landscape";
import { ProjectedLabels } from "./projected-labels";

interface SceneCallbacks {
  readonly onExploreChange: (exploring: boolean) => void;
  readonly onManualInteraction: () => void;
  readonly onEscape: () => void;
}

export class SceneController {
  private readonly canvas: HTMLCanvasElement;
  private bundle: PopulationBundle;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.02, 80);
  private readonly network = new CongestionScene();
  private readonly trajectoryArrowGeometry = new THREE.ConeGeometry(
    0.035,
    0.09,
    8,
  );
  private landscape: PotentialLandscape;
  private readonly controls: OrbitController;
  private readonly labels: ProjectedLabels;
  private readonly upperCornerLabel: HTMLSpanElement;
  private readonly lowerCornerLabel: HTMLSpanElement;
  private readonly shortcutCornerLabel: HTMLSpanElement;
  private readonly equilibriumLabel: HTMLSpanElement;
  private readonly optimumLabel: HTMLSpanElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly clock = new THREE.Clock();
  private animationFrame = 0;
  private networkOpacity = 1;
  private targetNetworkOpacity = 1;
  private reducedMotion = false;
  private activeChapter = -1;
  private visible = !document.hidden;
  private disposed = false;
  private needsRender = true;

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLElement,
    story: PopulationBundle,
    reducedMotion: boolean,
    callbacks: SceneCallbacks,
  ) {
    this.canvas = canvas;
    this.bundle = story;
    this.reducedMotion = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.045);
    this.scene.add(new THREE.AmbientLight(0x8e8e9b, 0.2));
    const key = new THREE.DirectionalLight(0xff8b45, 2.4);
    key.position.set(-2.8, 4.2, 3.5);
    const rim = new THREE.DirectionalLight(0x7f8fa8, 0.68);
    rim.position.set(3.5, 1.8, -4);
    this.scene.add(key, rim);
    this.landscape = new PotentialLandscape(
      story,
      this.trajectoryArrowGeometry,
    );
    this.scene.add(this.network.group, this.landscape.group);
    this.labels = new ProjectedLabels(labelContainer);
    for (const [label, position] of Object.entries(NODE_POSITIONS)) {
      this.labels.add(
        label,
        position.clone().add(new THREE.Vector3(0, 0.215, 0)),
        "network",
      );
    }
    this.upperCornerLabel = this.labels.add(
      "all Upper",
      this.landscape.cornerPosition("U"),
      "landscape",
    );
    this.lowerCornerLabel = this.labels.add(
      "all Lower",
      this.landscape.cornerPosition("L"),
      "landscape",
    );
    this.shortcutCornerLabel = this.labels.add(
      "all Shortcut",
      this.landscape.cornerPosition("Z"),
      "landscape",
    );
    this.equilibriumLabel = this.labels.add(
      "Nash equilibrium",
      this.landscape
        .focusPosition("equilibrium")
        .add(new THREE.Vector3(0, 0.18, 0)),
      "landscape",
    );
    this.optimumLabel = this.labels.add(
      "social optimum",
      this.landscape
        .focusPosition("optimum")
        .add(new THREE.Vector3(0, 0.18, 0)),
      "landscape",
    );
    this.controls = new OrbitController(
      this.camera,
      canvas,
      cameraPoseForChapter(0),
      reducedMotion,
      callbacks,
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.resize();
  }

  async startRendering(): Promise<void> {
    if (this.animationFrame !== 0 || this.disposed) return;
    this.canvas.dataset.scenePrewarm = "pending";
    const warmupMaterial = new THREE.MeshBasicMaterial({
      color: "#ffd38a",
      depthTest: true,
      transparent: true,
      opacity: 0,
    });
    const warmupArrow = new THREE.Mesh(
      this.trajectoryArrowGeometry,
      warmupMaterial,
    );
    warmupArrow.frustumCulled = false;
    this.scene.add(warmupArrow);
    this.network.group.visible = true;
    this.landscape.group.visible = true;
    this.landscape.setActiveMarkerVisible(true);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
      // The title screen still covers the canvas here. One real render uploads
      // the large surface and arrow program before the first landscape reveal.
      this.renderer.render(this.scene, this.camera);
      this.canvas.dataset.scenePrewarm = "complete";
    } catch {
      // A synchronous render remains a safe warmup on browsers without the
      // parallel shader compilation extension.
      this.renderer.render(this.scene, this.camera);
      this.canvas.dataset.scenePrewarm = "synchronous";
    } finally {
      this.scene.remove(warmupArrow);
      warmupMaterial.dispose();
      this.landscape.setActiveMarkerVisible(false);
      this.landscape.group.visible = false;
    }
    this.clock.start();
    this.animate();
  }

  warmLandscapeAtDisplaySize(): void {
    if (this.disposed || this.canvas.clientWidth <= 1) return;
    this.resize();
    const networkVisible = this.network.group.visible;
    const landscapeVisible = this.landscape.group.visible;
    this.applyGroupOpacity(this.network.group, 1);
    this.applyGroupOpacity(this.landscape.group, 0);
    this.network.group.visible = true;
    this.landscape.group.visible = true;
    this.renderer.render(this.scene, this.camera);
    this.network.group.visible = networkVisible;
    this.landscape.group.visible = landscapeVisible;
    this.canvas.dataset.sceneDisplayWarm = "complete";
    this.needsRender = true;
  }

  setState(
    state: StoryState,
    snapshot: NetworkPresentation | null,
    totalSnapshots: number,
  ): void {
    this.needsRender = true;
    this.reducedMotion = state.reducedMotion;
    this.controls.setReducedMotion(state.reducedMotion);
    this.targetNetworkOpacity = state.sceneMode === "network" ? 1 : 0;
    this.network.setScenario(state.shortcutOpen, state.tollsActive);
    this.network.setPresentation(snapshot, state.population, state.waiting);
    if (
      state.focusTarget === "shortcut" ||
      state.focusTarget === "bottleneck"
    ) {
      this.network.focus(state.focusTarget);
    } else {
      this.network.focus("none");
    }
    this.landscape.setTolled(state.tollsActive, state.reducedMotion);
    const trajectoryName =
      state.trajectory === "best-response"
        ? "braess-open-best-response"
        : `${state.scenario}-q-learning`;
    const trajectoryLength =
      this.landscapeTrajectoryLength(trajectoryName) ||
      Math.max(1, totalSnapshots);
    const activeTrajectoryIndex = Math.round(
      (state.snapshotIndex / Math.max(1, totalSnapshots - 1)) *
        (trajectoryLength - 1),
    );
    this.landscape.setTrajectory(trajectoryName, activeTrajectoryIndex);
    this.landscape.setActiveMarkerVisible(state.activeChapter === 4);
    this.labels.setMode(state.sceneMode);
    this.equilibriumLabel.textContent = "Nash equilibrium";
    const optimumCount = this.bundle.potentialLandscape.markers.optima.length;
    this.optimumLabel.textContent = state.tollsActive
      ? optimumCount > 1
        ? `${optimumCount} tied optima = tolled equilibria`
        : "social optimum = tolled equilibrium"
      : optimumCount > 1
        ? `${optimumCount} tied exact optima`
        : "an exact social optimum";
    this.labels.setEnabled(this.equilibriumLabel, !state.tollsActive);
    this.updateLandscapeLabels();
    if (state.activeChapter !== this.activeChapter) {
      this.activeChapter = state.activeChapter;
      this.controls.setAuthoredPose(
        cameraPoseForChapter(state.activeChapter),
        state.reducedMotion,
      );
    }
    this.applyFocus(state.focusTarget);
    this.canvas.dataset.storyAct = String(state.activeChapter);
    this.canvas.dataset.sceneMode = state.sceneMode;
    this.canvas.dataset.scenario = state.scenario;
    this.canvas.dataset.shortcut = state.shortcutOpen ? "open" : "closed";
    this.canvas.dataset.tolls = state.tollsActive ? "active" : "inactive";
    this.canvas.dataset.trajectoryReveal = this.landscape
      .trajectoryRevealProgress()
      .toFixed(3);
    this.canvas.dataset.trajectoryRevealComplete = String(
      this.landscape.trajectoryRevealComplete(),
    );
    this.canvas.dataset.episode =
      snapshot && "episode" in snapshot ? String(snapshot.episode) : "";
    this.canvas.dataset.routeCounts =
      state.activeChapter === 4
        ? "strict-improvement-trajectory"
        : snapshot
          ? snapshot.routeCounts.join(",")
          : "waiting";
    this.canvas.dataset.population = String(state.population);
    this.canvas.dataset.flowRendering = "continuous-tubes";
    this.canvas.dataset.learningStudyKind =
      this.bundle.learningStudy.learningStudyKind;
    this.canvas.dataset.representedPopulation = String(
      this.bundle.learningStudy.representedPopulation,
    );
    this.canvas.dataset.simulatedLearners = String(
      this.bundle.learningStudy.simulatedLearners,
    );
    this.canvas.dataset.nodeCoreColor = NODE_VISUALS.coreColor;
    this.canvas.dataset.endpointNodeRadius = String(
      NODE_VISUALS.endpointCoreRadius,
    );
    this.canvas.dataset.junctionNodeRadius = String(
      NODE_VISUALS.junctionCoreRadius,
    );
    const edgeRoles = {
      SU: "variable",
      UT: "constant",
      SV: "constant",
      VT: "variable",
      UV: "shortcut",
    } as const satisfies Record<string, EdgeRole>;
    for (const [edge, role] of Object.entries(edgeRoles)) {
      const load = state.waiting ? 0 : (snapshot?.edgeLoads[edge] ?? 0);
      const suffix = `${edge[0]}${edge.slice(1).toLowerCase()}`;
      this.canvas.dataset[`edgeRadius${suffix}`] = edgeRadius(
        load,
        state.population,
      ).toFixed(5);
      this.canvas.dataset[`edgeColor${suffix}`] = edgeColorHex(
        role,
        load,
        state.population,
      );
    }
    this.canvas.dataset.presentationState = state.waiting
      ? "waiting"
      : "snapshot";
    this.canvas.dataset.focusTarget = state.focusTarget;
    this.canvas.dataset.userExploring = String(state.userExploring);
    this.canvas.dataset.reducedMotion = String(state.reducedMotion);
    this.canvas.dataset.trajectory = state.trajectory;
    this.canvas.dataset.directionalArrows =
      state.trajectory === "best-response" ? "downhill" : "none";
    this.canvas.dataset.surface = state.tollsActive
      ? "physical-social-cost"
      : "rosenthal-potential";
  }

  toggleExplore(): void {
    this.needsRender = true;
    this.controls.toggleExplore();
  }

  resetView(): void {
    this.needsRender = true;
    this.controls.reset();
  }

  focus(target: FocusTarget): void {
    this.needsRender = true;
    this.applyFocus(target);
  }

  highlightRoute(route: "U" | "L" | "Z"): void {
    this.needsRender = true;
    this.network.focus(route);
  }

  restartTrajectoryReveal(): void {
    this.needsRender = true;
    this.landscape.restartTrajectoryReveal();
  }

  setBundle(bundle: PopulationBundle): void {
    if (bundle === this.bundle) return;
    this.needsRender = true;
    this.scene.remove(this.landscape.group);
    this.landscape.dispose();
    this.bundle = bundle;
    this.landscape = new PotentialLandscape(
      bundle,
      this.trajectoryArrowGeometry,
    );
    this.scene.add(this.landscape.group);
    this.warmLandscapeAtDisplaySize();
    this.activeChapter = -1;
    this.updateLandscapeLabels();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.controls.dispose();
    this.network.dispose();
    this.landscape.dispose();
    this.trajectoryArrowGeometry.dispose();
    this.labels.dispose();
    this.renderer.dispose();
  }

  private landscapeTrajectoryLength(name: string): number {
    return this.landscape.trajectoryLength(name);
  }

  private applyFocus(target: FocusTarget): void {
    if (target === "shortcut" || target === "bottleneck") {
      this.controls.focus(this.network.focusPosition(target), 4.2);
    } else if (target === "equilibrium" || target === "optimum") {
      this.controls.focus(this.landscape.focusPosition(target), 4.2);
    }
  }

  private readonly onVisibilityChange = (): void => {
    this.visible = !document.hidden;
    if (this.visible) {
      this.clock.getDelta();
      this.needsRender = true;
    }
  };

  private resize(): void {
    this.needsRender = true;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.65);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private readonly animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    if (!this.visible) return;
    if (this.reducedMotion && !this.needsRender) return;
    const frameSeconds = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    this.networkOpacity = this.reducedMotion
      ? this.targetNetworkOpacity
      : THREE.MathUtils.damp(
          this.networkOpacity,
          this.targetNetworkOpacity,
          5,
          frameSeconds,
        );
    this.applyGroupOpacity(this.network.group, this.networkOpacity);
    this.applyGroupOpacity(this.landscape.group, 1 - this.networkOpacity);
    this.network.group.visible = this.networkOpacity > 0.005;
    this.landscape.group.visible = this.networkOpacity < 0.995;
    this.network.update(elapsed, this.reducedMotion);
    this.landscape.update(this.reducedMotion, frameSeconds);
    this.controls.update();
    this.updateLandscapeLabels();
    this.labels.update(
      this.camera,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.sceneTransitionComplete = String(
      Math.abs(this.networkOpacity - this.targetNetworkOpacity) < 0.001,
    );
    this.canvas.dataset.potentialMorph = this.landscape
      .morphProgress()
      .toFixed(4);
    this.canvas.dataset.potentialMorphComplete = String(
      this.landscape.morphComplete(),
    );
    this.canvas.dataset.trajectoryReveal = this.landscape
      .trajectoryRevealProgress()
      .toFixed(3);
    this.canvas.dataset.trajectoryRevealComplete = String(
      this.landscape.trajectoryRevealComplete(),
    );
    this.canvas.dataset.animationFrame = String(
      Number(this.canvas.dataset.animationFrame ?? 0) + 1,
    );
    this.needsRender = false;
  };

  private applyGroupOpacity(group: THREE.Group, weight: number): void {
    group.traverse((object) => {
      if (!(
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line
      )) {
        return;
      }
      const renderable = object as THREE.Object3D & {
        material: THREE.Material | THREE.Material[];
      };
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];
      for (const material of materials) {
        if (
          material instanceof THREE.ShaderMaterial &&
          material.uniforms.uSceneOpacity
        ) {
          material.uniforms.uSceneOpacity.value = weight;
          continue;
        }
        if (material.userData.baseOpacity === undefined) {
          material.userData.baseOpacity = material.opacity;
        }
        material.transparent = true;
        material.opacity = Number(material.userData.baseOpacity) * weight;
        material.depthWrite = weight > 0.5;
      }
    });
  }

  private updateLandscapeLabels(): void {
    this.labels.setPosition(
      this.upperCornerLabel,
      this.landscape.cornerPosition("U").add(new THREE.Vector3(0.18, 0.08, 0)),
    );
    this.labels.setPosition(
      this.lowerCornerLabel,
      this.landscape.cornerPosition("L").add(new THREE.Vector3(-0.28, 0.08, 0)),
    );
    this.labels.setPosition(
      this.shortcutCornerLabel,
      this.landscape.cornerPosition("Z").add(new THREE.Vector3(0.55, -0.1, 0)),
    );
    this.labels.setPosition(
      this.equilibriumLabel,
      this.landscape
        .focusPosition("equilibrium")
        .add(new THREE.Vector3(0.18, 0.25, 0)),
    );
    this.labels.setPosition(
      this.optimumLabel,
      this.landscape
        .focusPosition("optimum")
        .add(new THREE.Vector3(-0.42, -0.25, 0.08)),
    );
  }
}
