                                              

export const GAME_TITLE = "Idle Rifts";
export const STORAGE_KEY = "idle-rifts-account-v1";

/** Square logic plane so isometric lanes and corners stay symmetric. */
export const MAP_SIZE = 1920;
export const CANVAS_WIDTH = MAP_SIZE;
export const CANVAS_HEIGHT = MAP_SIZE;

export const TICK_RATE = 1000 / 30;
export const FIXED_DT_SECONDS = TICK_RATE / 1000;
export const MATCH_MIN_SECONDS = 135;
export const MATCH_MAX_SECONDS = 270;
export const WAVE_INTERVAL_SECONDS = 30;
export const BACK_CHANNEL_SECONDS = 3;

export const BASE_MAX_HP = 5200;
export const DRAGON_SPAWN_SECONDS = 55;
export const BARON_SPAWN_SECONDS = 140;
export const DRAGON_RESPAWN_SECONDS = 65;
export const BARON_RESPAWN_SECONDS = 95;

export const SPEED_OPTIONS = [1, 3, 5]         ;
                                                     

// In-match champion progression (levels 1-18, separate from account level).
export const MATCH_LEVEL_CAP = 18;
export const MATCH_LEVEL_STAT_GROWTH = 0.04; // +4% to combat stats per level

// Experience awards.
export const XP_PER_MINION = 26;
export const XP_PER_CAMP = 78;
export const XP_PER_CHAMPION_KILL = 130;
export const XP_PER_ASSIST = 58;
export const XP_PER_DRAGON = 120;
export const XP_PER_BARON = 185;
export const XP_SHARE_RADIUS = 340;

// Stat buffs (fractional bonuses applied to all combat stats).
export const KILL_BUFF_BONUS = 0.25;
export const KILL_BUFF_DURATION = 30;
export const DRAGON_BUFF_BONUS = 0.08; // stacks permanently per dragon for the team
export const BARON_BUFF_BONUS = 0.18;
export const BARON_BUFF_DURATION = 45;

// Level a jungler must reach before it will contest neutral objectives.
export const DRAGON_LEVEL_REQUIREMENT = 4;
export const BARON_LEVEL_REQUIREMENT = 8;

// XP needed to advance from the given level to the next one.
export function matchLevelXpRequirement(level        )         {
  return 80 + Math.max(0, level - 1) * 36;
}

export const ROLES         = ["top", "jungle", "mid", "adc", "support"];

export const ROLE_LABELS                       = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Bot (ADC)",
  support: "Bot (Support)"
};

export const ROLE_TO_LANE                                      = {
  top: "top",
  jungle: "mid",
  mid: "mid",
  adc: "bot",
  support: "bot"
};

export const TIER_ORDER         = ["D", "C", "B", "A", "S", "S+"];

export const TIER_UNLOCK_LEVEL                       = {
  D: 1,
  C: 10,
  B: 20,
  A: 30,
  S: 40,
  "S+": 50
};

export const DROP_RATES                       = {
  D: 1,
  C: 0.72,
  B: 0.48,
  A: 0.24,
  S: 0.1,
  "S+": 0.02
};

export const PITY_LIMITS                                = {
  A: 8,
  S: 10,
  "S+": 10
};

export const TIER_COLOR                       = {
  D: "#cfd4c6",
  C: "#7edb8c",
  B: "#78b7ff",
  A: "#d899ff",
  S: "#ffcf66",
  "S+": "#ff7a7a"
};

export const STARTING_TEMPLATE_IDS = [
  "bramble-vanguard",
  "river-runner",
  "ember-scribe",
  "bolt-fletcher",
  "aurora-warden"
];

export const ACCOUNT_XP_PER_LEVEL = 120;
