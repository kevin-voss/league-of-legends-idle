import type { Champion } from "../entities/Champion.js";
import type { Action } from "./Action.js";
import type { MatchContext } from "./MatchContext.js";
import { BackportAction } from "./actions/BackportAction.js";
import { RetreatAction } from "./actions/RetreatAction.js";
import { JungleCampAction } from "./actions/JungleCampAction.js";
import { AttackChampionAction } from "./actions/AttackChampionAction.js";
import { PushTowerAction } from "./actions/PushTowerAction.js";
import { FarmMinionAction } from "./actions/FarmMinionAction.js";

export interface ActionScore {
  action: Action;
  score: number;
}

/**
 * Utility AI: every tick each action scores the champion's situation and the
 * highest scorer runs. This replaces a rigid state machine with fluid,
 * stat-driven decisions — a hurt, wealthy champion recalls; a healthy one with
 * backup dives; a lone laner farms and falls back as it gets pressured.
 *
 * Actions are stateless, so a single shared brain serves every champion.
 */
export class UtilityBrain {
  // Listed in tie-break priority order; FarmMinionAction is the floor / default.
  private readonly actions: Action[] = [
    new BackportAction(),
    new RetreatAction(),
    new JungleCampAction(),
    new AttackChampionAction(),
    new PushTowerAction(),
    new FarmMinionAction()
  ];

  /** Scores every action without executing — useful for tests and debugging. */
  evaluate(champion: Champion, context: MatchContext): ActionScore[] {
    return this.actions.map((action) => ({ action, score: action.calculateScore(champion, context) }));
  }

  /** Returns the action with the highest score (first wins ties). */
  select(champion: Champion, context: MatchContext): Action {
    let best = this.actions[this.actions.length - 1] as Action;
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

  tick(champion: Champion, context: MatchContext, dt: number): void {
    this.select(champion, context).execute(champion, context, dt);
  }
}
