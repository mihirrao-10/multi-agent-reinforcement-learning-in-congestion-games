import { describe, expect, it } from "vitest";

import {
  keyboardOrbitDelta,
  pinchDistanceScale,
  pointerOrbitDelta,
  trackpadOrbitDelta,
} from "../src/scene/orbit-controller";

describe("direct-manipulation camera directions", () => {
  it("makes pointer and trackpad movement follow horizontal and vertical motion", () => {
    expect(pointerOrbitDelta(20, 0).azimuth).toBeGreaterThan(0);
    expect(pointerOrbitDelta(-20, 0).azimuth).toBeLessThan(0);
    expect(pointerOrbitDelta(0, 20).elevation).toBeGreaterThan(0);
    expect(pointerOrbitDelta(0, -20).elevation).toBeLessThan(0);
    expect(trackpadOrbitDelta(20, 15)).toEqual({
      azimuth: 0.08,
      elevation: 0.045,
    });
  });

  it("makes pinch-apart zoom in and pinch-together zoom out", () => {
    expect(pinchDistanceScale(100, 140)).toBeLessThan(1);
    expect(pinchDistanceScale(140, 100)).toBeGreaterThan(1);
  });

  it("keeps keyboard arrows consistent with pointer directions", () => {
    expect(keyboardOrbitDelta("ArrowRight").azimuth).toBeGreaterThan(0);
    expect(keyboardOrbitDelta("ArrowLeft").azimuth).toBeLessThan(0);
    expect(keyboardOrbitDelta("ArrowDown").elevation).toBeGreaterThan(0);
    expect(keyboardOrbitDelta("ArrowUp").elevation).toBeLessThan(0);
  });
});
