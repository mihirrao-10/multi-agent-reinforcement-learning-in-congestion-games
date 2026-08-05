import * as THREE from "three";

export interface CameraPose {
  readonly azimuth: number;
  readonly elevation: number;
  readonly distance: number;
  readonly target: THREE.Vector3;
}

interface OrbitCallbacks {
  readonly onExploreChange: (exploring: boolean) => void;
  readonly onManualInteraction: () => void;
  readonly onEscape: () => void;
}

export class OrbitController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: OrbitCallbacks;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private currentAzimuth = 0.28;
  private currentElevation = 0.18;
  private currentDistance = 5.3;
  private desiredAzimuth = 0.28;
  private desiredElevation = 0.18;
  private desiredDistance = 5.3;
  private currentTarget = new THREE.Vector3();
  private desiredTarget = new THREE.Vector3();
  private authoredPose: CameraPose;
  private exploring = false;
  private reducedMotion: boolean;
  private previousPinchDistance = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    pose: CameraPose,
    reducedMotion: boolean,
    callbacks: OrbitCallbacks,
  ) {
    this.camera = camera;
    this.canvas = canvas;
    this.authoredPose = pose;
    this.reducedMotion = reducedMotion;
    this.callbacks = callbacks;
    this.applyPose(pose, true);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("keydown", this.onKeyDown);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setExplore(exploring: boolean): void {
    this.exploring = exploring;
    this.canvas.classList.toggle("is-exploring", exploring);
    this.canvas.dataset.userExploring = String(exploring);
    if (exploring) this.canvas.focus({ preventScroll: true });
    this.callbacks.onExploreChange(exploring);
  }

  toggleExplore(): void {
    this.setExplore(!this.exploring);
  }

  setAuthoredPose(pose: CameraPose, immediate = false): void {
    this.authoredPose = pose;
    if (!this.exploring) this.applyPose(pose, immediate || this.reducedMotion);
  }

  reset(): void {
    this.setExplore(false);
    this.applyPose(this.authoredPose, this.reducedMotion);
  }

  focus(target: THREE.Vector3, distance = this.desiredDistance): void {
    this.desiredTarget.copy(target);
    this.desiredDistance = THREE.MathUtils.clamp(distance, 2.5, 9);
    if (this.reducedMotion) this.snap();
  }

  update(): void {
    const smoothing = this.reducedMotion ? 1 : 0.085;
    this.currentAzimuth = THREE.MathUtils.lerp(
      this.currentAzimuth,
      this.desiredAzimuth,
      smoothing,
    );
    this.currentElevation = THREE.MathUtils.lerp(
      this.currentElevation,
      this.desiredElevation,
      smoothing,
    );
    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      this.desiredDistance,
      smoothing,
    );
    this.currentTarget.lerp(this.desiredTarget, smoothing);
    const cosElevation = Math.cos(this.currentElevation);
    this.camera.position.set(
      this.currentTarget.x +
        this.currentDistance * cosElevation * Math.cos(this.currentAzimuth),
      this.currentTarget.y +
        this.currentDistance * Math.sin(this.currentElevation),
      this.currentTarget.z +
        this.currentDistance * cosElevation * Math.sin(this.currentAzimuth),
    );
    this.camera.lookAt(this.currentTarget);
    this.canvas.dataset.cameraAzimuth = this.currentAzimuth.toFixed(4);
    this.canvas.dataset.cameraElevation = this.currentElevation.toFixed(4);
    this.canvas.dataset.cameraDistance = this.currentDistance.toFixed(4);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("keydown", this.onKeyDown);
  }

  private applyPose(pose: CameraPose, immediate: boolean): void {
    this.desiredAzimuth = pose.azimuth;
    this.desiredElevation = pose.elevation;
    this.desiredDistance = pose.distance;
    this.desiredTarget.copy(pose.target);
    if (immediate) this.snap();
  }

  private snap(): void {
    this.currentAzimuth = this.desiredAzimuth;
    this.currentElevation = this.desiredElevation;
    this.currentDistance = this.desiredDistance;
    this.currentTarget.copy(this.desiredTarget);
    this.update();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.classList.add("is-dragging");
    if (this.pointers.size === 2) {
      const points = [...this.pointers.values()];
      this.previousPinchDistance = Math.hypot(
        points[0]!.x - points[1]!.x,
        points[0]!.y - points[1]!.y,
      );
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const points = [...this.pointers.values()];
      const distance = Math.hypot(
        points[0]!.x - points[1]!.x,
        points[0]!.y - points[1]!.y,
      );
      if (this.previousPinchDistance > 0) {
        this.desiredDistance *=
          this.previousPinchDistance / Math.max(distance, 1);
        this.desiredDistance = THREE.MathUtils.clamp(
          this.desiredDistance,
          2.5,
          9,
        );
      }
      this.previousPinchDistance = distance;
      event.preventDefault();
    } else if (
      event.pointerType !== "touch" ||
      this.exploring ||
      Math.abs(dx) > Math.abs(dy)
    ) {
      this.desiredAzimuth -= dx * 0.007;
      this.desiredElevation = THREE.MathUtils.clamp(
        this.desiredElevation + dy * 0.006,
        -1.12,
        1.12,
      );
      this.callbacks.onManualInteraction();
      if (this.exploring || event.pointerType !== "touch")
        event.preventDefault();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.previousPinchDistance = 0;
    this.canvas.classList.toggle("is-dragging", this.pointers.size > 0);
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.exploring && !event.ctrlKey) return;
    event.preventDefault();
    if (this.exploring && Math.abs(event.deltaX) > 0.1 && !event.ctrlKey) {
      this.desiredAzimuth -= event.deltaX * 0.004;
      this.desiredElevation = THREE.MathUtils.clamp(
        this.desiredElevation + event.deltaY * 0.003,
        -1.12,
        1.12,
      );
    } else {
      this.desiredDistance = THREE.MathUtils.clamp(
        this.desiredDistance * Math.exp(event.deltaY * 0.0012),
        2.5,
        9,
      );
    }
    this.callbacks.onManualInteraction();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const rotationStep = 0.09;
    if (event.key === "ArrowLeft") this.desiredAzimuth -= rotationStep;
    else if (event.key === "ArrowRight") this.desiredAzimuth += rotationStep;
    else if (event.key === "ArrowUp") this.desiredElevation += rotationStep;
    else if (event.key === "ArrowDown") this.desiredElevation -= rotationStep;
    else if (event.key === "+" || event.key === "=")
      this.desiredDistance *= 0.9;
    else if (event.key === "-" || event.key === "_")
      this.desiredDistance *= 1.1;
    else if (event.key.toLowerCase() === "r") this.reset();
    else if (event.key === "Escape") {
      this.setExplore(false);
      this.callbacks.onEscape();
    } else return;
    this.desiredElevation = THREE.MathUtils.clamp(
      this.desiredElevation,
      -1.12,
      1.12,
    );
    this.desiredDistance = THREE.MathUtils.clamp(this.desiredDistance, 2.5, 9);
    this.callbacks.onManualInteraction();
    event.preventDefault();
  };
}
