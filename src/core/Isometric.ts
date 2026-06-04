import type { Point } from "../data/models.js";

/**
 * Pseudo-3D isometric projection helpers.
 *
 * The simulation runs entirely in flat Cartesian logic coordinates (collision,
 * pathing, distance). We only convert to the angled "camera" space when drawing,
 * which keeps the game logic simple while giving the rift a 2:1 isometric look.
 *
 * The 0.5 / 0.25 factors produce a classic 2:1 diamond: moving one logic unit
 * along +x shifts the screen position both right and down, so axis-aligned logic
 * movement reads as diagonal on screen. The renderer layers a camera (scale +
 * origin offset) on top of this base projection to fit and centre the map.
 */
export class Iso {
  /** Converts flat logic coordinates to base isometric screen coordinates. */
  static toScreen(x: number, y: number): Point {
    return {
      x: (x - y) * 0.5,
      y: (x + y) * 0.25
    };
  }

  /** Convenience overload that projects a {@link Point}. */
  static project(point: Point): Point {
    return Iso.toScreen(point.x, point.y);
  }

  /**
   * Lifts a projected screen position upward by a Z-axis height (towers, jumps,
   * elevation). Screen-space "up" is negative y.
   */
  static withHeight(screenPos: Point, height: number): Point {
    return {
      x: screenPos.x,
      y: screenPos.y - height
    };
  }

  /**
   * Depth key for back-to-front painting. Entities with a larger (x + y) sit
   * lower on the isometric screen and must be drawn last so they overlap the
   * entities behind them.
   */
  static depth(point: Point): number {
    return point.x + point.y;
  }
}
