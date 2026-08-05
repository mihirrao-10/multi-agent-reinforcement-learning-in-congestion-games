import * as THREE from "three";

import type { StoryData, StorySnapshot } from "../data/story-schema";
import type { FocusTarget, StoryState } from "../story/state-machine";
import { cameraPoseForChapter } from "./camera-poses";
import { CongestionScene, NODE_POSITIONS } from "./congestion-scene";
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
  private readonly story: StoryData;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.02, 80);
  private readonly network = new CongestionScene();
  private readonly landscape: PotentialLandscape;
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

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLElement,
    story: StoryData,
    reducedMotion: boolean,
    callbacks: SceneCallbacks,
  ) {
    this.canvas = canvas;
    this.story = story;
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
    this.landscape = new PotentialLandscape(story);
    this.scene.add(this.network.group, this.landscape.group);
    this.labels = new ProjectedLabels(labelContainer);
    for (const [label, position] of Object.entries(NODE_POSITIONS)) {
      this.labels.add(
        label,
        position.clone().add(new THREE.Vector3(0, 0.17, 0)),
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
    this.animate();
  }

  setState(
    state: StoryState,
    snapshot: StorySnapshot,
    totalSnapshots: number,
  ): void {
    this.reducedMotion = state.reducedMotion;
    this.controls.setReducedMotion(state.reducedMotion);
    this.targetNetworkOpacity = state.sceneMode === "network" ? 1 : 0;
    this.network.setScenario(state.shortcutOpen, state.tollsActive);
    this.network.setSnapshot(snapshot);
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
    this.labels.setMode(state.sceneMode);
    this.equilibriumLabel.textContent = "Nash equilibrium";
    this.optimumLabel.textContent = state.tollsActive
      ? "social optimum = tolled equilibrium"
      : "social optimum";
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
    this.canvas.dataset.episode = String(snapshot.episode);
    this.canvas.dataset.routeCounts = snapshot.routeCounts.join(",");
    this.canvas.dataset.focusTarget = state.focusTarget;
    this.canvas.dataset.userExploring = String(state.userExploring);
    this.canvas.dataset.reducedMotion = String(state.reducedMotion);
    this.canvas.dataset.trajectory = state.trajectory;
    this.canvas.dataset.surface = state.tollsActive
      ? "physical-social-cost"
      : "rosenthal-potential";
  }

  toggleExplore(): void {
    this.controls.toggleExplore();
  }

  resetView(): void {
    this.controls.reset();
  }

  focus(target: FocusTarget): void {
    this.applyFocus(target);
  }

  highlightRoute(route: "U" | "L" | "Z"): void {
    this.network.focus(route);
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
    this.labels.dispose();
    this.renderer.dispose();
  }

  private landscapeTrajectoryLength(name: string): number {
    return (
      this.story.potentialLandscape.trajectoryVertexIndices[name]?.length ?? 0
    );
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
    if (this.visible) this.clock.getDelta();
  };

  private resize(): void {
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
    const elapsed = this.clock.getElapsedTime();
    this.networkOpacity = this.reducedMotion
      ? this.targetNetworkOpacity
      : THREE.MathUtils.lerp(
          this.networkOpacity,
          this.targetNetworkOpacity,
          0.07,
        );
    this.applyGroupOpacity(this.network.group, this.networkOpacity);
    this.applyGroupOpacity(this.landscape.group, 1 - this.networkOpacity);
    this.network.group.visible = this.networkOpacity > 0.005;
    this.landscape.group.visible = this.networkOpacity < 0.995;
    this.network.update(elapsed, this.reducedMotion);
    this.landscape.update(this.reducedMotion);
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
    this.canvas.dataset.animationFrame = String(
      Number(this.canvas.dataset.animationFrame ?? 0) + 1,
    );
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
        .add(new THREE.Vector3(0, 0.18, 0)),
    );
  }
}
