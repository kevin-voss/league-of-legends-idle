                                                        
                                          
                                                      
import { BackportAction } from "./actions/BackportAction.js";
import { RetreatAction } from "./actions/RetreatAction.js";
import { JungleCampAction } from "./actions/JungleCampAction.js";
import { AttackChampionAction } from "./actions/AttackChampionAction.js";
import { PushTowerAction } from "./actions/PushTowerAction.js";
import { FarmMinionAction } from "./actions/FarmMinionAction.js";

                              
                 
                
 

/**
 * Utility AI: every tick each action scores the champion's situation and the
 * highest scorer runs. Spec: docs/CHAMPION_AI.md
 *
 * Actions are stateless, so a single shared brain serves every champion.
 */
export class UtilityBrain {
  // Listed in tie-break priority order; FarmMinionAction is the floor / default.
                   actions           = [
    new BackportAction(),
    new RetreatAction(),
    new JungleCampAction(),
    new AttackChampionAction(),
    new PushTowerAction(),
    new FarmMinionAction()
  ];

  /** Scores every action without executing — useful for tests and debugging. */
  evaluate(champion          , context              )                {
    return this.actions.map((action) => ({ action, score: action.calculateScore(champion, context) }));
  }

  /** Returns the action with the highest score (first wins ties). */
  select(champion          , context              )         {
    let best = this.actions[this.actions.length - 1]          ;
    let bestScore = -1;

    for (const action of this.actions) {
      const score = action.calculateScore(champion, context);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }

    return best;
  }

  tick(champion          , context              , dt        )       {
    this.select(champion, context).execute(champion, context, dt);
  }
}
