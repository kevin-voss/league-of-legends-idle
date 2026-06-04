                                                                      

export function calculateDamage(rawDamage        , resistance        )         {
  if (rawDamage <= 0) {
    return 0;
  }
  const multiplier = 100 / (100 + Math.max(resistance, 0));
  return rawDamage * multiplier;
}

export function calculateTypedDamage(rawDamage        , damageType            , defenderStats                                     )         {
  if (damageType === "true") {
    return Math.max(0, rawDamage);
  }
  const resistance = damageType === "physical" ? defenderStats.armor : defenderStats.mr;
  return calculateDamage(rawDamage, resistance);
}

export function calculateAttackPeriod(attackSpeed        )         {
  return 1 / Math.max(0.2, attackSpeed);
}
