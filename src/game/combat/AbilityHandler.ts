import { calculateTypedDamage } from "./DamageCalculator.js";
import type { Ability, ChampionStats } from "../../data/models.js";

export type CooldownMap = Record<string, number>;

export function createCooldowns(abilities: Ability[]): CooldownMap {
  const cooldowns: CooldownMap = {};
  for (const ability of abilities) {
    cooldowns[ability.id] = Math.random() * Math.min(1.2, ability.cooldown * 0.25);
  }
  return cooldowns;
}

export function tickCooldowns(cooldowns: CooldownMap, dt: number): void {
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, (cooldowns[key] ?? 0) - dt);
  }
}

export function getReadyAbility(abilities: Ability[], cooldowns: CooldownMap, distance: number, rangeCap = Number.POSITIVE_INFINITY): Ability | null {
  return abilities.find((ability) => (cooldowns[ability.id] ?? 0) <= 0 && distance <= Math.min(ability.range, rangeCap)) ?? null;
}

export function calculateAbilityDamage(ability: Ability, attackerStats: ChampionStats, defenderStats: ChampionStats): number {
  const raw = ability.baseDamage + attackerStats.ad * ability.adRatio + attackerStats.ap * ability.apRatio;
  return calculateTypedDamage(raw, ability.damageType, defenderStats);
}
