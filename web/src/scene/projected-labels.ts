import type * as THREE from "three";

interface ProjectedLabel {
  readonly element: HTMLSpanElement;
  readonly position: THREE.Vector3;
  readonly mode: "network" | "landscape";
  enabled: boolean;
}

export class ProjectedLabels {
  private readonly container: HTMLElement;
  private readonly labels: ProjectedLabel[] = [];
  private activeMode: "network" | "landscape" = "network";

  constructor(container: HTMLElement) {
    this.container = container;
  }

  add(
    text: string,
    position: THREE.Vector3,
    mode: "network" | "landscape",
    className = mode === "network" ? "node-label" : "landscape-label",
  ): HTMLSpanElement {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    this.container.append(element);
    this.labels.push({
      element,
      position: position.clone(),
      mode,
      enabled: true,
    });
    return element;
  }

  setPosition(element: HTMLElement, position: THREE.Vector3): void {
    this.labels
      .find((label) => label.element === element)
      ?.position.copy(position);
  }

  setEnabled(element: HTMLElement, enabled: boolean): void {
    const label = this.labels.find((entry) => entry.element === element);
    if (label) label.enabled = enabled;
  }

  setMode(mode: "network" | "landscape"): void {
    this.activeMode = mode;
  }

  update(camera: THREE.PerspectiveCamera, width: number, height: number): void {
    for (const label of this.labels) {
      if (label.mode !== this.activeMode || !label.enabled) {
        label.element.style.opacity = "0";
        continue;
      }
      const projected = label.position.clone().project(camera);
      const visible = projected.z > -1 && projected.z < 1;
      label.element.style.opacity = visible ? "1" : "0";
      const screenX = (projected.x * 0.5 + 0.5) * width;
      const screenY = (-projected.y * 0.5 + 0.5) * height;
      const halfWidth = label.element.offsetWidth / 2;
      const halfHeight = label.element.offsetHeight / 2;
      label.element.style.left = `${Math.max(halfWidth + 5, Math.min(width - halfWidth - 5, screenX))}px`;
      label.element.style.top = `${Math.max(halfHeight + 5, Math.min(height - halfHeight - 5, screenY))}px`;
    }
  }

  dispose(): void {
    this.labels.forEach((label) => label.element.remove());
    this.labels.length = 0;
  }
}
