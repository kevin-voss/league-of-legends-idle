import type { LaneId, Point, StructureDefinition, StructureTier, StructureType, TeamSide } from "../../data/models.js";
import { calculateAttackPeriod, calculateTypedDamage } from "../combat/DamageCalculator.js";
import type { Match } from "../simulation/Match.js";
import { Entity } from "./Entity.js";

export class Structure extends Entity {
  structureType: StructureType;
  lane: LaneId | null;
  tier: StructureTier | null;
  ad: number;
  armor: number;
  mr: number;
  attackSpeed: number;
  attackRange: number;
  attackTimer = 0;
  isInvulnerable = false;

  constructor(definition: StructureDefinition) {
    super("structure", definition.side, definition.pos, definition.hp, 0, definition.type === "nexus" ? 34 : 24);
    this.id = definition.id;
    this.structureType = definition.type;
    this.lane = definition.lane;
    this.tier = definition.tier;
    this.ad = definition.ad;
    this.armor = definition.armor;
    this.mr = definition.mr;
    this.attackSpeed = definition.attackSpeed;
    this.attackRange = definition.attackRange;
    this.isInvulnerable = definition.type === "tower" && (definition.tier ?? 1) > 1;
  }

  get team(): TeamSide {
    return this.side as TeamSide;
  }

  update(match: Match, dt: number): void {
    if (!this.alive || this.isInvulnerable) {
      return;
    }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const target = match.findTargetForStructure(this);
    if (!target || this.attackTimer > 0) {
      return;
    }

    const defenderStats = match.getDefensiveStats(target);
    const damage = calculateTypedDamage(this.ad, "physical", defenderStats);
    this.attackTimer = calculateAttackPeriod(this.attackSpeed);
    match.applyDamage(this, target, damage, "physical", this.structureType === "tower" ? "Tower" : "Nexus");
  }

  takeDamage(amount: number): number {
    if (this.isInvulnerable) {
      return 0;
    }
    return super.takeDamage(amount);
  }

  moveTowards(_point: Point, _dt: number, _speedMultiplier = 1): boolean {
    return true;
  }
}
