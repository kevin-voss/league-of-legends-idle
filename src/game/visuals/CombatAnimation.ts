import { calculateAttackPeriod } from "../combat/DamageCalculator.js";

/** Portion of the attack clip to play before blending back to idle/walk. */
export const ATTACK_CLIP_PORTION = 0.52;

/** Real-time windup as a fraction of the champion's attack period. */
const WINDUP_PERIOD_RATIO = 0.36;
const WINDUP_MAX_SECONDS = 0.38;
const WINDUP_MIN_SECONDS = 0.18;

export function attackWindupSeconds(attackSpeed: number): number {
  const period = calculateAttackPeriod(attackSpeed);
  return Math.min(WINDUP_MAX_SECONDS, Math.max(WINDUP_MIN_SECONDS, period * WINDUP_PERIOD_RATIO));
}

export function attackClipTimeScale(clipDuration: number, windupSeconds: number, portion = ATTACK_CLIP_PORTION): number {
  return (clipDuration * portion) / windupSeconds;
}
