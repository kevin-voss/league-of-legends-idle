import type { Champion } from "../entities/Champion.js";
import type { Entity } from "../entities/Entity.js";
import type { Minion } from "../entities/Minion.js";
import type { Structure } from "../entities/Structure.js";
import { championHomeLane } from "../combat/LaneCombatRules.js";
import type { MatchContext } from "./MatchContext.js";
import {
  COMBAT_LOCK_RADIUS,
  ENGAGE_RADIUS,
  FARM_APPROACH_RADIUS,
  HOME_RADIUS
} from "./AiTuning.js";

/**
 * Read-only snapshot of what the brain knows this tick. Shared across actions
 * so scoring stays consistent (docs/CHAMPION_AI.md).
 */
export interface ChampionSituation {
  hpPercent: number;
  gold: number;
  wantsToShop: boolean;
  isAtBase: boolean;
  isCombatLocked: boolean;
  homeLane: ReturnType<typeof championHomeLane>;
  enemiesInEngageRange: ReturnType<MatchContext["getEnemyChampionsInRange"]>;
  alliesInEngageRange: ReturnType<MatchContext["getAllyChampionsInRange"]>;
  outnumbered: number;
  laneOpponent: ReturnType<MatchContext["getNearestEnemyChampion"]>;
  farmTarget: Entity | null;
  lastHitMinion: Minion | null;
  approachingMinion: Minion | null;
  isTowerDiving: boolean;
  canTankTower: boolean;
  hasRotation: boolean;
  rotationPush: boolean;
}

export function buildChampionSituation(champion: Champion, context: MatchContext): ChampionSituation {
  const base = context.getBasePosition(champion.side as "blue" | "red");
  const homeLane = championHomeLane(champion);
  const farmTarget = context.findTargetForChampion(champion);
  const lastHitMinion =
    farmTarget?.kind === "minion" ? (farmTarget as Minion) : context.findNearestEnemyMinionInLane(champion, champion.stats.range + 24);
  const approachingMinion = context.findNearestEnemyMinionInLane(champion, FARM_APPROACH_RADIUS);
  const divingTower = context.getUnsafeEnemyTowerForChampion(champion);
  const enemiesInEngageRange = context.getEnemyChampionsInRange(champion, ENGAGE_RADIUS);
  const alliesInEngageRange = context.getAllyChampionsInRange(champion, ENGAGE_RADIUS);
  const outnumbered = Math.max(0, enemiesInEngageRange.length - (alliesInEngageRange.length + 1));

  return {
    hpPercent: champion.hpPercent,
    gold: champion.statsLine.gold,
    wantsToShop: champion.statsLine.gold >= champion.nextBackGold,
    isAtBase: champion.distanceTo(base) <= HOME_RADIUS,
    isCombatLocked: context.hasEnemyChampionNear(champion, COMBAT_LOCK_RADIUS),
    homeLane,
    enemiesInEngageRange,
    alliesInEngageRange,
    outnumbered,
    laneOpponent: context.getNearestEnemyChampion(champion),
    farmTarget,
    lastHitMinion,
    approachingMinion,
    isTowerDiving: Boolean(divingTower),
    canTankTower: divingTower
      ? context.hasAlliedMinionInStructureRange(champion.side as "blue" | "red", divingTower as Structure)
      : false,
    hasRotation: champion.rotationLane !== null,
    rotationPush: champion.rotationIntent === "push"
  };
}

/** CS is more valuable than a casual trade (real laner behaviour). */
export function shouldPrioritizeLastHit(situation: ChampionSituation): boolean {
  return situation.lastHitMinion !== null && situation.outnumbered === 0;
}
