import type { Champion } from "../../entities/Champion.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { JUNGLE_SCORE } from "../AiTuning.js";

/**
 * Jungle routing: clear the nearest camp, contest a major objective once one is
 * up and reachable, otherwise patrol the route while camps respawn. Only the
 * jungler considers this action at all.
 */
export class JungleCampAction implements Action {
  readonly name = "JUNGLE_CAMP";

  calculateScore(champion: Champion, _context: MatchContext): number {
    return champion.role === "jungle" ? JUNGLE_SCORE : 0;
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    const objective = context.findObjectiveForJungler(champion);
    const camp = context.findCampForJungler(champion);

    // Clear camps first; only break off for an objective once the camps are down
    // or the jungler has already walked up to it.
    if (camp && !(objective && champion.distanceTo(objective) < 360)) {
      champion.state = "farming";
      champion.engage(camp, context, dt);
      return;
    }

    if (objective) {
      champion.state = "movingToObjective";
      champion.engage(objective, context, dt);
      return;
    }

    champion.state = "farming";
    champion.followPath(context.getPathForChampion(champion), dt);
  }
}
