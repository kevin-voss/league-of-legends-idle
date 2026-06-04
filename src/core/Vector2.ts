import type { Point } from "../data/models.js";

export class Vector2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static from(point: Point): Vector2 {
    return new Vector2(point.x, point.y);
  }

  static distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  add(other: Point): Vector2 {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other: Point): Vector2 {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(value: number): Vector2 {
    this.x *= value;
    this.y *= value;
    return this;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  normalized(): Vector2 {
    const length = this.length();
    if (length === 0) {
      return new Vector2();
    }
    return new Vector2(this.x / length, this.y / length);
  }

  distanceTo(other: Point): number {
    return Vector2.distance(this, other);
  }

  moveTowards(target: Point, maxDistance: number): boolean {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= maxDistance || distance === 0) {
      this.x = target.x;
      this.y = target.y;
      return true;
    }

    this.x += (dx / distance) * maxDistance;
    this.y += (dy / distance) * maxDistance;
    return false;
  }
}
