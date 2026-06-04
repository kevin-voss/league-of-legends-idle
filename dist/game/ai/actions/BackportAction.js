                                                           
                                           
                                                       
import { COMBAT_LOCK_RADIUS, HOME_RADIUS } from "../AiTuning.js";

/**
 * Recall to base. Driven by survival (low HP) and economy (unspent gold),
 * but gated by safety: a champion will not start a channel while pinned by an
 * enemy or while already standing in the fountain.
 */
export class BackportAction                   {
           name = "BACKPORT";

  calculateScore(champion          , context              )         {
    const base = context.getBasePosition(champion.side                  );
    // Cannot (or need not) recall when already home, or while combat-locked.
    if (champion.distanceTo(base) <= HOME_RADIUS) {
      return 0;
    }
    if (context.hasEnemyChampionNear(champion, COMBAT_LOCK_RADIUS)) {
      return 0;
    }

    let score = 0;
    const hpPercent = champion.hpPercent;

    if (hpPercent < 0.15) {
      score += 85;
    } else if (hpPercent < 0.3) {
      score += 45;
    }

    const wantsToShop = champion.statsLine.gold >= champion.nextBackGold;
    if (wantsToShop) {
      score += 35;
    }

    // Healthy and nothing to buy: no reason to give up map presence.
    if (hpPercent > 0.7 && !wantsToShop) {
      score = 0;
    }

    return score;
  }

  execute(champion          , _context              , _dt        )       {
    champion.beginBackport();
  }
}
