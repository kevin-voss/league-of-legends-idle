                                                           
import { buildChampionSituation } from "../ChampionSituation.js";
                                           
                                                       
import { PUSH_LANE_SCORE, PUSH_TOWER_SCORE } from "../AiTuning.js";

/**
 * Siege with minion aggro or execute assigned push rotation.
 * @see docs/CHAMPION_AI.md — Push tower
 */
export class PushTowerAction                   {
           name = "PUSH_TOWER";

  calculateScore(champion          , context              )         {
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

  execute(champion          , context              , dt        )       {
    const target = context.findTargetForChampion(champion);
    if (target) {
      champion.state = target.kind === "structure" ? "sieging" : "fighting";
      champion.engage(target, context, dt);
      return;
    }

    if (champion.rotationLane && champion.rotationIntent === "push") {
      champion.state = "rotating";
      champion.followPath(context.getPathForLane(champion.rotationLane, champion.side                  ), dt);
      return;
    }

    champion.state = "sieging";
    champion.followPath(context.getPathForChampion(champion), dt);
  }
}
