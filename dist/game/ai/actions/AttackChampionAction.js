                                                           
import { buildChampionSituation, shouldPrioritizeLastHit } from "../ChampionSituation.js";
                                           
                                                       
import { ENGAGE_RADIUS } from "../AiTuning.js";
import { getRoleProfile } from "../RoleProfiles.js";

/**
 * Lane duel / execute when ahead or backed by wave.
 * @see docs/CHAMPION_AI.md — Attack champion
 */
export class AttackChampionAction                   {
           name = "ATTACK_CHAMPION";

  calculateScore(champion          , context              )         {
    const situation = buildChampionSituation(champion, context);
    const target = situation.laneOpponent;
    if (!target || champion.distanceTo(target) > ENGAGE_RADIUS) {
      return 0;
    }

    if (shouldPrioritizeLastHit(situation) && target.hpPercent > 0.35) {
      return 0;
    }

    const profile = getRoleProfile(champion.role);
    let score = 20;
    score += (situation.hpPercent - target.hpPercent) * 50;
    if (target.hpPercent < 0.35) {
      score += 50;
    }

    score += situation.alliesInEngageRange.length * 15;

    const minions = context.getAlliedMinionsInRange(champion, 360);
    score += Math.min(minions.length, 6) * 4;

    if (champion.role === "jungle") {
      score += 35;
    }

    return Math.max(0, score * profile.duelAggression);
  }

  execute(champion          , context              , dt        )       {
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
