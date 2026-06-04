import type { Champion } from "../../entities/Champion.js";
import { buildChampionSituation } from "../ChampionSituation.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { JUNGLE_SCORE, JUNGLE_SKIRMISH_SCORE } from "../AiTuning.js";

/**
 * Jungle route: camps → objectives → invade fight.
 * @see docs/CHAMPION_AI.md — Jungle camp
 */
export class JungleCampAction implements Action {
  readonly name = "JUNGLE_CAMP";

  calculateScore(champion: Champion, context: MatchContext): number {
    if (champion.role !== "jungle") {
      return 0;
    }

    const situation = buildChampionSituation(champion, context);
    let score = JUNGLE_SCORE;

    if (situation.laneOpponent && champion.distanceTo(situation.laneOpponent) <= 220) {
      score = Math.max(score, JUNGLE_SKIRMISH_SCORE);
    }

    const camp = context.findCampForJungler(champion);
    const objective = context.findObjectiveForJungler(champion);
    if (!camp && !objective) {
      score *= 0.6;
    }

    return score;
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    const objective = context.findObjectiveForJungler(champion);
    const camp = context.findCampForJungler(champion);

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
