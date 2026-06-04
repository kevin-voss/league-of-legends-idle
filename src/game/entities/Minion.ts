import type { Match } from "../simulation/Match.js";
import { Entity } from "./Entity.js";
import { calculateAttackPeriod, calculateTypedDamage } from "../combat/DamageCalculator.js";
import type { Point, TeamSide } from "../../data/models.js";

export type MinionType = "melee" | "caster";

export class Minion extends Entity {
  lane: "top" | "mid" | "bot";
  type: MinionType;
  path: Point[];
  pathIndex = 0;
  attackTimer = 0;
  target: Entity | null = null;
  ad: number;
  armor: number;
  mr: number;
  attackSpeed: number;
  attackRange: number;

  constructor(side: TeamSide, lane: "top" | "mid" | "bot", type: MinionType, path: Point[], waveNumber: number, offset: Point) {
    const hp = type === "melee" ? 270 + waveNumber * 8 : 190 + waveNumber * 6;
    const speed = type === "melee" ? 72 : 68;
    super("minion", side, offset, hp, speed, type === "melee" ? 11 : 9);
    this.lane = lane;
    this.type = type;
    this.path = path;
    this.ad = type === "melee" ? 26 + waveNumber * 1.1 : 34 + waveNumber * 1.25;
    this.armor = type === "melee" ? 12 : 5;
    this.mr = type === "melee" ? 8 : 5;
    this.attackSpeed = type === "melee" ? 0.65 : 0.52;
    this.attackRange = type === "melee" ? 34 : 150;
  }

  update(match: Match, dt: number): void {
    if (!this.alive) {
      this.target = null;
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.remove = true;
      }
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const target = match.findTargetForMinion(this);
    this.target = target;

    if (target) {
      this.attack(target, match, dt);
      return;
    }

    this.pathIndex = this.moveAlongPath(this.path, this.pathIndex, dt);
  }

  private attack(target: Entity, match: Match, dt: number): void {
    if (this.distanceTo(target) > this.attackRange) {
      this.moveTowards(target.pos, dt, 0.85);
      return;
    }

    if (this.attackTimer <= 0) {
      const defenderStats = match.getDefensiveStats(target);
      const damage = calculateTypedDamage(this.ad, "physical", defenderStats);
      this.attackTimer = calculateAttackPeriod(this.attackSpeed);
      match.applyDamage(this, target, damage, "physical", "Minion");
    }
  }
}
