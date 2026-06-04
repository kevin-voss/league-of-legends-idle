import { calculateTypedDamage } from "./DamageCalculator.js";
                                                                   

                                                 

export function createCooldowns(abilities           )              {
  const cooldowns              = {};
  for (const ability of abilities) {
    cooldowns[ability.id] = Math.random() * Math.min(1.2, ability.cooldown * 0.25);
  }
  return cooldowns;
}

export function tickCooldowns(cooldowns             , dt        )       {
  for (const key of Object.keys(cooldowns)) {
    cooldowns[key] = Math.max(0, (cooldowns[key] ?? 0) - dt);
  }
}

export function getReadyAbility(abilities           , cooldowns             , distance        , rangeCap = Number.POSITIVE_INFINITY)                 {
  return abilities.find((ability) => (cooldowns[ability.id] ?? 0) <= 0 && distance <= Math.min(ability.range, rangeCap)) ?? null;
}

export function calculateAbilityDamage(ability         , attackerStats               , defenderStats               )         {
  const raw = ability.baseDamage + attackerStats.ad * ability.adRatio + attackerStats.ap * ability.apRatio;
  return calculateTypedDamage(raw, ability.damageType, defenderStats);
}
