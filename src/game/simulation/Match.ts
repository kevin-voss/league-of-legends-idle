import {
  BASE_MAX_HP,
  BARON_BUFF_BONUS,
  BARON_BUFF_DURATION,
  BARON_LEVEL_REQUIREMENT,
  BARON_RESPAWN_SECONDS,
  BARON_SPAWN_SECONDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DRAGON_BUFF_BONUS,
  DRAGON_LEVEL_REQUIREMENT,
  DRAGON_RESPAWN_SECONDS,
  DRAGON_SPAWN_SECONDS,
  KILL_BUFF_BONUS,
  KILL_BUFF_DURATION,
  MATCH_MAX_SECONDS,
  MATCH_MIN_SECONDS,
  ROLES,
  TIER_ORDER,
  WAVE_INTERVAL_SECONDS,
  XP_PER_ASSIST,
  XP_PER_BARON,
  XP_PER_CAMP,
  XP_PER_CHAMPION_KILL,
  XP_PER_DRAGON,
  XP_PER_MINION,
  XP_SHARE_RADIUS
} from "../../data/Constants.js";
import { CHAMPIONS, getHighestUnlockedTier, getTemplatesByRole } from "../../data/Champions.js";
import { BASE_POSITIONS, getEnemySide, getLaneCenter, getLanePath, getRoleLane, JUNGLE_CAMPS, OBJECTIVE_POSITIONS, STRUCTURE_LAYOUT } from "../../data/MapData.js";
import type { ChampionSelection, ChampionStats, DamageType, EntitySide, LaneId, MatchChampionStats, MatchResult, Point, Role, TeamSide } from "../../data/models.js";
import { Vector2 } from "../../core/Vector2.js";
import { Champion } from "../entities/Champion.js";
import { Entity } from "../entities/Entity.js";
import { Minion } from "../entities/Minion.js";
import { Monster } from "../entities/Monster.js";
import { Structure } from "../entities/Structure.js";
import { RiftMap } from "../map/RiftMap.js";
import { Spawner } from "../map/Spawner.js";
import type { MatchContext } from "../ai/MatchContext.js";

export interface FloatingText {
  pos: Vector2;
  text: string;
  color: string;
  life: number;
}

export interface ProjectileVFX {
  start: Vector2;
  end: Vector2;
  pos: Vector2;
  color: string;
  life: number;
  maxLife: number;
}

export interface TeamMatchStats {
  kills: number;
  deaths: number;
  creepScore: number;
  gold: number;
}

export interface MatchConfig {
  playerTeam: ChampionSelection[];
  accountLevel: number;
  rng?: () => number;
}

interface EntityCache {
  champions: Record<TeamSide, Champion[]>;
  minions: Record<TeamSide, Minion[]>;
  structures: Record<TeamSide, Structure[]>;
}

const LANES: LaneId[] = ["top", "mid", "bot"];

export class Match implements MatchContext {
  readonly playerSide: TeamSide = "blue";
  readonly enemySide: TeamSide = "red";
  champions: Champion[] = [];
  minions: Minion[] = [];
  monsters: Monster[] = [];
  structures: Structure[] = [];
  floatingTexts: FloatingText[] = [];
  projectiles: ProjectileVFX[] = [];
  baseHp: Record<TeamSide, number> = { blue: BASE_MAX_HP, red: BASE_MAX_HP };
  dragonKills: Record<TeamSide, number> = { blue: 0, red: 0 };
  baronKills: Record<TeamSide, number> = { blue: 0, red: 0 };
  elapsedSeconds = 0;
  completed = false;
  winner: TeamSide | null = null;
  eventLog: string[] = [];

  private map = new RiftMap();
  private spawner = new Spawner();
  private rng: () => number;
  private waveTimer = 1;
  private waveNumber = 0;
  private result: MatchResult | null = null;
  private targetCache: EntityCache = {
    champions: { blue: [], red: [] },
    minions: { blue: [], red: [] },
    structures: { blue: [], red: [] }
  };

  constructor(config: MatchConfig) {
    this.rng = config.rng ?? Math.random;
    this.spawnStructures();
    this.spawnChampions(config.playerTeam, this.createEnemyTeam(config.accountLevel));
    this.spawnMonsters();
    this.updateStructureLocks();
    this.syncBaseHp();
  }

  update(dt: number): void {
    if (this.completed) {
      return;
    }

    this.elapsedSeconds += dt;
    this.waveTimer -= dt;

    if (this.waveTimer <= 0) {
      this.spawnMinionWaves();
      this.waveTimer += WAVE_INTERVAL_SECONDS;
    }

    this.updateStructureLocks();
    this.refreshTargetCache();

    for (const champion of this.champions) {
      champion.update(this, dt);
    }

    for (const minion of this.minions) {
      minion.update(this, dt);
    }

    for (const monster of this.monsters) {
      monster.update(this, dt);
    }

    for (const structure of this.structures) {
      structure.update(this, dt);
    }

    this.applyStrategicPressure(dt);
    this.updateVFX(dt);
    this.cleanupEntities();
    this.updateStructureLocks();
    this.syncBaseHp();
    this.checkCompletion();

    if (!this.completed && this.elapsedSeconds >= MATCH_MAX_SECONDS) {
      this.finish(this.decideTimeoutWinner());
    }
  }

  getResult(): MatchResult {
    if (!this.result) {
      this.finish(this.decideTimeoutWinner());
    }
    return this.result as MatchResult;
  }

  getBasePosition(side: TeamSide): Point {
    return BASE_POSITIONS[side];
  }

  getEnemyBasePosition(side: TeamSide): Point {
    return BASE_POSITIONS[getEnemySide(side)];
  }

  getTeamStats(side: TeamSide): TeamMatchStats {
    return this.champions
      .filter((champion) => champion.side === side)
      .reduce<TeamMatchStats>((totals, champion) => {
        totals.kills += champion.statsLine.kills;
        totals.deaths += champion.statsLine.deaths;
        totals.creepScore += champion.statsLine.creepScore;
        totals.gold += champion.statsLine.gold;
        return totals;
      }, { kills: 0, deaths: 0, creepScore: 0, gold: 0 });
  }

  getPathForChampion(champion: Champion): Point[] {
    return this.map.getPathForRole(champion.role, champion.side);
  }

  getPathForLane(lane: LaneId, side: TeamSide): Point[] {
    return getLanePath(lane, side);
  }

  getDefensiveStats(target: Entity): ChampionStats {
    if (target instanceof Champion) {
      return target.stats;
    }

    if (target instanceof Minion) {
      return {
        hp: target.maxHp,
        ad: target.ad,
        ap: 0,
        armor: target.armor,
        mr: target.mr,
        as: target.attackSpeed,
        ms: target.speed,
        range: target.attackRange
      };
    }

    if (target instanceof Monster) {
      return {
        hp: target.maxHp,
        ad: target.ad,
        ap: 0,
        armor: target.armor,
        mr: target.mr,
        as: target.attackSpeed,
        ms: 0,
        range: 120
      };
    }

    if (target instanceof Structure) {
      return {
        hp: target.maxHp,
        ad: target.ad,
        ap: 0,
        armor: target.armor,
        mr: target.mr,
        as: target.attackSpeed,
        ms: 0,
        range: target.attackRange
      };
    }

    return { hp: target.maxHp, ad: 0, ap: 0, armor: 0, mr: 0, as: 0.5, ms: 0, range: 50 };
  }

  applyDamage(attacker: Entity, target: Entity, amount: number, damageType: DamageType, source: string): void {
    if (!target.alive || amount <= 0) {
      return;
    }

    const applied = target.takeDamage(amount);
    if (applied <= 0) {
      return;
    }

    attacker.damageDealt += applied;

    if (attacker instanceof Champion) {
      attacker.statsLine.damageDealt += applied;
    }

    if (target instanceof Structure && target.structureType === "nexus") {
      this.syncBaseHp();
    }

    this.spawnDamageVFX(attacker, target, applied, damageType, source);

    if (!target.alive) {
      this.handleKill(attacker, target);
    }
  }

  damageEnemyBase(attackerSide: TeamSide, amount: number, attacker?: Entity): void {
    const defenderSide = getEnemySide(attackerSide);
    const nexus = this.getNexus(defenderSide);
    if (!nexus || !nexus.alive || !this.isNexusExposed(defenderSide) || !attacker || attacker.side !== attackerSide) {
      return;
    }

    const activeTarget = attacker instanceof Champion || attacker instanceof Minion ? attacker.target : null;
    if (activeTarget !== nexus || attacker.distanceTo(nexus) > this.getAttackRange(attacker)) {
      return;
    }

    const applied = nexus.takeDamage(Math.max(0, amount));
    if (applied <= 0) {
      return;
    }

    this.baseHp[defenderSide] = nexus.currentHp;

    if (attacker instanceof Champion) {
      attacker.statsLine.damageDealt += applied;
    }

    if (applied > 24 || nexus.currentHp <= 0) {
      const base = nexus.pos;
      this.floatingTexts.push({
        pos: new Vector2(base.x, base.y - 38),
        text: `-${Math.round(applied)}`,
        color: attackerSide === "blue" ? "#79c7ff" : "#ff8b7d",
        life: 0.65
      });
    }

    if (!nexus.alive) {
      this.pushEvent(`${attackerSide} destroyed the ${defenderSide} nexus`);
      this.finish(attackerSide);
    }
  }

  findTargetForChampion(champion: Champion): Entity | null {
    const radius = champion.role === "adc" || champion.role === "mid" ? 285 : champion.role === "support" ? 245 : 220;
    const enemySide = getEnemySide(champion.side);
    const lane = this.getChampionLane(champion);
    const enemyChampions = this.targetCache.champions[enemySide]
      .filter((candidate) => candidate.alive && candidate.state !== "backing")
      .filter((candidate) => candidate.role === "jungle" || this.getChampionLane(candidate) === lane);
    const enemyMinions = this.targetCache.minions[enemySide]
      .filter((candidate) => candidate.alive)
      .filter((candidate) => candidate.lane === lane);
    const structure = this.getAttackableStructureForLane(champion.side, lane);
    const structures = structure && this.canChampionAttackStructure(champion, structure) ? [structure] : [];
    const candidates: Entity[] = [...enemyChampions, ...enemyMinions, ...structures]
      .filter((candidate) => champion.distanceTo(candidate) <= radius);

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => this.scoreTarget(champion, a) - this.scoreTarget(champion, b));
    return candidates[0] ?? null;
  }

  findTargetForMinion(minion: Minion): Entity | null {
    const enemySide = getEnemySide(minion.side);
    const laneGate = this.getAttackableStructureForLane(minion.side, minion.lane);
    const enemies: Entity[] = [
      ...this.targetCache.minions[enemySide].filter((candidate) => candidate.alive && candidate.lane === minion.lane),
      ...(laneGate ? [laneGate] : []),
      ...this.targetCache.champions[enemySide].filter((candidate) => candidate.alive && candidate.state !== "backing")
    ];
    const inRange = enemies.filter((candidate) => minion.distanceTo(candidate) <= 170);
    inRange.sort((a, b) => {
      const priorityA = a.kind === "minion" ? 0 : a.kind === "structure" ? 34 : 80;
      const priorityB = b.kind === "minion" ? 0 : b.kind === "structure" ? 34 : 80;
      return priorityA + minion.distanceTo(a) - (priorityB + minion.distanceTo(b));
    });
    return inRange[0] ?? null;
  }

  findTargetForStructure(structure: Structure): Entity | null {
    if (!structure.alive || structure.isInvulnerable) {
      return null;
    }

    const enemySide = getEnemySide(structure.team);
    const hostileChampionUnderTower = this.targetCache.champions[enemySide]
      .filter((candidate) => candidate.alive && candidate.state !== "backing")
      .filter((candidate) => candidate.target instanceof Champion && candidate.target.side === structure.side)
      .filter((candidate) => structure.distanceTo(candidate) <= structure.attackRange)
      .sort((a, b) => structure.distanceTo(a) - structure.distanceTo(b));

    if (hostileChampionUnderTower[0]) {
      return hostileChampionUnderTower[0];
    }

    const enemyMinions = this.targetCache.minions[enemySide]
      .filter((candidate) => candidate.alive)
      .filter((candidate) => structure.lane === null || candidate.lane === structure.lane)
      .filter((candidate) => structure.distanceTo(candidate) <= structure.attackRange)
      .sort((a, b) => structure.distanceTo(a) - structure.distanceTo(b));

    if (enemyMinions[0]) {
      return enemyMinions[0];
    }

    const enemyChampions = this.targetCache.champions[enemySide]
      .filter((candidate) => candidate.alive && candidate.state !== "backing")
      .filter((candidate) => structure.distanceTo(candidate) <= structure.attackRange)
      .sort((a, b) => structure.distanceTo(a) - structure.distanceTo(b));

    return enemyChampions[0] ?? null;
  }

  hasEnemyChampionNear(champion: Champion, radius: number): boolean {
    return this.findChampionNear(champion.pos, champion.side, radius) !== null;
  }

  getEnemyChampionsInRange(champion: Champion, range: number): Champion[] {
    const enemySide = getEnemySide(champion.side as TeamSide);
    return this.targetCache.champions[enemySide].filter(
      (candidate) => candidate.alive && candidate.state !== "backing" && champion.distanceTo(candidate) <= range
    );
  }

  getAllyChampionsInRange(champion: Champion, range: number): Champion[] {
    return this.targetCache.champions[champion.side as TeamSide].filter(
      (candidate) =>
        candidate !== champion && candidate.alive && candidate.state !== "backing" && champion.distanceTo(candidate) <= range
    );
  }

  getAlliedMinionsInRange(champion: Champion, range: number): Minion[] {
    return this.targetCache.minions[champion.side as TeamSide].filter(
      (minion) => minion.alive && champion.distanceTo(minion) <= range
    );
  }

  getNearestEnemyChampion(champion: Champion): Champion | null {
    const enemySide = getEnemySide(champion.side as TeamSide);
    const candidates = this.targetCache.champions[enemySide]
      .filter((candidate) => candidate.alive && candidate.state !== "backing")
      .sort((a, b) => champion.distanceTo(a) - champion.distanceTo(b));
    return candidates[0] ?? null;
  }

  getNearestAllyTower(champion: Champion): Structure | null {
    const towers = this.targetCache.structures[champion.side as TeamSide]
      .filter((structure) => structure.alive && structure.structureType === "tower")
      .sort((a, b) => champion.distanceTo(a) - champion.distanceTo(b));
    if (towers[0]) {
      return towers[0];
    }
    const nexus = this.getNexus(champion.side as TeamSide);
    return nexus && nexus.alive ? nexus : null;
  }

  findCampForJungler(champion: Champion): Monster | null {
    const sideCamps = JUNGLE_CAMPS.filter((camp) => camp.side === champion.side);
    for (let offset = 0; offset < sideCamps.length; offset += 1) {
      const index = (champion.jungleCampIndex + offset) % sideCamps.length;
      const camp = sideCamps[index];
      if (!camp) {
        continue;
      }
      const monster = this.monsters.find((candidate) => candidate.alive && candidate.monsterType === "camp" && candidate.id.endsWith(camp.id));
      if (monster) {
        champion.jungleCampIndex = index;
        return monster;
      }
    }

    return null;
  }

  findObjectiveForJungler(champion: Champion): Monster | null {
    const objectives = this.monsters
      .filter((monster) => monster.alive && (monster.monsterType === "dragon" || monster.monsterType === "baron"))
      .filter((monster) => {
        if (monster.monsterType === "dragon") {
          return this.elapsedSeconds >= DRAGON_SPAWN_SECONDS && champion.matchLevel >= DRAGON_LEVEL_REQUIREMENT;
        }
        return this.elapsedSeconds >= BARON_SPAWN_SECONDS && champion.matchLevel >= BARON_LEVEL_REQUIREMENT;
      })
      .sort((a, b) => champion.distanceTo(a) - champion.distanceTo(b));

    return objectives[0] ?? null;
  }

  getUnsafeEnemyTowerForChampion(champion: Champion): Structure | null {
    const enemySide = getEnemySide(champion.side);
    const towers = this.targetCache.structures[enemySide]
      .filter((structure) => structure.alive && !structure.isInvulnerable && structure.structureType === "tower")
      .filter((structure) => champion.distanceTo(structure) <= structure.attackRange)
      .sort((a, b) => champion.distanceTo(a) - champion.distanceTo(b));
    return towers[0] ?? null;
  }

  hasAlliedMinionInStructureRange(side: TeamSide, structure: Structure): boolean {
    return this.targetCache.minions[side].some((minion) =>
      minion.alive &&
      minion.distanceTo(structure) <= structure.attackRange
    );
  }

  getSafeWaitPoint(champion: Champion, tower: Structure): Point {
    let direction = champion.pos.clone().subtract(tower.pos).normalized();
    if (direction.length() === 0) {
      direction = Vector2.from(BASE_POSITIONS[champion.side]).subtract(tower.pos).normalized();
    }

    const distance = tower.attackRange + 56;
    return {
      x: Math.max(24, Math.min(CANVAS_WIDTH - 24, tower.pos.x + direction.x * distance)),
      y: Math.max(24, Math.min(CANVAS_HEIGHT - 24, tower.pos.y + direction.y * distance))
    };
  }

  getDefensePoint(side: TeamSide, lane: LaneId): Point {
    const base = BASE_POSITIONS[side];
    const laneCenter = getLaneCenter(lane);
    const direction = Vector2.from(laneCenter).subtract(base).normalized();
    return {
      x: Math.max(24, Math.min(CANVAS_WIDTH - 24, base.x + direction.x * 88)),
      y: Math.max(24, Math.min(CANVAS_HEIGHT - 24, base.y + direction.y * 88))
    };
  }

  findChampionNear(point: Point, side: EntitySide, radius: number): Champion | null {
    const pool = side === "blue" ? this.targetCache.champions.red : side === "red" ? this.targetCache.champions.blue : this.champions;
    const candidates = pool
      .filter((champion) => champion.alive && champion.state !== "backing")
      .filter((champion) => side === "neutral" || champion.side !== side)
      .filter((champion) => Vector2.distance(champion.pos, point) <= radius)
      .sort((a, b) => Vector2.distance(a.pos, point) - Vector2.distance(b.pos, point));

    return candidates[0] ?? null;
  }

  private grantProximityXp(side: TeamSide, point: Point, radius: number, amount: number): void {
    for (const champion of this.targetCache.champions[side]) {
      if (champion.alive && Vector2.distance(champion.pos, point) <= radius) {
        champion.gainXp(amount);
      }
    }
  }

  private grantTeamXp(side: TeamSide, amount: number): void {
    for (const champion of this.targetCache.champions[side]) {
      if (champion.alive) {
        champion.gainXp(amount);
      }
    }
  }

  private grantTeamBuff(side: TeamSide, id: string, bonus: number, duration: number): void {
    for (const champion of this.champions) {
      if (champion.side === side && champion.alive) {
        champion.addBuff(id, bonus, duration);
      }
    }
  }

  // Re-applies buffs that should outlive death (dragon stacks) when a champion respawns.
  syncPersistentTeamBuffs(champion: Champion): void {
    const dragons = this.dragonKills[champion.side as TeamSide];
    if (dragons > 0) {
      champion.addBuff("dragon", dragons * DRAGON_BUFF_BONUS, Number.POSITIVE_INFINITY);
    }
  }

  private grantAssists(killer: Champion, victim: Champion): void {
    for (const ally of this.targetCache.champions[killer.side]) {
      if (ally === killer || !ally.alive) {
        continue;
      }
      if (ally.distanceTo(victim) <= XP_SHARE_RADIUS) {
        ally.statsLine.assists += 1;
        ally.gainXp(XP_PER_ASSIST);
      }
    }
  }

  private spawnStructures(): void {
    this.structures = STRUCTURE_LAYOUT.map((definition) => new Structure(definition));
  }

  private spawnChampions(playerTeam: ChampionSelection[], enemyTeam: ChampionSelection[]): void {
    const offsets: Record<Role, Point> = {
      top: { x: 0, y: -34 },
      jungle: { x: 38, y: -6 },
      mid: { x: 0, y: 0 },
      adc: { x: -34, y: 30 },
      support: { x: 34, y: 34 }
    };

    for (const selection of playerTeam) {
      const base = BASE_POSITIONS.blue;
      const offset = offsets[selection.template.role];
      this.champions.push(new Champion(selection, "blue", { x: base.x + offset.x, y: base.y + offset.y }));
    }

    for (const selection of enemyTeam) {
      const base = BASE_POSITIONS.red;
      const offset = offsets[selection.template.role];
      this.champions.push(new Champion(selection, "red", { x: base.x - offset.x, y: base.y - offset.y }));
    }
  }

  private createEnemyTeam(accountLevel: number): ChampionSelection[] {
    const unlockedTier = getHighestUnlockedTier(Math.max(1, accountLevel + 8));
    const maxTierIndex = Math.max(0, TIER_ORDER.indexOf(unlockedTier));

    return ROLES.map((role) => {
      const pool = getTemplatesByRole(role).filter((template) => TIER_ORDER.indexOf(template.tier) <= maxTierIndex);
      const fallback = getTemplatesByRole(role)[0] ?? CHAMPIONS[0];
      const template = pool[Math.floor(this.rng() * pool.length)] ?? fallback;
      return {
        template,
        owned: {
          uid: `enemy-${role}-${template.id}`,
          templateId: template.id,
          level: Math.max(1, Math.floor(accountLevel * 0.75 + this.rng() * 3)),
          experience: 0
        }
      };
    });
  }

  private spawnMonsters(): void {
    for (const camp of JUNGLE_CAMPS) {
      this.monsters.push(new Monster("camp", `${camp.side} ${camp.name}`, { x: camp.x, y: camp.y }, 0, 30));
    }

    this.monsters.push(new Monster("dragon", "Dragon", OBJECTIVE_POSITIONS.dragon, DRAGON_SPAWN_SECONDS, DRAGON_RESPAWN_SECONDS));
    this.monsters.push(new Monster("baron", "Baron", OBJECTIVE_POSITIONS.baron, BARON_SPAWN_SECONDS, BARON_RESPAWN_SECONDS));
  }

  private spawnMinionWaves(): void {
    this.waveNumber += 1;
    for (const lane of LANES) {
      this.minions.push(...this.spawner.spawnWave("blue", lane, this.waveNumber));
      this.minions.push(...this.spawner.spawnWave("red", lane, this.waveNumber));
    }
    this.pushEvent(`Wave ${this.waveNumber} has spawned`);
  }

  private handleKill(attacker: Entity, target: Entity): void {
    if (target instanceof Champion) {
      target.die(this);
      if (attacker instanceof Champion) {
        attacker.statsLine.kills += 1;
        attacker.statsLine.gold += 300;
        attacker.gainXp(XP_PER_CHAMPION_KILL);
        // Slaying a champion empowers the killer: +25% to every stat for 30 seconds.
        attacker.addBuff("kill", KILL_BUFF_BONUS, KILL_BUFF_DURATION);
        this.grantAssists(attacker, target);
        this.pushEvent(`${attacker.template.name} slew ${target.template.name} (empowered)`);
      }
      return;
    }

    if (target instanceof Minion) {
      target.deathTimer = 0.55;
      if (attacker instanceof Champion) {
        attacker.statsLine.creepScore += 1;
        attacker.statsLine.gold += target.type === "caster" ? 18 : 14;
      }
      // Nearby enemies of the minion soak up the experience, last hit or not.
      this.grantProximityXp(getEnemySide(target.side), target.pos, XP_SHARE_RADIUS, XP_PER_MINION);
      return;
    }

    if (target instanceof Monster) {
      const killerSide = attacker.side === "red" ? "red" : "blue";
      target.scheduleRespawn();

      if (target.monsterType === "camp") {
        if (attacker instanceof Champion) {
          attacker.statsLine.creepScore += 2;
          attacker.statsLine.gold += 55;
          attacker.gainXp(XP_PER_CAMP);
          if (attacker.role === "jungle") {
            const sideCamps = JUNGLE_CAMPS.filter((camp) => camp.side === attacker.side);
            attacker.jungleCampIndex = sideCamps.length > 0 ? (attacker.jungleCampIndex + 1) % sideCamps.length : 0;
          }
        }
        return;
      }

      if (attacker instanceof Champion) {
        attacker.statsLine.creepScore += 4;
        attacker.statsLine.gold += 120;
      }

      if (target.monsterType === "dragon") {
        this.dragonKills[killerSide] += 1;
        this.applyObjectivePressure(killerSide, 260);
        this.grantTeamXp(killerSide, XP_PER_DRAGON);
        // Dragons leave a permanent, stacking power buff for the whole team.
        this.grantTeamBuff(killerSide, "dragon", this.dragonKills[killerSide] * DRAGON_BUFF_BONUS, Number.POSITIVE_INFINITY);
        this.pushEvent(`${killerSide} secured Dragon (team buff x${this.dragonKills[killerSide]})`);
      }

      if (target.monsterType === "baron") {
        this.baronKills[killerSide] += 1;
        this.applyObjectivePressure(killerSide, 520);
        this.grantTeamXp(killerSide, XP_PER_BARON);
        // Baron is a strong but temporary team-wide buff.
        this.grantTeamBuff(killerSide, "baron", BARON_BUFF_BONUS, BARON_BUFF_DURATION);
        this.pushEvent(`${killerSide} secured Baron (team empowered)`);
      }
      return;
    }

    if (target instanceof Structure) {
      const attackerSide = attacker.side === "red" ? "red" : "blue";
      target.deathTimer = 1.2;
      this.updateStructureLocks();
      this.syncBaseHp();

      if (attacker instanceof Champion) {
        attacker.statsLine.gold += target.structureType === "tower" ? (target.tier === 1 ? 220 : 300) : 500;
      }

      if (target.structureType === "tower") {
        this.pushEvent(`${attackerSide} destroyed ${target.team} ${target.lane} tier ${target.tier}`);
        if (target.tier === 2 && target.lane) {
          this.assignLaneCommit(attackerSide, target.team, target.lane);
        }
        return;
      }

      this.pushEvent(`${attackerSide} destroyed the ${target.team} nexus`);
      this.finish(attackerSide);
    }
  }

  private assignLaneCommit(attackingTeam: TeamSide, defendingTeam: TeamSide, openedLane: LaneId): void {
    for (const champion of this.champions) {
      if (!champion.alive) {
        continue;
      }

      if (champion.side === attackingTeam) {
        champion.assignRotation(openedLane, "push");
        champion.pathIndex = this.getNearestPathIndex(champion.pos, getLanePath(openedLane, champion.side));
      }

      if (champion.side === defendingTeam) {
        champion.assignRotation(openedLane, "defend");
      }
    }
    this.pushEvent(`${attackingTeam} groups ${openedLane}; ${defendingTeam} defends`);
  }

  private canChampionAttackStructure(champion: Champion, structure: Structure): boolean {
    if (structure.structureType !== "tower") {
      return true;
    }
    return this.hasAlliedMinionInStructureRange(champion.side, structure);
  }

  private getChampionLane(champion: Champion): LaneId {
    return champion.rotationLane ?? getRoleLane(champion.role);
  }

  private getNearestPathIndex(point: Point, path: Point[]): number {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    path.forEach((candidate, index) => {
      const distance = Vector2.distance(point, candidate);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }

  private getAttackRange(attacker: Entity): number {
    if (attacker instanceof Champion) {
      return attacker.stats.range;
    }
    if (attacker instanceof Minion) {
      return attacker.attackRange;
    }
    if (attacker instanceof Structure) {
      return attacker.attackRange;
    }
    return 0;
  }

  private scoreTarget(champion: Champion, target: Entity): number {
    const distance = champion.distanceTo(target);
    if (target instanceof Champion) {
      const fightBias = champion.role === "jungle" || champion.role === "support" ? -115 : -42;
      const lowHpBias = (1 - target.hpPercent) * -130;
      return distance + fightBias + lowHpBias;
    }
    if (target instanceof Structure) {
      const objectiveBias = target.structureType === "nexus" ? -92 : -48;
      return distance + objectiveBias + (1 - target.hpPercent) * -80;
    }
    return distance + (champion.role === "adc" || champion.role === "mid" || champion.role === "top" ? -22 : 12);
  }

  private spawnDamageVFX(attacker: Entity, target: Entity, amount: number, damageType: DamageType, source: string): void {
    const color = damageType === "magic" ? "#c99aff" : damageType === "true" ? "#ffffff" : attacker.side === "blue" ? "#82d3ff" : "#ff927f";
    this.floatingTexts.push({
      pos: new Vector2(target.pos.x, target.pos.y - target.radius - 8),
      text: `${source === "Auto" ? "" : source + " "}${Math.round(amount)}`,
      color,
      life: 0.72
    });
    this.projectiles.push({
      start: attacker.pos.clone(),
      end: target.pos.clone(),
      pos: attacker.pos.clone(),
      color,
      life: 0.22,
      maxLife: 0.22
    });
  }

  private updateVFX(dt: number): void {
    for (const text of this.floatingTexts) {
      text.life -= dt;
      text.pos.y -= 24 * dt;
    }

    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      const progress = 1 - Math.max(0, projectile.life) / projectile.maxLife;
      projectile.pos.x = projectile.start.x + (projectile.end.x - projectile.start.x) * progress;
      projectile.pos.y = projectile.start.y + (projectile.end.y - projectile.start.y) * progress;
    }

    this.floatingTexts = this.floatingTexts.filter((text) => text.life > 0);
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
  }

  private cleanupEntities(): void {
    this.minions = this.minions.filter((minion) => !minion.remove);
  }

  private applyStrategicPressure(dt: number): void {
    if (this.elapsedSeconds < MATCH_MIN_SECONDS) {
      return;
    }

    const bluePressure = this.getPressure("blue");
    const redPressure = this.getPressure("red");
    const blueAdvantage = Math.max(0, bluePressure - redPressure * 0.64);
    const redAdvantage = Math.max(0, redPressure - bluePressure * 0.64);
    this.applyLanePressure("blue", blueAdvantage, dt);
    this.applyLanePressure("red", redAdvantage, dt);
  }

  private getPressure(side: TeamSide): number {
    const alivePower = this.champions
      .filter((champion) => champion.side === side && champion.alive)
      .reduce((total, champion) => total + champion.stats.ad + champion.stats.ap * 0.72 + champion.matchLevel * 10, 0);
    const minionPower = this.minions.filter((minion) => minion.side === side && minion.alive).length * 8;
    const objectivePower = this.dragonKills[side] * 85 + this.baronKills[side] * 180;
    return alivePower + minionPower + objectivePower;
  }

  private applyLanePressure(attackerSide: TeamSide, pressure: number, dt: number): void {
    if (pressure <= 0) {
      return;
    }

    const damage = pressure * dt * 0.24;
    for (const lane of LANES) {
      const target = this.getAttackableStructureForLane(attackerSide, lane);
      if (!target || !target.alive || target.isInvulnerable || target.structureType === "nexus") {
        continue;
      }

      if (!this.hasAlliedMinionInStructureRange(attackerSide, target)) {
        continue;
      }

      const applied = target.takeDamage(damage);
      if (applied <= 0) {
        continue;
      }

      if (!target.alive) {
        this.handleKill(this.getPressureSource(attackerSide), target);
        if (this.completed) {
          return;
        }
      }
    }
  }

  private applyObjectivePressure(attackerSide: TeamSide, amount: number): void {
    const source = this.getPressureSource(attackerSide);
    for (const lane of LANES) {
      const target = this.getAttackableStructureForLane(attackerSide, lane);
      if (!target || !target.alive || target.isInvulnerable || target.structureType === "nexus") {
        continue;
      }

      target.takeDamage(amount);
      if (!target.alive) {
        this.handleKill(source, target);
        if (this.completed) {
          return;
        }
      }
    }
  }

  private getPressureSource(side: TeamSide): Entity {
    const liveChampion = this.champions.find((champion) => champion.side === side && champion.alive);
    const nexus = this.getNexus(side);
    const fallbackChampion = this.champions.find((champion) => champion.side === side);
    return (liveChampion ?? nexus ?? fallbackChampion) as Entity;
  }

  private refreshTargetCache(): void {
    this.targetCache = {
      champions: {
        blue: this.champions.filter((champion) => champion.side === "blue"),
        red: this.champions.filter((champion) => champion.side === "red")
      },
      minions: {
        blue: this.minions.filter((minion) => minion.side === "blue"),
        red: this.minions.filter((minion) => minion.side === "red")
      },
      structures: {
        blue: this.structures.filter((structure) => structure.side === "blue"),
        red: this.structures.filter((structure) => structure.side === "red")
      }
    };
  }

  private updateStructureLocks(): void {
    for (const structure of this.structures) {
      if (structure.structureType !== "tower" || (structure.tier ?? 1) <= 1 || !structure.lane) {
        continue;
      }

      const previousTower = this.structures.find((candidate) =>
        candidate.structureType === "tower" &&
        candidate.side === structure.side &&
        candidate.lane === structure.lane &&
        candidate.tier === (structure.tier ?? 1) - 1
      );
      structure.isInvulnerable = Boolean(previousTower?.alive);
    }
  }

  private syncBaseHp(): void {
    for (const side of ["blue", "red"] as TeamSide[]) {
      const nexus = this.getNexus(side);
      this.baseHp[side] = nexus ? nexus.currentHp : 0;
    }
  }

  private getNexus(side: TeamSide): Structure | null {
    return this.structures.find((structure) => structure.side === side && structure.structureType === "nexus") ?? null;
  }

  private isNexusExposed(defenderSide: TeamSide): boolean {
    return LANES.some((lane) =>
      this.structures
        .filter((structure) => structure.side === defenderSide && structure.structureType === "tower" && structure.lane === lane)
        .every((structure) => !structure.alive)
    );
  }

  private getAttackableStructureForLane(attackerSide: TeamSide, lane: LaneId): Structure | null {
    const defenderSide = getEnemySide(attackerSide);
    const laneTower = this.structures
      .filter((structure) => structure.side === defenderSide && structure.structureType === "tower" && structure.lane === lane && structure.alive)
      .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99))[0];

    if (laneTower) {
      return laneTower;
    }

    if (!this.isNexusExposed(defenderSide)) {
      return null;
    }

    const nexus = this.getNexus(defenderSide);
    return nexus?.alive ? nexus : null;
  }

  private checkCompletion(): void {
    this.syncBaseHp();

    if (this.baseHp.blue <= 0) {
      this.finish("red");
      return;
    }

    if (this.baseHp.red <= 0) {
      this.finish("blue");
      return;
    }
  }

  // When time runs out, the team that made the most structural progress wins. Real
  // nexus damage comes first (it only happens after towers fall), then towers taken,
  // then the broader score, so you cannot win without breaking anything.
  private decideTimeoutWinner(): TeamSide {
    if (this.baseHp.blue !== this.baseHp.red) {
      return this.baseHp.red < this.baseHp.blue ? "blue" : "red";
    }

    const blueTowers = this.enemyTowersDestroyed("blue");
    const redTowers = this.enemyTowersDestroyed("red");
    if (blueTowers !== redTowers) {
      return blueTowers > redTowers ? "blue" : "red";
    }

    const blueStructureDamage = this.getStructureDamageDealt("blue");
    const redStructureDamage = this.getStructureDamageDealt("red");
    if (blueStructureDamage !== redStructureDamage) {
      return blueStructureDamage > redStructureDamage ? "blue" : "red";
    }

    return this.getScore("blue") >= this.getScore("red") ? "blue" : "red";
  }

  private getStructureDamageDealt(side: TeamSide): number {
    const enemySide = getEnemySide(side);
    return this.structures
      .filter((structure) => structure.side === enemySide)
      .reduce((total, structure) => total + (structure.maxHp - structure.currentHp), 0);
  }

  private enemyTowersDestroyed(side: TeamSide): number {
    const enemySide = getEnemySide(side);
    return this.structures.filter((structure) =>
      structure.side === enemySide && structure.structureType === "tower" && !structure.alive
    ).length;
  }

  private getScore(side: TeamSide): number {
    const enemySide = getEnemySide(side);
    const kills = this.champions.filter((champion) => champion.side === side).reduce((total, champion) => total + champion.statsLine.kills, 0);
    const gold = this.champions.filter((champion) => champion.side === side).reduce((total, champion) => total + champion.statsLine.gold, 0);
    const baseDamage = BASE_MAX_HP - this.baseHp[enemySide];
    const towersDestroyed = this.enemyTowersDestroyed(side);
    return towersDestroyed * 1200 + baseDamage + this.dragonKills[side] * 320 + this.baronKills[side] * 640 + kills * 160 + gold * 0.25;
  }

  private finish(winner: TeamSide): void {
    if (this.completed) {
      return;
    }

    this.completed = true;
    this.winner = winner;
    const playerWon = winner === this.playerSide;
    const playerStats = this.champions.filter((champion) => champion.side === this.playerSide).map((champion) => champion.statsLine);
    const playerKills = playerStats.reduce((total, stats) => total + stats.kills, 0);
    const playerObjectives = this.dragonKills.blue + this.baronKills.blue;
    const durationBonus = Math.round(this.elapsedSeconds / 4);

    this.result = {
      winner,
      durationSeconds: this.elapsedSeconds,
      playerWon,
      goldEarned: Math.round(95 + durationBonus + playerKills * 16 + playerObjectives * 35 + (playerWon ? 90 : 35)),
      accountXpEarned: Math.round(46 + this.elapsedSeconds / 7 + (playerWon ? 42 : 16)),
      championXpEarned: Math.round(34 + this.elapsedSeconds / 9 + (playerWon ? 35 : 15)),
      blueBaseHp: this.baseHp.blue,
      redBaseHp: this.baseHp.red,
      dragonKills: { ...this.dragonKills },
      baronKills: { ...this.baronKills },
      championStats: this.champions.map((champion) => ({ ...champion.statsLine, level: champion.matchLevel }))
    };
  }

  private pushEvent(message: string): void {
    this.eventLog.unshift(message);
    this.eventLog = this.eventLog.slice(0, 4);
  }
}
