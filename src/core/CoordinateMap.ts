import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../data/Constants.js";
import type { Point } from "../data/models.js";

/** Logic plane (1920²) → Three.js world units (~20 across the rift). */
export const LOGIC_TO_WORLD = 1 / 96;

export const WORLD_MAP_WIDTH = CANVAS_WIDTH * LOGIC_TO_WORLD;
export const WORLD_MAP_HEIGHT = CANVAS_HEIGHT * LOGIC_TO_WORLD;
export const WORLD_MAP_CENTER_X = (CANVAS_WIDTH / 2) * LOGIC_TO_WORLD;
export const WORLD_MAP_CENTER_Z = (CANVAS_HEIGHT / 2) * LOGIC_TO_WORLD;

/** Logic (x, y) → Three.js (x, height, z). */
export function logicToWorld(point: Point, height = 0): { x: number; y: number; z: number } {
  return {
    x: point.x * LOGIC_TO_WORLD,
    y: height,
    z: point.y * LOGIC_TO_WORLD
  };
}

export function logicFacingY(dx: number, dy: number): number {
  if (dx * dx + dy * dy < 0.0001) {
    return 0;
  }
  return Math.atan2(dx, dy);
}
