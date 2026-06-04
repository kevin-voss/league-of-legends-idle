/**
 * Shared tuning constants for the utility brain. Centralised so the action
 * scores stay internally consistent and are easy to reason about / test.
 */

// A champion locked within this radius of an enemy cannot safely channel a recall.
export const COMBAT_LOCK_RADIUS = 220;

// How far a champion "feels" enemy and allied champion presence when judging fights.
export const THREAT_RADIUS = 520;

// How close an enemy champion must be before committing to a duel. Tighter than
// THREAT_RADIUS so champions hold their lane instead of collapsing across the map.
export const ENGAGE_RADIUS = 300;

// A champion this close to its own base has effectively no reason to recall.
export const HOME_RADIUS = 110;

// Baseline pull of the default laning/farming behaviour. Every other action is
// tuned relative to this floor.
export const FARM_BASE_SCORE = 15;

// Committed siege of an attackable enemy structure.
export const PUSH_TOWER_SCORE = 55;

// Following an assigned push lane when no target is in reach yet.
export const PUSH_LANE_SCORE = 35;

// Junglers favour their route over generic farming.
export const JUNGLE_SCORE = 40;

// Standing in an enemy tower's range with no minion shield: get out.
export const TOWER_DIVE_RETREAT_SCORE = 90;
