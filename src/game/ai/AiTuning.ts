/**
 * Shared tuning constants for the utility brain. Centralised so the action
 * scores stay internally consistent and are easy to reason about / test.
 *
 * Behavioural spec: docs/CHAMPION_AI.md
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

// How far a laner will walk toward an enemy wave before auto-attacking.
export const FARM_APPROACH_RADIUS = 560;

// Score boost when a last-hittable minion is already in attack range.
export const FARM_MINION_IN_RANGE_SCORE = 88;

// Score boost when minions are visible in-lane but still outside attack range.
export const FARM_MINION_APPROACH_SCORE = 62;

// Committed siege of an attackable enemy structure.
export const PUSH_TOWER_SCORE = 55;

// Following an assigned push lane when no target is in reach yet.
export const PUSH_LANE_SCORE = 35;

// Junglers favour their route over generic farming.
export const JUNGLE_SCORE = 40;

// Enemy jungler nearby — contest invade before idle pathing.
export const JUNGLE_SKIRMISH_SCORE = 72;

// Standing in an enemy tower's range with no minion shield: get out.
export const TOWER_DIVE_RETREAT_SCORE = 90;
