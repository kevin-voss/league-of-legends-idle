import type { ChampionStats, DamageType } from "../../data/models.js";

export function calculateDamage(rawDamage: number, resistance: number): number {
  if (rawDamage <= 0) {
    return 0;
  }
  const multiplier = 100 / (100 + Math.max(resistance, 0));
  return rawDamage * multiplier;
}

export function calculateTypedDamage(rawDamage: number, damageType: DamageType, defenderStats: Pick<ChampionStats, "armor" | "mr">): number {
  if (damageType === "true") {
    return Math.max(0, rawDamage);
  }
  const resistance = damageType === "physical" ? defenderStats.armor : defenderStats.mr;
  return calculateDamage(rawDamage, resistance);
}

export function calculateAttackPeriod(attackSpeed: number): number {
  return 1 / Math.max(0.2, attackSpeed);
}
