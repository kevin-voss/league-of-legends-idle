import type { Champion } from "../../entities/Champion.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { PUSH_LANE_SCORE, PUSH_TOWER_SCORE } from "../AiTuning.js";

/**
 * Siege an enemy structure once minions are tanking it, or keep marching an
 * assigned push lane. Junglers leave structures to the laners.
 */
export class PushTowerAction implements Action {
  readonly name = "PUSH_TOWER";

  calculateScore(champion: Champion, context: MatchContext): number {
    if (champion.role === "jungle") {
      return 0;
    }

    const target = context.findTargetForChampion(champion);
    if (target && target.kind === "structure") {
      return PUSH_TOWER_SCORE;
    }

    if (champion.rotationLane && champion.rotationIntent === "push") {
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
