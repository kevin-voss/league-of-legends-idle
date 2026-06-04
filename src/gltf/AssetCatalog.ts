import type { Role, StructureType, TeamSide } from "../data/models.js";

const KAYKIT = "/game-assets/KayKit_Adventurers_2.0_FREE";
const KAYKIT_SKELETONS = "/game-assets/KayKit_Skeletons_1.1_FREE";
export const MEDIEVAL = "/game-assets/KayKit_Medieval_Hexagon_Pack_1.0_FREE";

export const KAYKIT_ATLAS = `${MEDIEVAL}/Assets/fbx/tiles/base/hexagons_medieval.png`;
export const HEX_GRASS_TILE = `${MEDIEVAL}/Assets/fbx/tiles/base/hex_grass.fbx`;
export const HEX_WATER_TILE = `${MEDIEVAL}/Assets/fbx/tiles/base/hex_water.fbx`;

/** Straight / fill tiles along the rift river (see RIVER_PATH in MapData). */
export const RIVER_STRAIGHT_TILES = [
  HEX_WATER_TILE,
  `${MEDIEVAL}/Assets/fbx/tiles/rivers/hex_river_A.fbx`,
  `${MEDIEVAL}/Assets/fbx/tiles/rivers/hex_river_B.fbx`,
  `${MEDIEVAL}/Assets/fbx/tiles/rivers/hex_river_C.fbx`
] as const;

export const RIVER_CORNER_TILE = `${MEDIEVAL}/Assets/fbx/tiles/rivers/hex_river_crossing_A.fbx`;

/** Flat/contrasting KayKit hex tiles per lane (sloped tiles read as invisible next to grass). */
export const LANE_PATH_TILES: Record<"top" | "mid" | "bot", string> = {
  top: `${MEDIEVAL}/Assets/fbx/tiles/base/hex_grass_bottom.fbx`,
  mid: `${MEDIEVAL}/Assets/fbx/tiles/rivers/hex_river_A.fbx`,
  bot: `${MEDIEVAL}/Assets/fbx/tiles/coast/waterless/hex_coast_E_waterless.fbx`
};

const ADVENTURER_CHAR = `${KAYKIT}/Characters/gltf`;
const SKELETON_CHAR = `${KAYKIT_SKELETONS}/characters/gltf`;

export const ANIM_MOVEMENT = `${KAYKIT}/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`;
export const ANIM_GENERAL = `${KAYKIT}/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`;
export const SKELETON_ANIM_MOVEMENT = `${KAYKIT_SKELETONS}/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`;
export const SKELETON_ANIM_GENERAL = `${KAYKIT_SKELETONS}/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`;

/** Default KayKit adventurer per lane role (fallback when template has no explicit mapping). */
export const ROLE_CHARACTER_MODEL: Record<Role, string> = {
  top: `${ADVENTURER_CHAR}/Knight.glb`,
  jungle: `${ADVENTURER_CHAR}/Rogue.glb`,
  mid: `${ADVENTURER_CHAR}/Mage.glb`,
  adc: `${ADVENTURER_CHAR}/Ranger.glb`,
  support: `${ADVENTURER_CHAR}/Rogue_Hooded.glb`
};

/** Distinct adventurer mesh per champion template (10 heroes × 6 body types). */
export const CHAMPION_TEMPLATE_MODEL: Record<string, string> = {
  "bramble-vanguard": `${ADVENTURER_CHAR}/Knight.glb`,
  "sunforged-duelist": `${ADVENTURER_CHAR}/Barbarian.glb`,
  "citadel-breaker": `${ADVENTURER_CHAR}/Knight.glb`,
  "river-runner": `${ADVENTURER_CHAR}/Rogue.glb`,
  "mossback-sentinel": `${ADVENTURER_CHAR}/Barbarian.glb`,
  "stormpath-reaver": `${ADVENTURER_CHAR}/Rogue.glb`,
  "ember-scribe": `${ADVENTURER_CHAR}/Mage.glb`,
  "glass-oracle": `${ADVENTURER_CHAR}/Mage.glb`,
  "night-market-mage": `${ADVENTURER_CHAR}/Rogue_Hooded.glb`,
  "bolt-fletcher": `${ADVENTURER_CHAR}/Ranger.glb`,
  "kestrel-gunner": `${ADVENTURER_CHAR}/Ranger.glb`,
  "starforged-cannon": `${ADVENTURER_CHAR}/Barbarian.glb`,
  "aurora-warden": `${ADVENTURER_CHAR}/Rogue_Hooded.glb`,
  "iron-bell": `${ADVENTURER_CHAR}/Mage.glb`,
  "seraphic-anchor": `${ADVENTURER_CHAR}/Knight.glb`
};

/** KayKit Skeletons — lane minions use the small minion rig for every wave unit. */
export const MINION_MELEE_MODEL = `${SKELETON_CHAR}/Skeleton_Minion.glb`;
export const MINION_CASTER_MODEL = `${SKELETON_CHAR}/Skeleton_Minion.glb`;
export const MONSTER_DRAGON_MODEL = `${SKELETON_CHAR}/Skeleton_Mage.glb`;
export const MONSTER_BARON_MODEL = `${SKELETON_CHAR}/Skeleton_Warrior.glb`;

/** Jungle camp id → skeleton variant (small camps use Minion/Rogue, buffs use Warrior/Mage). */
export const JUNGLE_CAMP_MODEL: Record<string, string> = {
  "blue-top-wolves": `${SKELETON_CHAR}/Skeleton_Rogue.glb`,
  "blue-top-gromp": `${SKELETON_CHAR}/Skeleton_Warrior.glb`,
  "blue-bot-raptors": `${SKELETON_CHAR}/Skeleton_Minion.glb`,
  "blue-bot-krugs": `${SKELETON_CHAR}/Skeleton_Mage.glb`,
  "red-top-wolves": `${SKELETON_CHAR}/Skeleton_Rogue.glb`,
  "red-top-gromp": `${SKELETON_CHAR}/Skeleton_Warrior.glb`,
  "red-bot-raptors": `${SKELETON_CHAR}/Skeleton_Minion.glb`,
  "red-bot-krugs": `${SKELETON_CHAR}/Skeleton_Mage.glb`
};

export function getChampionModelPath(templateId: string, role: Role): string {
  return CHAMPION_TEMPLATE_MODEL[templateId] ?? ROLE_CHARACTER_MODEL[role];
}

export function getMinionModelPath(minionType: "melee" | "caster"): string {
  return minionType === "melee" ? MINION_MELEE_MODEL : MINION_CASTER_MODEL;
}

export function getJungleCampModelPath(campId: string): string {
  return JUNGLE_CAMP_MODEL[campId] ?? `${SKELETON_CHAR}/Skeleton_Warrior.glb`;
}

export function getRigAnimationPaths(modelPath: string): { movement: string; general: string } {
  if (modelPath.includes("KayKit_Skeletons")) {
    return { movement: SKELETON_ANIM_MOVEMENT, general: SKELETON_ANIM_GENERAL };
  }
  return { movement: ANIM_MOVEMENT, general: ANIM_GENERAL };
}

export function getAllSkinnedEntityModelPaths(): string[] {
  const paths = new Set<string>([
    ...Object.values(ROLE_CHARACTER_MODEL),
    ...Object.values(CHAMPION_TEMPLATE_MODEL),
    MINION_MELEE_MODEL,
    MINION_CASTER_MODEL,
    MONSTER_DRAGON_MODEL,
    MONSTER_BARON_MODEL,
    ...Object.values(JUNGLE_CAMP_MODEL)
  ]);
  return [...paths];
}

const MEDIEVAL_PROP = `${MEDIEVAL}/Assets/fbx/decoration/props`;
const MEDIEVAL_NATURE = `${MEDIEVAL}/Assets/fbx/decoration/nature`;

/** Static decor at each jungle camp (stone pile + ring rocks). */
export const JUNGLE_CAMP_CENTER_PROP: Record<string, string> = {
  "blue-top-wolves": `${MEDIEVAL_PROP}/resource_stone.fbx`,
  "blue-top-gromp": `${MEDIEVAL_NATURE}/hill_single_B.fbx`,
  "blue-bot-raptors": `${MEDIEVAL_PROP}/crate_A_small.fbx`,
  "blue-bot-krugs": `${MEDIEVAL_PROP}/resource_stone.fbx`,
  "red-top-wolves": `${MEDIEVAL_PROP}/resource_stone.fbx`,
  "red-top-gromp": `${MEDIEVAL_NATURE}/hill_single_B.fbx`,
  "red-bot-raptors": `${MEDIEVAL_PROP}/crate_A_small.fbx`,
  "red-bot-krugs": `${MEDIEVAL_PROP}/resource_stone.fbx`
};

export const JUNGLE_CAMP_RING_PROPS = [
  `${MEDIEVAL_NATURE}/hill_single_A.fbx`,
  `${MEDIEVAL_NATURE}/hill_single_C.fbx`,
  `${MEDIEVAL_PROP}/barrel.fbx`,
  `${MEDIEVAL_PROP}/crate_B_small.fbx`
] as const;

/** Raised platform under each major objective landmark. */
export const OBJECTIVE_BASE_PROPS = {
  dragon: `${MEDIEVAL_NATURE}/hills_B.fbx`,
  baron: `${MEDIEVAL_NATURE}/hills_C.fbx`
} as const;

/** Large landmark meshes at dragon / baron pits (trees variant reads clearly on the rift). */
export const OBJECTIVE_MARKER_PROPS = {
  dragon: `${MEDIEVAL_NATURE}/mountain_A_grass_trees.fbx`,
  baron: `${MEDIEVAL_NATURE}/mountain_C_grass_trees.fbx`
} as const;

/** Rock ring around each major objective pit. */
export const OBJECTIVE_RING_PROPS = [
  `${MEDIEVAL_NATURE}/rock_single_A.fbx`,
  `${MEDIEVAL_NATURE}/rock_single_B.fbx`,
  `${MEDIEVAL_NATURE}/rock_single_C.fbx`,
  `${MEDIEVAL_NATURE}/rock_single_D.fbx`
] as const;

export function getJungleCampCenterProp(campId: string): string {
  return JUNGLE_CAMP_CENTER_PROP[campId] ?? `${MEDIEVAL_PROP}/resource_stone.fbx`;
}

export const MEDIEVAL_NATURE_FALLBACK = {
  trees: [
    `${MEDIEVAL}/Assets/fbx/decoration/nature/tree_single_A.fbx`,
    `${MEDIEVAL}/Assets/fbx/decoration/nature/tree_single_B.fbx`,
    `${MEDIEVAL}/Assets/fbx/decoration/nature/trees_A_small.fbx`,
    `${MEDIEVAL}/Assets/fbx/decoration/nature/trees_B_medium.fbx`,
    `${MEDIEVAL}/Assets/fbx/decoration/nature/trees_A_large.fbx`
  ]
} as const;

const MEDIEVAL_SIDE: Record<TeamSide, string> = {
  blue: "blue",
  red: "red"
};

export function kaykitAtlasFor(modelPath: string): string {
  const index = modelPath.lastIndexOf("/");
  return index >= 0 ? `${modelPath.slice(0, index + 1)}hexagons_medieval.png` : KAYKIT_ATLAS;
}

export function getTowerModelPath(side: TeamSide, tier: 1 | 2): string {
  const color = MEDIEVAL_SIDE[side];
  const variant = tier === 1 ? "A" : "B";
  return `${MEDIEVAL}/Assets/fbx/buildings/${color}/building_tower_${variant}_${color}.fbx`;
}

export function getNexusModelPath(side: TeamSide): string {
  const color = MEDIEVAL_SIDE[side];
  return `${MEDIEVAL}/Assets/fbx/buildings/${color}/building_castle_${color}.fbx`;
}

export function getStructureModelPath(side: TeamSide, type: StructureType, tier: 1 | 2 | null): string {
  if (type === "nexus") {
    return getNexusModelPath(side);
  }
  return getTowerModelPath(side, tier === 2 ? 2 : 1);
}

export function getAllStructureModelPaths(): string[] {
  const sides: TeamSide[] = ["blue", "red"];
  const paths = new Set<string>();
  for (const side of sides) {
    paths.add(getTowerModelPath(side, 1));
    paths.add(getTowerModelPath(side, 2));
    paths.add(getNexusModelPath(side));
  }
  return [...paths];
}
