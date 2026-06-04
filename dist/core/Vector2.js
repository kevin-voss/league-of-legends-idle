                                               

export class Vector2 {
  x        ;
  y        ;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static from(point       )          {
    return new Vector2(point.x, point.y);
  }

  static distance(a       , b       )         {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  clone()          {
    return new Vector2(this.x, this.y);
  }

  add(other       )          {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other       )          {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scale(value        )          {
    this.x *= value;
    this.y *= value;
    return this;
  }

  length()         {
    return Math.hypot(this.x, this.y);
  }

  normalized()          {
    const length = this.length();
    if (length === 0) {
      return new Vector2();
    }
    return new Vector2(this.x / length, this.y / length);
  }

  distanceTo(other       )         {
    return Vector2.distance(this, other);
  }

  moveTowards(target       , maxDistance        )          {
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
