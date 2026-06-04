                                                           
import { buildChampionSituation, shouldPrioritizeLastHit } from "../ChampionSituation.js";
                                           
                                                       
import { TOWER_DIVE_RETREAT_SCORE } from "../AiTuning.js";
import { getRoleProfile } from "../RoleProfiles.js";

/**
 * Short backoff from tower dive or losing fights.
 * @see docs/CHAMPION_AI.md — Retreat
 */
export class RetreatAction                   {
           name = "RETREAT";

  calculateScore(champion          , context              )         {
    if (champion.role === "jungle") {
      return 0;
    }

    const situation = buildChampionSituation(champion, context);
    const sensitivity = getRoleProfile(champion.role).retreatSensitivity;
    let score = 0;

    if (situation.isTowerDiving && !situation.canTankTower) {
      score = Math.max(score, TOWER_DIVE_RETREAT_SCORE);
    }

    if (shouldPrioritizeLastHit(situation)) {
      return score * sensitivity;
    }

    if (situation.enemiesInEngageRange.length > 0) {
      const fear = 1 - situation.hpPercent;
      let threatScore = situation.outnumbered * 45 + fear * 55;
      if (situation.outnumbered > 0) {
        threatScore += fear * 30;
      }
      if (situation.hpPercent < 0.2) {
        threatScore += 40;
      }
      score = Math.max(score, threatScore);
    }

    return score * sensitivity;
  }

  execute(champion          , context              , dt        )       {
    champion.state = "retreating";
    champion.target = null;

    const divingTower = context.getUnsafeEnemyTowerForChampion(champion);
    if (divingTower) {
      champion.moveTowards(context.getSafeWaitPoint(champion, divingTower), dt, 1.15);
      return;
    }

    const tower = context.getNearestAllyTower(champion);
    const haven = tower ? tower.pos : context.getBasePosition(champion.side                  );
    champion.moveTowards(haven, dt, 1.15);
  }
}
