import { BACK_CHANNEL_SECONDS, MATCH_LEVEL_CAP, MATCH_LEVEL_STAT_GROWTH, matchLevelXpRequirement } from "../../data/Constants.js";
import type { Match } from "../simulation/Match.js";
import { Entity } from "./Entity.js";
import { calculateAttackPeriod, calculateTypedDamage } from "../combat/DamageCalculator.js";
import { calculateAbilityDamage, createCooldowns, getReadyAbility, tickCooldowns, type CooldownMap } from "../combat/AbilityHandler.js";
import type { ChampionAIState, ChampionSelection, ChampionStats, ChampionTemplate, LaneId, MatchChampionStats, Point, Role, RotationIntent, StatBuff, TeamSide } from "../../data/models.js";
import { UtilityBrain } from "../ai/UtilityBrain.js";
import type { MatchContext } from "../ai/MatchContext.js";

const ROLE_ATTACK_RANGE: Record<Role, number> = {
  top: 54,
  jungle: 54,
  mid: 96,
  adc: 110,
  support: 88
};

export class Champion extends Entity {
  template: ChampionTemplate;
  uid: string;
  role: Role;
  tier: string;
  level: number;
  stats: ChampionStats;
  baseStats: ChampionStats;
  matchLevel = 1;
  matchXp = 0;
  buffs: StatBuff[] = [];
  state: ChampionAIState = "spawning";
  pathIndex = 0;
  attackTimer = 0;
  target: Entity | null = null;
  respawnTimer = 0;
  backTimer = 0;
  nextBackGold = 1500;
  rotationLane: LaneId | null = null;
  rotationIntent: RotationIntent | null = null;
  jungleCampIndex = 0;
  cooldowns: CooldownMap;
  statsLine: MatchChampionStats;

  // The utility brain is stateless, so a single shared instance drives everyone.
  private static readonly brain = new UtilityBrain();
  // Snapshot of cumulative damage taken when a recall channel begins; any increase
  // means the champion was hit mid-channel and the recall must break.
  private backChannelDamageMark = 0;

  constructor(selection: ChampionSelection, side: TeamSide, spawn: Point) {
    const scaledStats = Champion.scaleStats(selection.template.baseStats, selection.owned.level);
    scaledStats.range = ROLE_ATTACK_RANGE[selection.template.role];
    super("champion", side, spawn, scaledStats.hp, scaledStats.ms, selection.template.role === "adc" || selection.template.role === "mid" ? 16 : 18);
    this.template = selection.template;
    this.uid = selection.owned.uid;
    this.role = selection.template.role;
    this.tier = selection.template.tier;
    this.level = selection.owned.level;
    this.baseStats = scaledStats;
    this.stats = { ...scaledStats };
    this.cooldowns = createCooldowns(selection.template.abilities);
    this.statsLine = {
      uid: this.uid,
      name: this.template.name,
      role: this.role,
      side,
      level: 1,
      kills: 0,
      deaths: 0,
      assists: 0,
      creepScore: 0,
      damageDealt: 0,
      gold: 0
    };
  }

  static scaleStats(base: ChampionStats, level: number): ChampionStats {
    const multiplier = 1 + Math.max(0, level - 1) * 0.035;
    return {
      hp: Math.round(base.hp * multiplier),
      ad: Math.round(base.ad * multiplier),
      ap: Math.round(base.ap * multiplier),
      armor: Math.round(base.armor * (1 + Math.max(0, level - 1) * 0.018)),
      mr: Math.round(base.mr * (1 + Math.max(0, level - 1) * 0.018)),
      as: Number((base.as * (1 + Math.max(0, level - 1) * 0.007)).toFixed(2)),
      ms: base.ms,
      range: base.range
    };
  }

  gainXp(amount: number): void {
    if (amount <= 0 || this.matchLevel >= MATCH_LEVEL_CAP) {
      return;
    }

    this.matchXp += amount;
    let leveled = false;
    while (this.matchLevel < MATCH_LEVEL_CAP && this.matchXp >= matchLevelXpRequirement(this.matchLevel)) {
      this.matchXp -= matchLevelXpRequirement(this.matchLevel);
      this.matchLevel += 1;
      leveled = true;
    }

    if (leveled) {
      this.recomputeStats();
      if (this.alive) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + this.maxHp * 0.15);
      }
    }
  }

  addBuff(id: string, bonus: number, duration: number): void {
    const existing = this.buffs.find((buff) => buff.id === id);
    if (existing) {
      existing.bonus = bonus;
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.buffs.push({ id, bonus, remaining: duration });
    }
    this.recomputeStats();
  }

  private tickBuffs(dt: number): void {
    if (this.buffs.length === 0) {
      return;
    }

    const before = this.buffs.length;
    for (const buff of this.buffs) {
      if (Number.isFinite(buff.remaining)) {
        buff.remaining -= dt;
      }
    }
    this.buffs = this.buffs.filter((buff) => buff.remaining > 0);
    if (this.buffs.length !== before) {
      this.recomputeStats();
    }
  }

  private recomputeStats(): void {
    const levelMultiplier = 1 + (this.matchLevel - 1) * MATCH_LEVEL_STAT_GROWTH;
    const buffBonus = this.buffs.reduce((total, buff) => total + buff.bonus, 0);
    const combatMultiplier = levelMultiplier * (1 + buffBonus);
    const previousPercent = this.hpPercent;

    this.stats = {
      hp: Math.round(this.baseStats.hp * combatMultiplier),
      ad: Math.round(this.baseStats.ad * combatMultiplier),
      ap: Math.round(this.baseStats.ap * combatMultiplier),
      armor: Math.round(this.baseStats.armor * combatMultiplier),
      mr: Math.round(this.baseStats.mr * combatMultiplier),
      as: Number(Math.min(2.5, this.baseStats.as * combatMultiplier).toFixed(2)),
      ms: Math.round(this.baseStats.ms * (1 + buffBonus)),
      range: this.baseStats.range
    };

    this.maxHp = this.stats.hp;
    this.speed = this.stats.ms;
    if (this.alive) {
      this.currentHp = Math.max(1, Math.round(this.maxHp * previousPercent));
    }
    this.statsLine.level = this.matchLevel;
  }

  update(match: Match, dt: number): void {
    if (!this.alive) {
      this.target = null;
      this.updateDeath(match, dt);
      return;
    }

    this.target = null;
    tickCooldowns(this.cooldowns, dt);
    this.tickBuffs(dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    if (this.state === "backing") {
      this.updateBacking(match, dt);
      return;
    }

    // Utility AI: every tick, score each candidate action and run the strongest.
    // Backporting, retreating, jungling, fighting, sieging and farming are no
    // longer a fixed priority chain — they emerge from stat-driven scores.
    Champion.brain.tick(this, match, dt);
  }

  assignRotation(lane: LaneId, intent: RotationIntent): void {
    this.rotationLane = lane;
    this.rotationIntent = intent;
    this.state = "rotating";
  }

  die(match: Match): void {
    this.alive = false;
    this.state = "dead";
    this.statsLine.deaths += 1;
    this.respawnTimer = Math.min(18, 5 + match.elapsedSeconds / 28);
    this.currentHp = 0;
    this.buffs = this.buffs.filter((buff) => !Number.isFinite(buff.remaining));
    this.recomputeStats();
  }

  private updateDeath(match: Match, dt: number): void {
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      const spawn = match.getBasePosition(this.side);
      this.pos.x = spawn.x;
      this.pos.y = spawn.y;
      // Restore persistent team buffs (e.g. dragons) before topping HP back up.
      match.syncPersistentTeamBuffs(this);
      this.healFull();
      this.pathIndex = 0;
      this.state = "movingToLane";
    }
  }

  /** Starts a recall channel. Called by the brain's BackportAction. */
  beginBackport(): void {
    this.state = "backing";
    this.backTimer = BACK_CHANNEL_SECONDS;
    this.target = null;
    this.backChannelDamageMark = this.damageTaken;
  }

  private updateBacking(match: Match, dt: number): void {
    // Taking any damage during the channel interrupts the recall.
    if (this.damageTaken > this.backChannelDamageMark) {
      this.state = "retreating";
      this.backTimer = 0;
      return;
    }

    this.backTimer -= dt;
    if (this.backTimer <= 0) {
      const spawn = match.getBasePosition(this.side);
      this.pos.x = spawn.x;
      this.pos.y = spawn.y;
      this.currentHp = this.maxHp;
      this.pathIndex = 0;
      this.nextBackGold = this.statsLine.gold + 1500;
      this.state = "movingToLane";
    }
  }

  /** Moves into range of a target and attacks it (ability if ready, else auto). */
  engage(target: Entity, ctx: MatchContext, dt: number): void {
    this.target = target;
    const distance = this.distanceTo(target);
    const desiredRange = Math.max(42, this.stats.range - 8);

    if (distance > desiredRange) {
      this.moveTowards(target.pos, dt);
      return;
    }

    const readyAbility = getReadyAbility(this.template.abilities, this.cooldowns, distance, this.stats.range + 18);
    if (readyAbility) {
      const defenderStats = ctx.getDefensiveStats(target);
      const damage = calculateAbilityDamage(readyAbility, this.stats, defenderStats);
      this.cooldowns[readyAbility.id] = readyAbility.cooldown;
      ctx.applyDamage(this, target, damage, readyAbility.damageType, readyAbility.name);
      return;
    }

    if (this.attackTimer <= 0) {
      const defenderStats = ctx.getDefensiveStats(target);
      const damage = calculateTypedDamage(this.stats.ad, "physical", defenderStats);
      this.attackTimer = calculateAttackPeriod(this.stats.as);
      ctx.applyDamage(this, target, damage, "physical", "Auto");
    }
  }

  followPath(path: Point[], dt: number): void {
    if (path.length === 0) {
      return;
    }

    this.pathIndex = this.moveAlongPath(path, this.pathIndex, dt);
  }
}
