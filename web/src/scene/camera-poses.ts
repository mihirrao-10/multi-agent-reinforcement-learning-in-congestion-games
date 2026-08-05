import * as THREE from "three";

import type { CameraPose } from "./orbit-controller";

const NETWORK_TARGET = new THREE.Vector3(0, 0, 0);
const LANDSCAPE_TARGET = new THREE.Vector3(0, 0.1, 0.05);

export function cameraPoseForChapter(chapter: number): CameraPose {
  if (chapter === 4) {
    return {
      azimuth: 0.88,
      elevation: 0.58,
      distance: 7.5,
      target: LANDSCAPE_TARGET,
    };
  }
  if (chapter === 5) {
    return {
      azimuth: 0.44,
      elevation: 0.66,
      distance: 7.25,
      target: LANDSCAPE_TARGET,
    };
  }
  if (chapter === 7) {
    return {
      azimuth: -0.28,
      elevation: 0.62,
      distance: 7.35,
      target: LANDSCAPE_TARGET,
    };
  }
  if (chapter === 2) {
    return {
      azimuth: 0.42,
      elevation: 0.16,
      distance: 5.0,
      target: NETWORK_TARGET,
    };
  }
  if (chapter === 6) {
    return {
      azimuth: -0.24,
      elevation: 0.22,
      distance: 5.2,
      target: NETWORK_TARGET,
    };
  }
  if (chapter >= 8) {
    return {
      azimuth: 0.18,
      elevation: 0.18,
      distance: 5.2,
      target: NETWORK_TARGET,
    };
  }
  return {
    azimuth: 0.32,
    elevation: 0.2,
    distance: 5.25,
    target: NETWORK_TARGET,
  };
}
