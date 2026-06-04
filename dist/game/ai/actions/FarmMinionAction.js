                                                           
                                           
                                                       
import { FARM_BASE_SCORE } from "../AiTuning.js";

/**
 * The default laning behaviour and brain floor: engage whatever lane target is
 * in reach (minion, structure, or a champion nobody else committed to), honour
 * an assigned rotation, otherwise walk the lane and soak waves.
 */
export class FarmMinionAction                   {
           name = "FARM_MINION";

  calculateScore(_champion          , _context              )         {
    return FARM_BASE_SCORE;
  }

  execute(champion          , context              , dt        )       {
    const target = context.findTargetForChampion(champion);
    if (target) {
      champion.state = target.kind === "structure" ? "sieging" : "fighting";
      champion.engage(target, context, dt);
      return;
    }

    if (champion.rotationLane) {
      champion.state = "rotating";
      if (champion.rotationIntent === "push") {
        champion.followPath(context.getPathForLane(champion.rotationLane, champion.side                  ), dt);
      } else {
        champion.moveTowards(context.getDefensePoint(champion.side                  , champion.rotationLane), dt, 1.08);
      }
      return;
    }

    champion.state = "farming";
    champion.followPath(context.getPathForChampion(champion), dt);
  }
}
