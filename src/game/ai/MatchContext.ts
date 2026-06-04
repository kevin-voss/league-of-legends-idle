import type { ChampionStats, DamageType, LaneId, Point, TeamSide } from "../../data/models.js";
import type { Champion } from "../entities/Champion.js";
import type { Entity } from "../entities/Entity.js";
import type { Minion } from "../entities/Minion.js";
import type { Monster } from "../entities/Monster.js";
import type { Structure } from "../entities/Structure.js";

/**
 * The slice of the {@link Match} world that the utility brain and its actions are
 * allowed to query. Keeping this as an interface decouples the AI from the full
 * Match implementation and documents exactly what information drives decisions.
 *
 * `Match` declares `implements MatchContext`, so the brain receives the live match
 * at runtime while only depending on this behavioural surface at compile time.
 */
export interface MatchContext {
  getBasePosition(side: TeamSide): Point;
  getPathForChampion(champion: Champion): Point[];
  getPathForLane(lane: LaneId, side: TeamSide): Point[];
  getDefensePoint(side: TeamSide, lane: LaneId): Point;
  getSafeWaitPoint(champion: Champion, tower: Structure): Point;
  getDefensiveStats(target: Entity): ChampionStats;
  applyDamage(attacker: Entity, target: Entity, amount: number, damageType: DamageType, source: string): void;

  findTargetForChampion(champion: Champion): Entity | null;
  findObjectiveForJungler(champion: Champion): Monster | null;
  findCampForJungler(champion: Champion): Monster | null;
  getUnsafeEnemyTowerForChampion(champion: Champion): Structure | null;
  hasAlliedMinionInStructureRange(side: TeamSide, structure: Structure): boolean;
  hasEnemyChampionNear(champion: Champion, radius: number): boolean;

  getEnemyChampionsInRange(champion: Champion, range: number): Champion[];
  getAllyChampionsInRange(champion: Champion, range: number): Champion[];
  getAlliedMinionsInRange(champion: Champion, range: number): Minion[];
  getNearestEnemyChampion(champion: Champion): Champion | null;
  getNearestAllyTower(champion: Champion): Structure | null;
}
