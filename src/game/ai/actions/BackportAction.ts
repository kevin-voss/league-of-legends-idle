import type { Champion } from "../../entities/Champion.js";
import { buildChampionSituation, shouldPrioritizeLastHit } from "../ChampionSituation.js";
import type { Action } from "../Action.js";
import type { MatchContext } from "../MatchContext.js";
import { getRoleProfile } from "../RoleProfiles.js";

/**
 * Recall for HP reset and shopping.
 * @see docs/CHAMPION_AI.md — Backport
 */
export class BackportAction implements Action {
  readonly name = "BACKPORT";

  calculateScore(champion: Champion, context: MatchContext): number {
    const situation = buildChampionSituation(champion, context);

    if (situation.isAtBase || situation.isCombatLocked) {
      return 0;
    }

    if (shouldPrioritizeLastHit(situation) && situation.hpPercent > 0.4) {
      return 0;
    }

    const shopWeight = getRoleProfile(champion.role).shopUrgency;
    let score = 0;

    if (situation.hpPercent < 0.15) {
      score += 85;
    } else if (situation.hpPercent < 0.3) {
      score += 45;
    }

    if (situation.wantsToShop) {
      score += 35 * shopWeight;
    }

    if (situation.hpPercent > 0.7 && !situation.wantsToShop) {
      score = 0;
    }

    return score;
  }

  execute(champion: Champion, _context: MatchContext, _dt: number): void {
    champion.beginBackport();
  }
}
