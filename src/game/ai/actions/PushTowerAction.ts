import type { Champion } from "../../entities/Champion.js";
import { buildChampionSituation } from "../ChampionSituation.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { PUSH_LANE_SCORE, PUSH_TOWER_SCORE } from "../AiTuning.js";

/**
 * Siege with minion aggro or execute assigned push rotation.
 * @see docs/CHAMPION_AI.md — Push tower
 */
export class PushTowerAction implements Action {
  readonly name = "PUSH_TOWER";

  calculateScore(champion: Champion, context: MatchContext): number {
    if (champion.role === "jungle") {
      return 0;
    }

    const situation = buildChampionSituation(champion, context);
    if (situation.farmTarget?.kind === "structure") {
      return PUSH_TOWER_SCORE;
    }

    if (situation.hasRotation && situation.rotationPush) {
      return PUSH_LANE_SCORE;
    }

    return 0;
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    const target = context.findTargetForChampion(champion);
    if (target) {
      champion.state = target.kind === "structure" ? "sieging" : "fighting";
      champion.engage(target, context, dt);
      return;
    }

    if (champion.rotationLane && champion.rotationIntent === "push") {
      champion.state = "rotating";
      champion.followPath(context.getPathForLane(champion.rotationLane, champion.side as "blue" | "red"), dt);
      return;
    }

    champion.state = "sieging";
    champion.followPath(context.getPathForChampion(champion), dt);
  }
}
