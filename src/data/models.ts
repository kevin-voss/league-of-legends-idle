export type Role = "top" | "jungle" | "mid" | "adc" | "support";
export type LaneId = "top" | "mid" | "bot";
export type Tier = "D" | "C" | "B" | "A" | "S" | "S+";
export type TeamSide = "blue" | "red";
export type EntitySide = TeamSide | "neutral";
export type DamageType = "physical" | "magic" | "true";
export type StructureType = "tower" | "nexus";
export type StructureTier = 1 | 2;
export type RotationIntent = "push" | "defend";
export type ChampionAIState =
  | "spawning"
  | "movingToLane"
  | "farming"
  | "fighting"
  | "backing"
  | "movingToObjective"
  | "movingToGank"
  | "retreating"
  | "sieging"
  | "rotating"
  | "dead";

export interface ChampionStats {
  hp: number;
  ad: number;
  ap: number;
  armor: number;
  mr: number;
  as: number;
  ms: number;
  range: number;
}

export interface Ability {
  id: string;
  name: string;
  cooldown: number;
  range: number;
  baseDamage: number;
  adRatio: number;
  apRatio: number;
  damageType: DamageType;
}

export interface ChampionTemplate {
  id: string;
  name: string;
  role: Role;
  tier: Tier;
  baseStats: ChampionStats;
  abilities: Ability[];
}

export interface StructureDefinition {
  id: string;
  type: StructureType;
  side: TeamSide;
  pos: Point;
  lane: LaneId | null;
  tier: StructureTier | null;
  hp: number;
  ad: number;
  armor: number;
  mr: number;
  attackSpeed: number;
  attackRange: number;
}

export interface OwnedChampion {
  uid: string;
  templateId: string;
  level: number;
  experience: number;
}

export interface AccountState {
  level: number;
  experience: number;
  gold: number;
  ownedChampions: OwnedChampion[];
  selectedTeam: string[];
  favoriteChampionUids: string[];
  lockedChampionUids: string[];
  pityCounters: Record<Tier, number>;
}

export interface ChampionSelection {
  owned: OwnedChampion;
  template: ChampionTemplate;
}

export interface MatchChampionStats {
  uid: string;
  name: string;
  role: Role;
  side: TeamSide;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  creepScore: number;
  damageDealt: number;
  gold: number;
}

export interface StatBuff {
  id: string;
  bonus: number;
  remaining: number;
}

export interface MatchResult {
  winner: TeamSide;
  durationSeconds: number;
  playerWon: boolean;
  goldEarned: number;
  accountXpEarned: number;
  championXpEarned: number;
  blueBaseHp: number;
  redBaseHp: number;
  dragonKills: Record<TeamSide, number>;
  baronKills: Record<TeamSide, number>;
  championStats: MatchChampionStats[];
}

export interface RewardResult {
  goldEarned: number;
  accountXpEarned: number;
  championXpEarned: number;
  accountLeveled: boolean;
  droppedChampion: OwnedChampion | null;
  droppedTemplate: ChampionTemplate | null;
}

export interface Point {
  x: number;
  y: number;
}
