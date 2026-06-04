import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const assetsRoot = path.join(root, "src", "assets");

async function readCatalogExports() {
  const catalogPath = path.join(root, "dist", "gltf", "AssetCatalog.js");
  return import(catalogPath);
}

function toDiskPath(urlPath) {
  return path.join(assetsRoot, urlPath.replace(/^\/game-assets\//, ""));
}

test("AssetCatalog paths resolve to files under src/assets", async () => {
  const catalog = await readCatalogExports();
  const urls = [
    ...catalog.getAllSkinnedEntityModelPaths(),
    ...catalog.getAllStructureModelPaths(),
    catalog.KAYKIT_ATLAS,
    catalog.HEX_GRASS_TILE,
    catalog.HEX_WATER_TILE,
    ...catalog.RIVER_STRAIGHT_TILES,
    catalog.ANIM_MOVEMENT,
    catalog.ANIM_GENERAL,
    catalog.SKELETON_ANIM_MOVEMENT,
    catalog.SKELETON_ANIM_GENERAL,
    ...catalog.MEDIEVAL_NATURE_FALLBACK.trees,
    ...catalog.JUNGLE_CAMP_RING_PROPS,
    catalog.OBJECTIVE_BASE_PROPS.dragon,
    catalog.OBJECTIVE_BASE_PROPS.baron,
    catalog.OBJECTIVE_MARKER_PROPS.dragon,
    catalog.OBJECTIVE_MARKER_PROPS.baron,
    ...catalog.OBJECTIVE_RING_PROPS,
    ...Object.values(catalog.LANE_PATH_TILES)
  ];

  const missing = [];
  for (const url of urls) {
    const disk = toDiskPath(url);
    try {
      await fs.access(disk);
    } catch {
      missing.push(url);
    }
  }

  assert.equal(missing.length, 0, `Missing assets:\n${missing.join("\n")}`);
});

test("champion and camp model helpers use catalog entries", async () => {
  const catalog = await readCatalogExports();

  assert.ok(catalog.getChampionModelPath("bramble-vanguard", "top").endsWith("Knight.glb"));
  assert.ok(catalog.getMinionModelPath("melee").includes("Skeleton_Minion"));
  assert.ok(catalog.getMinionModelPath("caster").includes("Skeleton_Minion"));
  assert.ok(catalog.getJungleCampModelPath("blue-top-wolves").includes("Skeleton_Rogue"));
  assert.ok(catalog.getJungleCampModelPath("blue-top-wolves").includes("Skeleton_Rogue"));
  assert.ok(catalog.getRigAnimationPaths(catalog.MINION_MELEE_MODEL).movement.includes("Skeletons"));
});
