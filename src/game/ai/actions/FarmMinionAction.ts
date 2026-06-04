import type { Champion } from "../../entities/Champion.js";
import { buildChampionSituation } from "../ChampionSituation.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import {
  FARM_APPROACH_RADIUS,
  FARM_BASE_SCORE,
  FARM_MINION_APPROACH_SCORE,
  FARM_MINION_IN_RANGE_SCORE
} from "../AiTuning.js";
import { getRoleProfile } from "../RoleProfiles.js";

/**
 * Default laning: last-hit, walk to wave, path when idle.
 * @see docs/CHAMPION_AI.md — Farm minions
 */
export class FarmMinionAction implements Action {
  readonly name = "FARM_MINION";

  calculateScore(champion: Champion, context: MatchContext): number {
    if (champion.role === "jungle") {
      return 0;
    }

    const situation = buildChampionSituation(champion, context);
    const profile = getRoleProfile(champion.role);
    const cs = profile.csPriority;

    if (situation.farmTarget?.kind === "minion") {
      return FARM_MINION_IN_RANGE_SCORE * cs;
    }
    if (situation.farmTarget) {
      return (FARM_BASE_SCORE + 24) * cs;
    }
    if (situation.approachingMinion) {
      return FARM_MINION_APPROACH_SCORE * cs;
    }
    return FARM_BASE_SCORE * cs;
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    const target = context.findTargetForChampion(champion);
    if (target) {
      champion.state = target.kind === "structure" ? "sieging" : target.kind === "champion" ? "fighting" : "farming";
      champion.engage(target, context, dt);
      return;
    }

    const waveMinion = context.findNearestEnemyMinionInLane(champion, FARM_APPROACH_RADIUS);
    if (waveMinion) {
      champion.state = "farming";
      champion.moveTowards(waveMinion.pos, dt, 1.06);
      return;
    }

    if (champion.rotationLane) {
      champion.state = "rotating";
      if (champion.rotationIntent === "push") {
        champion.followPath(context.getPathForLane(champion.rotationLane, champion.side as "blue" | "red"), dt);
      } else {
        champion.moveTowards(context.getDefensePoint(champion.side as "blue" | "red", champion.rotationLane), dt, 1.08);
      }
      return;
    }

    champion.state = "farming";
    champion.followPath(context.getPathForChampion(champion), dt);
  }
}
