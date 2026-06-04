import type { LaneId, Role } from "../../data/models.js";
import type { Champion } from "../entities/Champion.js";

/** Lane each role farms in; junglers are not assigned to a lane. */
export function getHomeLane(role: Role): LaneId | null {
  if (role === "top") {
    return "top";
  }
  if (role === "mid") {
    return "mid";
  }
  if (role === "adc" || role === "support") {
    return "bot";
  }
  return null;
}

export function championHomeLane(champion: Champion): LaneId | null {
  return champion.rotationLane ?? getHomeLane(champion.role);
}

/** Whether two champions may trade in lane (no cross-lane roams). */
export function canChampionsDuel(attacker: Champion, defender: Champion): boolean {
  if (attacker.role === "jungle") {
    return defender.role === "jungle";
  }
  if (defender.role === "jungle") {
    return false;
  }
  if (attacker.role === "top") {
    return defender.role === "top";
  }
  if (attacker.role === "mid") {
    return defender.role === "mid";
  }
  if (attacker.role === "adc" || attacker.role === "support") {
    return defender.role === "adc" || defender.role === "support";
  }
  return false;
}

export function championBelongsToLane(champion: Champion, lane: LaneId): boolean {
  if (champion.role === "jungle") {
    return false;
  }
  return getHomeLane(champion.role) === lane;
}
