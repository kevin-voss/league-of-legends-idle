import type { Champion } from "../../entities/Champion.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { THREAT_RADIUS, TOWER_DIVE_RETREAT_SCORE } from "../AiTuning.js";

/**
 * Fall back to safety without a full recall. Two triggers:
 *  1. Tower-dive avoidance — standing in an enemy tower's range with no allied
 *     minions to soak the shots.
 *  2. Being outnumbered or outmatched by nearby enemy champions, scaled by how
 *     hurt the champion is (full-HP champions hold their ground).
 */
export class RetreatAction implements Action {
  readonly name = "RETREAT";

  calculateScore(champion: Champion, context: MatchContext): number {
    let score = 0;

    const divingTower = context.getUnsafeEnemyTowerForChampion(champion);
    if (divingTower && !context.hasAlliedMinionInStructureRange(champion.side as "blue" | "red", divingTower)) {
      score = Math.max(score, TOWER_DIVE_RETREAT_SCORE);
    }

    const enemies = context.getEnemyChampionsInRange(champion, THREAT_RADIUS);
    if (enemies.length > 0) {
      const allies = context.getAllyChampionsInRange(champion, THREAT_RADIUS);
      // allies excludes self, so subtract one more to account for the champion itself.
      const outnumber = Math.max(0, enemies.length - (allies.length + 1));
      const fear = 1 - champion.hpPercent;

      let threatScore = outnumber * 45 + fear * 70;
      // Even a lone enemy is dangerous when you are already hurt.
      if (enemies.length > allies.length) {
        threatScore += fear * 25;
      }
      score = Math.max(score, threatScore);
    }

    return score;
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    champion.state = "retreating";
    champion.target = null;

    const divingTower = context.getUnsafeEnemyTowerForChampion(champion);
    if (divingTower) {
      champion.moveTowards(context.getSafeWaitPoint(champion, divingTower), dt, 1.15);
      return;
    }

    const tower = context.getNearestAllyTower(champion);
    const haven = tower ? tower.pos : context.getBasePosition(champion.side as "blue" | "red");
    champion.moveTowards(haven, dt, 1.15);
  }
}
