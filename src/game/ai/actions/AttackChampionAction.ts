import type { Champion } from "../../entities/Champion.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { ENGAGE_RADIUS } from "../AiTuning.js";

/**
 * Commit to killing the nearest enemy champion. Bravery scales with the HP gap,
 * nearby allied champions and minion backup; supports are reluctant duelists.
 */
export class AttackChampionAction implements Action {
  readonly name = "ATTACK_CHAMPION";

  calculateScore(champion: Champion, context: MatchContext): number {
    const target = context.getNearestEnemyChampion(champion);
    if (!target) {
      return 0;
    }
    if (champion.distanceTo(target) > ENGAGE_RADIUS) {
      return 0;
    }

    let score = 20; // base aggression
    score += (champion.hpPercent - target.hpPercent) * 50;

    const allies = context.getAllyChampionsInRange(champion, 420);
    score += allies.length * 15;

    const minions = context.getAlliedMinionsInRange(champion, 360);
    score += Math.min(minions.length, 6) * 4;

    // Supports peel rather than duel; junglers prefer their own camps to roaming.
    if (champion.role === "support") {
      score -= 30;
    } else if (champion.role === "jungle") {
      score -= 25;
    }

    return Math.max(0, score);
  }

  execute(champion: Champion, context: MatchContext, dt: number): void {
    const target = context.getNearestEnemyChampion(champion);
    if (!target) {
      champion.state = "farming";
      champion.followPath(context.getPathForChampion(champion), dt);
      return;
    }

    champion.state = "fighting";
    champion.engage(target, context, dt);
  }
}
