import { TIER_ORDER } from "./Constants.js";
import type { ChampionStats, ChampionTemplate, Role, Tier, OwnedChampion } from "./models.js";

const tierMultiplier: Record<Tier, number> = {
  D: 1,
  C: 1.08,
  B: 1.17,
  A: 1.29,
  S: 1.43,
  "S+": 1.62
};

function stats(base: ChampionStats, tier: Tier): ChampionStats {
  const multiplier = tierMultiplier[tier];
  return {
    hp: Math.round(base.hp * multiplier),
    ad: Math.round(base.ad * multiplier),
    ap: Math.round(base.ap * multiplier),
    armor: Math.round(base.armor * multiplier),
    mr: Math.round(base.mr * multiplier),
    as: Number((base.as * (1 + (multiplier - 1) * 0.25)).toFixed(2)),
    ms: base.ms,
    range: base.range
  };
}

export const CHAMPIONS: ChampionTemplate[] = [
  {
    id: "bramble-vanguard",
    name: "Bramble Vanguard",
    role: "top",
    tier: "D",
    baseStats: stats({ hp: 850, ad: 58, ap: 10, armor: 42, mr: 34, as: 0.66, ms: 95, range: 54 }, "D"),
    abilities: [{ id: "root-slam", name: "Root Slam", cooldown: 7, range: 72, baseDamage: 70, adRatio: 0.65, apRatio: 0, damageType: "physical" }]
  },
  {
    id: "river-runner",
    name: "River Runner",
    role: "jungle",
    tier: "D",
    baseStats: stats({ hp: 760, ad: 64, ap: 20, armor: 38, mr: 32, as: 0.72, ms: 112, range: 58 }, "D"),
    abilities: [{ id: "crosscut", name: "Crosscut", cooldown: 6, range: 62, baseDamage: 62, adRatio: 0.8, apRatio: 0, damageType: "physical" }]
  },
  {
    id: "ember-scribe",
    name: "Ember Scribe",
    role: "mid",
    tier: "D",
    baseStats: stats({ hp: 620, ad: 44, ap: 72, armor: 26, mr: 38, as: 0.62, ms: 92, range: 165 }, "D"),
    abilities: [{ id: "ember-line", name: "Ember Line", cooldown: 5.5, range: 210, baseDamage: 74, adRatio: 0, apRatio: 0.75, damageType: "magic" }]
  },
  {
    id: "bolt-fletcher",
    name: "Bolt Fletcher",
    role: "adc",
    tier: "D",
    baseStats: stats({ hp: 610, ad: 66, ap: 8, armor: 24, mr: 30, as: 0.78, ms: 93, range: 205 }, "D"),
    abilities: [{ id: "piercing-bolt", name: "Piercing Bolt", cooldown: 8, range: 230, baseDamage: 58, adRatio: 0.95, apRatio: 0, damageType: "physical" }]
  },
  {
    id: "aurora-warden",
    name: "Aurora Warden",
    role: "support",
    tier: "A",
    baseStats: stats({ hp: 700, ad: 42, ap: 68, armor: 34, mr: 42, as: 0.62, ms: 99, range: 155 }, "A"),
    abilities: [{ id: "wardens-flare", name: "Warden's Flare", cooldown: 6.5, range: 190, baseDamage: 66, adRatio: 0, apRatio: 0.55, damageType: "magic" }]
  },
  {
    id: "iron-bell",
    name: "Iron Bell",
    role: "support",
    tier: "D",
    baseStats: stats({ hp: 720, ad: 38, ap: 48, armor: 38, mr: 42, as: 0.58, ms: 94, range: 135 }, "D"),
    abilities: [{ id: "bell-strike", name: "Bell Strike", cooldown: 7, range: 145, baseDamage: 52, adRatio: 0.25, apRatio: 0.5, damageType: "magic" }]
  },
  {
    id: "sunforged-duelist",
    name: "Sunforged Duelist",
    role: "top",
    tier: "C",
    baseStats: stats({ hp: 880, ad: 63, ap: 14, armor: 44, mr: 34, as: 0.69, ms: 97, range: 58 }, "C"),
    abilities: [{ id: "solar-riposte", name: "Solar Riposte", cooldown: 6, range: 68, baseDamage: 76, adRatio: 0.75, apRatio: 0.15, damageType: "physical" }]
  },
  {
    id: "mossback-sentinel",
    name: "Mossback Sentinel",
    role: "jungle",
    tier: "C",
    baseStats: stats({ hp: 820, ad: 59, ap: 34, armor: 42, mr: 36, as: 0.68, ms: 106, range: 60 }, "C"),
    abilities: [{ id: "thorn-pulse", name: "Thorn Pulse", cooldown: 6.5, range: 88, baseDamage: 65, adRatio: 0.55, apRatio: 0.35, damageType: "magic" }]
  },
  {
    id: "glass-oracle",
    name: "Glass Oracle",
    role: "mid",
    tier: "B",
    baseStats: stats({ hp: 640, ad: 42, ap: 86, armor: 25, mr: 40, as: 0.61, ms: 94, range: 185 }, "B"),
    abilities: [{ id: "prism-burst", name: "Prism Burst", cooldown: 5.2, range: 230, baseDamage: 88, adRatio: 0, apRatio: 0.82, damageType: "magic" }]
  },
  {
    id: "kestrel-gunner",
    name: "Kestrel Gunner",
    role: "adc",
    tier: "B",
    baseStats: stats({ hp: 630, ad: 70, ap: 12, armor: 26, mr: 31, as: 0.81, ms: 95, range: 215 }, "B"),
    abilities: [{ id: "talon-shot", name: "Talon Shot", cooldown: 7.4, range: 245, baseDamage: 62, adRatio: 1.02, apRatio: 0, damageType: "physical" }]
  },
  {
    id: "night-market-mage",
    name: "Night Market Mage",
    role: "mid",
    tier: "A",
    baseStats: stats({ hp: 660, ad: 43, ap: 96, armor: 27, mr: 43, as: 0.63, ms: 96, range: 190 }, "A"),
    abilities: [{ id: "blackfire-bargain", name: "Blackfire Bargain", cooldown: 5, range: 245, baseDamage: 96, adRatio: 0, apRatio: 0.88, damageType: "magic" }]
  },
  {
    id: "citadel-breaker",
    name: "Citadel Breaker",
    role: "top",
    tier: "S",
    baseStats: stats({ hp: 960, ad: 72, ap: 20, armor: 48, mr: 38, as: 0.7, ms: 98, range: 60 }, "S"),
    abilities: [{ id: "wallfall", name: "Wallfall", cooldown: 6.2, range: 75, baseDamage: 92, adRatio: 0.86, apRatio: 0, damageType: "physical" }]
  },
  {
    id: "stormpath-reaver",
    name: "Stormpath Reaver",
    role: "jungle",
    tier: "S",
    baseStats: stats({ hp: 850, ad: 76, ap: 42, armor: 43, mr: 37, as: 0.75, ms: 116, range: 62 }, "S"),
    abilities: [{ id: "stormpath", name: "Stormpath", cooldown: 5.8, range: 95, baseDamage: 84, adRatio: 0.8, apRatio: 0.3, damageType: "physical" }]
  },
  {
    id: "starforged-cannon",
    name: "Starforged Cannon",
    role: "adc",
    tier: "S+",
    baseStats: stats({ hp: 660, ad: 82, ap: 22, armor: 28, mr: 34, as: 0.86, ms: 98, range: 235 }, "S+"),
    abilities: [{ id: "comet-round", name: "Comet Round", cooldown: 6.8, range: 270, baseDamage: 88, adRatio: 1.1, apRatio: 0.15, damageType: "physical" }]
  },
  {
    id: "seraphic-anchor",
    name: "Seraphic Anchor",
    role: "support",
    tier: "S+",
    baseStats: stats({ hp: 760, ad: 46, ap: 90, armor: 39, mr: 50, as: 0.64, ms: 102, range: 175 }, "S+"),
    abilities: [{ id: "anchor-star", name: "Anchor Star", cooldown: 6.1, range: 215, baseDamage: 82, adRatio: 0.15, apRatio: 0.7, damageType: "magic" }]
  }
];

export function getChampionTemplate(templateId: string): ChampionTemplate {
  const template = CHAMPIONS.find((champion) => champion.id === templateId);
  if (!template) {
    throw new Error(`Unknown champion template: ${templateId}`);
  }
  return template;
}

export function getTemplatesByRole(role: Role): ChampionTemplate[] {
  return CHAMPIONS.filter((champion) => champion.role === role);
}

export function getTemplatesByTier(tier: Tier): ChampionTemplate[] {
  return CHAMPIONS.filter((champion) => champion.tier === tier);
}

export function getHighestUnlockedTier(accountLevel: number): Tier {
  let unlocked: Tier = "D";
  for (const tier of TIER_ORDER) {
    const requiredLevel = tier === "D" ? 1 : tier === "C" ? 10 : tier === "B" ? 20 : tier === "A" ? 30 : tier === "S" ? 40 : 50;
    if (accountLevel >= requiredLevel) {
      unlocked = tier;
    }
  }
  return unlocked;
}

export function getRandomChampionOfTier(tier: Tier, rng: () => number = Math.random): ChampionTemplate {
  const pool = getTemplatesByTier(tier);
  if (pool.length === 0) {
    return CHAMPIONS[0];
  }
  return pool[Math.floor(rng() * pool.length)] ?? pool[0];
}

export function createOwnedChampion(templateId: string, level = 1, uidPrefix = "champ"): OwnedChampion {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return {
    uid: `${uidPrefix}-${templateId}-${Date.now().toString(36)}-${randomPart}`,
    templateId,
    level,
    experience: 0
  };
}
