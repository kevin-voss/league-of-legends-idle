import type { Role } from "../../data/models.js";

/**
 * Per-role behaviour curves. Documented in docs/CHAMPION_AI.md — keep in sync.
 */
export interface RoleProfile {
  /** Multiplier on farm / CS scores (ADC highest). */
  csPriority: number;
  /** Multiplier on attack-champion scores (ADC/mid higher, support lower). */
  duelAggression: number;
  /** Multiplier on retreat threat (support more cautious). */
  retreatSensitivity: number;
  /** Extra shop-recall weight when gold threshold hit. */
  shopUrgency: number;
}

export const ROLE_PROFILES: Record<Role, RoleProfile> = {
  top: {
    csPriority: 1,
    duelAggression: 1,
    retreatSensitivity: 1,
    shopUrgency: 1
  },
  mid: {
    csPriority: 1.05,
    duelAggression: 1.1,
    retreatSensitivity: 0.95,
    shopUrgency: 1
  },
  adc: {
    csPriority: 1.2,
    duelAggression: 1.05,
    retreatSensitivity: 0.9,
    shopUrgency: 1.15
  },
  support: {
    csPriority: 0.85,
    duelAggression: 0.55,
    retreatSensitivity: 1.15,
    shopUrgency: 0.9
  },
  jungle: {
    csPriority: 0,
    duelAggression: 0.5,
    retreatSensitivity: 1,
    shopUrgency: 1
  }
};

export function getRoleProfile(role: Role): RoleProfile {
  return ROLE_PROFILES[role];
}
