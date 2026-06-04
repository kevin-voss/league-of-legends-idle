import { Vector2 } from "../../core/Vector2.js";
                                                              

let nextEntityId = 1;

                                                                         

export class Entity {
  id        ;
  kind            ;
  side            ;
  pos         ;
  radius        ;
  maxHp        ;
  currentHp        ;
  speed        ;
  alive = true;
  remove = false;
  damageDealt = 0;
  damageTaken = 0;
  deathTimer = 0;
  // Z-axis elevation used purely for isometric rendering (towers, jumps, hops).
  heightOffset = 0;

  constructor(kind            , side            , pos       , maxHp        , speed        , radius = 14) {
    this.id = `${kind}-${nextEntityId++}`;
    this.kind = kind;
    this.side = side;
    this.pos = Vector2.from(pos);
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.speed = speed;
    this.radius = radius;
  }

  get hpPercent()         {
    if (this.maxHp <= 0) {
      return 0;
    }
    return this.currentHp / this.maxHp;
  }

  distanceTo(entity                )         {
    return this.pos.distanceTo(entity instanceof Entity ? entity.pos : entity);
  }

  moveTowards(point       , dt        , speedMultiplier = 1)          {
    return this.pos.moveTowards(point, this.speed * speedMultiplier * dt);
  }

  moveAlongPath(path         , pathIndex        , dt        , speedMultiplier = 1)         {
    if (path.length === 0) {
      return pathIndex;
    }

    let nextIndex = Math.max(0, Math.min(pathIndex, path.length - 1));
    let remainingDistance = this.speed * speedMultiplier * dt;

    while (remainingDistance > 0 && nextIndex < path.length) {
      const target = path[nextIndex]         ;
      const distance = this.pos.distanceTo(target);

      if (distance > remainingDistance) {
        this.pos.moveTowards(target, remainingDistance);
        return nextIndex;
      }

      this.pos.x = target.x;
      this.pos.y = target.y;
      remainingDistance -= distance;

      if (nextIndex >= path.length - 1) {
        return nextIndex;
      }
      nextIndex += 1;
    }

    return nextIndex;
  }

  takeDamage(amount        )         {
    if (!this.alive) {
      return 0;
    }

    const applied = Math.max(0, Math.min(this.currentHp, amount));
    this.currentHp -= applied;
    this.damageTaken += applied;

    if (this.currentHp <= 0) {
      this.alive = false;
      this.deathTimer = 0.75;
    }

    return applied;
  }

  healFull()       {
    this.currentHp = this.maxHp;
    this.alive = true;
    this.remove = false;
    this.deathTimer = 0;
  }
}
