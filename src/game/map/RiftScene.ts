import * as THREE from "three";
import type { AssetManager, NatureManifest } from "../../gltf/AssetManager.js";
import {
  HEX_GRASS_TILE,
  JUNGLE_CAMP_RING_PROPS,
  LANE_PATH_TILES,
  MEDIEVAL_NATURE_FALLBACK,
  OBJECTIVE_MARKER_PROPS
} from "../../gltf/AssetCatalog.js";
import { JUNGLE_BLOB_CENTERS, JUNGLE_CAMPS, OBJECTIVE_POSITIONS, getLanePath } from "../../data/MapData.js";
import { debugLog } from "../../core/DebugLog.js";
import {
  fitHexTileOnGround,
  fitLanePathTile,
  fitModelToFootprint,
  getHorizontalFootprint,
  snapObjectToGround
} from "../../gltf/ModelUtils.js";
import type { LaneId, Point } from "../../data/models.js";
import { logicToWorld, WORLD_MAP_CENTER_X, WORLD_MAP_CENTER_Z, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from "../../core/CoordinateMap.js";

const TREE_WIDTH = 1.35;
/** Flat hex pads — must stay lower than towers (TOWER_SIZE ≈ 2.2 world units). */
const HEX_TILE_WIDTH = 0.36;
const HEX_TILE_MAX_HEIGHT = 0.12;
const LANE_TILE_WIDTH = 0.4;
const LANE_TILE_MAX_HEIGHT = 0.16;
const LANE_TILE_SPACING_LOGIC = 38;
const LANE_TILE_LIFT = 0.07;

const CAMP_RING_OFFSETS: Point[] = [
  { x: 52, y: 0 },
  { x: -44, y: 38 },
  { x: -40, y: -42 },
  { x: 48, y: -36 }
];

async function addHexTileGround(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  const template = await assets.loadProp(HEX_GRASS_TILE);
  fitHexTileOnGround(template, HEX_TILE_WIDTH, HEX_TILE_MAX_HEIGHT);

  const footprint = getHorizontalFootprint(template);
  const spacingX = footprint.x * 0.86;
  const spacingZ = footprint.z * 0.75;
  const cols = Math.ceil(WORLD_MAP_WIDTH / spacingX) + 3;
  const rows = Math.ceil(WORLD_MAP_HEIGHT / spacingZ) + 3;
  const originX = WORLD_MAP_CENTER_X - (cols * spacingX) / 2;
  const originZ = WORLD_MAP_CENTER_Z - (rows * spacingZ) / 2;

  const ground = new THREE.Group();
  ground.name = "hex-ground";

  for (let row = 0; row < rows; row += 1) {
    const stagger = (row & 1) === 1 ? spacingX * 0.5 : 0;
    for (let col = 0; col < cols; col += 1) {
      const tile = template.clone(true);
      tile.position.set(originX + col * spacingX + stagger, 0, originZ + row * spacingZ);
      snapObjectToGround(tile);
      ground.add(tile);
    }
  }

  scene.add(ground);
  debugLog("RiftScene", "hex ground placed", { cols, rows, tiles: cols * rows, tileHeight: HEX_TILE_MAX_HEIGHT });
}

function addRiverOverlay(scene: THREE.Scene): void {
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_MAP_WIDTH * 0.12, WORLD_MAP_HEIGHT * 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x3a8fc4,
      transparent: true,
      opacity: 0.35,
      roughness: 0.25,
      depthWrite: false
    })
  );
  river.rotation.x = -Math.PI / 2;
  river.rotation.z = Math.PI / 4;
  river.position.set(WORLD_MAP_CENTER_X, 0.015, WORLD_MAP_CENTER_Z);
  scene.add(river);
}

function addCampFloorMarker(scene: THREE.Scene, point: Point, side: "blue" | "red"): void {
  const world = logicToWorld(point, 0.01);
  const color = side === "blue" ? 0x3d6f9a : 0x9a4a42;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, roughness: 0.9, depthWrite: false })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(world.x, world.y, world.z);
  scene.add(pad);
}

async function addJungleCampStructures(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  for (const camp of JUNGLE_CAMPS) {
    addCampFloorMarker(scene, camp, camp.side);

    for (let index = 0; index < CAMP_RING_OFFSETS.length; index += 1) {
      const offset = CAMP_RING_OFFSETS[index]!;
      const ringProp = JUNGLE_CAMP_RING_PROPS[index % JUNGLE_CAMP_RING_PROPS.length]!;
      await placeProp(
        scene,
        assets,
        ringProp,
        { x: camp.x + offset.x, y: camp.y + offset.y },
        0.42,
        (index / CAMP_RING_OFFSETS.length) * Math.PI * 2
      );
    }
  }
}

async function addObjectiveMarkers(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  await placeProp(scene, assets, OBJECTIVE_MARKER_PROPS.dragon, OBJECTIVE_POSITIONS.dragon, 1.15, 0.4);
  await placeProp(scene, assets, OBJECTIVE_MARKER_PROPS.baron, OBJECTIVE_POSITIONS.baron, 1.25, 2.1);
}

export async function buildRiftScene(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  debugLog("RiftScene", "build start");
  await addHexTileGround(scene, assets);
  await addLaneHexPaths(scene, assets);
  addRiverOverlay(scene);

  const nature = await assets.getNatureManifest();
  const treePaths = pickNaturePaths(nature);

  for (const side of ["blue", "red"] as const) {
    for (const center of JUNGLE_BLOB_CENTERS[side]) {
      await placeProp(scene, assets, pickFrom(treePaths, center.x + center.y), center, TREE_WIDTH * 1.3, 0);
    }
  }

  await addJungleCampStructures(scene, assets);
  await addObjectiveMarkers(scene, assets);

  for (const point of buildScatterPoints()) {
    await placeProp(scene, assets, pickFrom(treePaths, point.x + point.y), point, point.scale * TREE_WIDTH, point.rotation);
  }

  debugLog("RiftScene", "build complete", { children: scene.children.length });
}

function pickNaturePaths(manifest: NatureManifest): string[] {
  if (manifest.available && manifest.trees.length > 0) {
    return manifest.trees;
  }
  return [...MEDIEVAL_NATURE_FALLBACK.trees];
}

function pickFrom(paths: string[], seed: number): string {
  return paths[Math.abs(Math.floor(seed)) % paths.length] ?? paths[0] ?? MEDIEVAL_NATURE_FALLBACK.trees[0];
}

function samplePathPoints(path: Point[], spacing: number): Point[] {
  if (path.length === 0) {
    return [];
  }
  if (path.length === 1) {
    return [{ x: path[0]!.x, y: path[0]!.y }];
  }

  const segments: Array<{ start: Point; end: Point; length: number }> = [];
  let totalLength = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1] as Point;
    const end = path[index] as Point;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  const samples: Point[] = [];
  for (let distance = 0; distance <= totalLength; distance += spacing) {
    let remaining = distance;
    for (const segment of segments) {
      if (remaining <= segment.length) {
        const t = segment.length === 0 ? 0 : remaining / segment.length;
        samples.push({
          x: segment.start.x + (segment.end.x - segment.start.x) * t,
          y: segment.start.y + (segment.end.y - segment.start.y) * t
        });
        break;
      }
      remaining -= segment.length;
    }
  }

  const pathEnd = path[path.length - 1] as Point;
  const tail = samples[samples.length - 1];
  if (!tail || tail.x !== pathEnd.x || tail.y !== pathEnd.y) {
    samples.push({ x: pathEnd.x, y: pathEnd.y });
  }

  return samples;
}

async function addLaneHexPaths(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  const lanes = new THREE.Group();
  lanes.name = "lane-paths";

  for (const lane of ["top", "mid", "bot"] as LaneId[]) {
    const template = await assets.loadProp(LANE_PATH_TILES[lane]);
    fitLanePathTile(template, LANE_TILE_WIDTH, LANE_TILE_MAX_HEIGHT);

    const points = samplePathPoints(getLanePath(lane, "blue"), LANE_TILE_SPACING_LOGIC);
    for (const point of points) {
      const tile = template.clone(true);
      const world = logicToWorld(point, LANE_TILE_LIFT);
      tile.position.set(world.x, world.y, world.z);
      snapObjectToGround(tile);
      lanes.add(tile);
    }
  }

  scene.add(lanes);
  debugLog("RiftScene", "lane hex paths placed", { children: lanes.children.length });
}

async function placeProp(
  scene: THREE.Scene,
  assets: AssetManager,
  modelPath: string,
  point: Point,
  width: number,
  rotation: number
): Promise<void> {
  try {
    const model = await assets.loadProp(modelPath);
    fitModelToFootprint(model, width);
    const world = logicToWorld(point);
    model.position.set(world.x, 0, world.z);
    model.rotation.y = rotation;
    snapObjectToGround(model);
    scene.add(model);
  } catch (error) {
    console.warn(`[IdleRifts][RiftScene] Failed to place prop ${modelPath}`, error);
  }
}

function buildScatterPoints(): Array<Point & { scale: number; rotation: number }> {
  const seeds = [
    { x: 280, y: 420, scale: 1.4, rotation: 0.2 },
    { x: 520, y: 240, scale: 1.5, rotation: 1.1 },
    { x: 1480, y: 380, scale: 1.45, rotation: 2.2 },
    { x: 1640, y: 620, scale: 1.55, rotation: 0.8 },
    { x: 420, y: 1480, scale: 1.5, rotation: 1.6 },
    { x: 1560, y: 1520, scale: 1.48, rotation: 2.7 },
    { x: 960, y: 280, scale: 1.25, rotation: 0.5 },
    { x: 960, y: 1640, scale: 1.3, rotation: 1.9 }
  ];

  const points: Array<Point & { scale: number; rotation: number }> = [];
  for (const seed of seeds) {
    points.push(seed);
    points.push({ x: seed.x + 80, y: seed.y - 50, scale: seed.scale * 0.9, rotation: seed.rotation + 0.5 });
  }
  return points;
}
