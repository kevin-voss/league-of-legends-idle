import * as THREE from "three";
import type { AssetManager, NatureManifest } from "../../gltf/AssetManager.js";
import {
  HEX_GRASS_TILE,
  HEX_WATER_TILE,
  getJungleCampCenterProp,
  JUNGLE_CAMP_RING_PROPS,
  LANE_PATH_TILES,
  MEDIEVAL_NATURE_FALLBACK,
  MONSTER_BARON_MODEL,
  MONSTER_DRAGON_MODEL,
  OBJECTIVE_BASE_PROPS,
  OBJECTIVE_MARKER_PROPS,
  OBJECTIVE_RING_PROPS,
  RIVER_STRAIGHT_TILES
} from "../../gltf/AssetCatalog.js";
import { JUNGLE_CAMPS, JUNGLE_QUADRANT_CENTERS, OBJECTIVE_POSITIONS, RIVER_PATH, getLanePath } from "../../data/MapData.js";
import { debugLog } from "../../core/DebugLog.js";
import {
  fitHexTileOnGround,
  fitLanePathTile,
  fitModelToFootprint,
  getHorizontalFootprint,
  snapObjectToGround
} from "../../gltf/ModelUtils.js";
import type { JungleCampDefinition } from "../../data/MapData.js";
import type { LaneId, Point } from "../../data/models.js";
import { logicFacingY, logicToWorld, WORLD_MAP_CENTER_X, WORLD_MAP_CENTER_Z, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from "../../core/CoordinateMap.js";

const TREE_WIDTH = 1.35;
/** Flat hex pads — must stay lower than towers (TOWER_SIZE ≈ 2.2 world units). */
const HEX_TILE_WIDTH = 0.36;
const HEX_TILE_MAX_HEIGHT = 0.12;
const LANE_TILE_WIDTH = 0.4;
const LANE_TILE_MAX_HEIGHT = 0.16;
const LANE_TILE_SPACING_LOGIC = 38;
const LANE_TILE_LIFT = 0.07;

const RIVER_TILE_WIDTH = 0.42;
const RIVER_TILE_MAX_HEIGHT = 0.14;
const RIVER_TILE_SPACING_LOGIC = 32;
const RIVER_TILE_LIFT = 0.03;
/** Second row of hexes so the rift reads as a river, not a single-file path. */
const RIVER_BANK_OFFSET_LOGIC = 22;

const CAMP_PAD_RADIUS = 0.92;
const CAMP_RING_INNER = 0.7;
const CAMP_RING_OUTER = 1.02;
const CAMP_OUTLINE_INNER = 1.08;
const CAMP_OUTLINE_OUTER = 1.22;
const CAMP_RING_PROP_RADIUS_LOGIC = 74;
const CAMP_RING_PROP_COUNT = 6;
const CAMP_HEX_PAD_RADIUS_LOGIC = 44;
const CAMP_HEX_PAD_COUNT = 6;

const CAMP_SIDE_STYLE = {
  blue: { fill: 0x2a8f6a, ring: 0x6ef0b8, emissive: 0x145838, light: 0x7dffd4 },
  red: { fill: 0xa84838, ring: 0xff9a72, emissive: 0x6a2018, light: 0xffb090 }
} as const;

const OBJECTIVE_PAD_RADIUS = 1.12;
const OBJECTIVE_RING_INNER = 0.88;
const OBJECTIVE_RING_OUTER = 1.22;
const OBJECTIVE_OUTLINE_INNER = 1.28;
const OBJECTIVE_OUTLINE_OUTER = 1.44;
const OBJECTIVE_RING_PROP_RADIUS_LOGIC = 96;
const OBJECTIVE_RING_PROP_COUNT = 8;
const OBJECTIVE_HEX_PAD_RADIUS_LOGIC = 52;
const OBJECTIVE_HEX_PAD_COUNT = 8;
const OBJECTIVE_PROP_LIFT = 0.14;
const OBJECTIVE_GUARDIAN_WIDTH = { dragon: 2.15, baron: 2.65 } as const;
const OBJECTIVE_GUARDIAN_LIFT = 0.32;
/** Nudge guardians toward mid so they sit in front of the mountain landmark. */
const OBJECTIVE_GUARDIAN_RIVER_OFFSET = 42;

export type ObjectiveGuardians = Record<"dragon" | "baron", THREE.Group>;

const OBJECTIVE_PIT_STYLE = {
  dragon: { fill: 0x2a5a8f, ring: 0x6eb8ff, emissive: 0x143858, light: 0x7db8ff },
  baron: { fill: 0x5a3a88, ring: 0xc99aff, emissive: 0x381858, light: 0xd4a8ff }
} as const;

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

function offsetAlongNormal(point: Point, tangent: Point, offset: number): Point {
  const length = Math.hypot(tangent.x, tangent.y);
  if (length < 0.001) {
    return point;
  }
  const nx = (-tangent.y / length) * offset;
  const ny = (tangent.x / length) * offset;
  return { x: point.x + nx, y: point.y + ny };
}

function tangentAtRiverSample(samples: Point[], index: number): Point {
  const current = samples[index]!;
  const previous = samples[Math.max(0, index - 1)]!;
  const next = samples[Math.min(samples.length - 1, index + 1)]!;
  return { x: next.x - previous.x, y: next.y - previous.y };
}

async function addRiverHexPath(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  const waterTemplate = await assets.loadProp(HEX_WATER_TILE);
  fitLanePathTile(waterTemplate, RIVER_TILE_WIDTH, RIVER_TILE_MAX_HEIGHT);

  const straightTemplates = await Promise.all(
    RIVER_STRAIGHT_TILES.map(async (path) => {
      const template = await assets.loadProp(path);
      fitLanePathTile(template, RIVER_TILE_WIDTH, RIVER_TILE_MAX_HEIGHT);
      return template;
    })
  );

  const river = new THREE.Group();
  river.name = "river";

  const centerSamples = samplePathPoints(RIVER_PATH, RIVER_TILE_SPACING_LOGIC);
  for (let index = 0; index < centerSamples.length; index += 1) {
    const point = centerSamples[index]!;
    const tangent = tangentAtRiverSample(centerSamples, index);
    const rotation = logicFacingY(tangent.x, tangent.y);
    const template = straightTemplates[index % straightTemplates.length] ?? waterTemplate;

    const placements: Point[] = [
      point,
      offsetAlongNormal(point, tangent, RIVER_BANK_OFFSET_LOGIC),
      offsetAlongNormal(point, tangent, -RIVER_BANK_OFFSET_LOGIC)
    ];

    for (const placement of placements) {
      const tile = template.clone(true);
      const world = logicToWorld(placement, RIVER_TILE_LIFT);
      tile.position.set(world.x, world.y, world.z);
      tile.rotation.y = rotation;
      snapObjectToGround(tile);
      river.add(tile);
    }
  }

  scene.add(river);
  debugLog("RiftScene", "river hex path placed", {
    samples: centerSamples.length,
    tiles: river.children.length
  });
}

function campOrbitOffsets(radius: number, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function addJungleCampPit(group: THREE.Group, camp: JungleCampDefinition): void {
  const world = logicToWorld(camp, 0.02);
  const style = CAMP_SIDE_STYLE[camp.side];

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(CAMP_PAD_RADIUS, 32),
    new THREE.MeshStandardMaterial({
      color: style.fill,
      emissive: style.emissive,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.62,
      roughness: 0.85,
      depthWrite: false
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(world.x, world.y, world.z);
  group.add(pad);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(CAMP_RING_INNER, CAMP_RING_OUTER, 36),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.ring,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.88,
      roughness: 0.7,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(world.x, world.y + 0.006, world.z);
  group.add(ring);

  const outline = new THREE.Mesh(
    new THREE.RingGeometry(CAMP_OUTLINE_INNER, CAMP_OUTLINE_OUTER, 40),
    new THREE.MeshStandardMaterial({
      color: 0xfff2c8,
      emissive: 0xfff2c8,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.42,
      roughness: 0.9,
      depthWrite: false
    })
  );
  outline.rotation.x = -Math.PI / 2;
  outline.position.set(world.x, world.y + 0.01, world.z);
  group.add(outline);

  const beacon = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 1.15, 10),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.emissive,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      metalness: 0.15
    })
  );
  pole.position.set(world.x, 0.58, world.z);
  beacon.add(pole);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.38, 10),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.ring,
      emissiveIntensity: 0.75,
      roughness: 0.4
    })
  );
  cap.position.set(world.x, 1.22, world.z);
  beacon.add(cap);
  group.add(beacon);

  const light = new THREE.PointLight(style.light, 1.1, 4.2, 1.6);
  light.position.set(world.x, 0.9, world.z);
  group.add(light);
}

function tintHexCampTile(template: THREE.Object3D, tint: number): THREE.Object3D {
  const tile = template.clone(true);
  tile.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const source = child.material;
    const materials = Array.isArray(source) ? source : [source];
    child.material = materials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return material;
      }
      const tinted = material.clone();
      tinted.color.set(tint);
      tinted.emissive.set(tint).multiplyScalar(0.22);
      tinted.emissiveIntensity = 0.6;
      return tinted;
    });
  });
  return tile;
}

async function addCampHexPads(
  scene: THREE.Scene,
  assets: AssetManager,
  camp: JungleCampDefinition,
  grassTemplate: THREE.Object3D
): void {
  const tint = camp.side === "blue" ? 0x3ecf96 : 0xe87858;
  const placements = [{ x: 0, y: 0 }, ...campOrbitOffsets(CAMP_HEX_PAD_RADIUS_LOGIC, CAMP_HEX_PAD_COUNT)];

  for (const offset of placements) {
    const tile = tintHexCampTile(grassTemplate, tint);
    const world = logicToWorld({ x: camp.x + offset.x, y: camp.y + offset.y }, 0.09);
    tile.position.set(world.x, world.y, world.z);
    snapObjectToGround(tile);
    scene.add(tile);
  }
}

async function addJungleCampStructures(scene: THREE.Scene, assets: AssetManager): Promise<void> {
  const grassTemplate = await assets.loadProp(HEX_GRASS_TILE);
  fitHexTileOnGround(grassTemplate, HEX_TILE_WIDTH * 1.15, HEX_TILE_MAX_HEIGHT);

  const ringOffsets = campOrbitOffsets(CAMP_RING_PROP_RADIUS_LOGIC, CAMP_RING_PROP_COUNT);

  for (const camp of JUNGLE_CAMPS) {
    const campGroup = new THREE.Group();
    campGroup.name = `camp-${camp.id}`;
    addJungleCampPit(campGroup, camp);
    scene.add(campGroup);

    await addCampHexPads(scene, assets, camp, grassTemplate);

    await placeProp(
      scene,
      assets,
      getJungleCampCenterProp(camp.id),
      camp,
      1.05,
      (camp.x + camp.y) * 0.001,
      0.1
    );

    for (let index = 0; index < ringOffsets.length; index += 1) {
      const offset = ringOffsets[index]!;
      const ringProp = JUNGLE_CAMP_RING_PROPS[index % JUNGLE_CAMP_RING_PROPS.length]!;
      await placeProp(
        scene,
        assets,
        ringProp,
        { x: camp.x + offset.x, y: camp.y + offset.y },
        0.68,
        (index / ringOffsets.length) * Math.PI * 2
      );
    }
  }
}

function addObjectivePit(group: THREE.Group, point: Point, kind: keyof typeof OBJECTIVE_PIT_STYLE): void {
  const world = logicToWorld(point, 0.02);
  const style = OBJECTIVE_PIT_STYLE[kind];

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(OBJECTIVE_PAD_RADIUS, 36),
    new THREE.MeshStandardMaterial({
      color: style.fill,
      emissive: style.emissive,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.68,
      roughness: 0.85,
      depthWrite: false
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(world.x, world.y, world.z);
  group.add(pad);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(OBJECTIVE_RING_INNER, OBJECTIVE_RING_OUTER, 40),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.ring,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.92,
      roughness: 0.7,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(world.x, world.y + 0.008, world.z);
  group.add(ring);

  const outline = new THREE.Mesh(
    new THREE.RingGeometry(OBJECTIVE_OUTLINE_INNER, OBJECTIVE_OUTLINE_OUTER, 44),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.emissive,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.5,
      roughness: 0.9,
      depthWrite: false
    })
  );
  outline.rotation.x = -Math.PI / 2;
  outline.position.set(world.x, world.y + 0.012, world.z);
  group.add(outline);

  const beacon = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 1.35, 10),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.emissive,
      emissiveIntensity: 1,
      roughness: 0.35,
      metalness: 0.2
    })
  );
  pole.position.set(world.x, 0.68, world.z);
  beacon.add(pole);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.44, 10),
    new THREE.MeshStandardMaterial({
      color: style.ring,
      emissive: style.ring,
      emissiveIntensity: 0.85,
      roughness: 0.4
    })
  );
  cap.position.set(world.x, 1.42, world.z);
  beacon.add(cap);
  group.add(beacon);

  const light = new THREE.PointLight(style.light, 1.35, 5.5, 1.5);
  light.position.set(world.x, 1.05, world.z);
  group.add(light);
}

async function addObjectiveHexPads(
  scene: THREE.Scene,
  assets: AssetManager,
  point: Point,
  kind: keyof typeof OBJECTIVE_PIT_STYLE,
  grassTemplate: THREE.Object3D
): Promise<void> {
  const tint = kind === "dragon" ? 0x4aa3df : 0xa884e8;
  const placements = [{ x: 0, y: 0 }, ...campOrbitOffsets(OBJECTIVE_HEX_PAD_RADIUS_LOGIC, OBJECTIVE_HEX_PAD_COUNT)];

  for (const offset of placements) {
    const tile = tintHexCampTile(grassTemplate, tint);
    const world = logicToWorld({ x: point.x + offset.x, y: point.y + offset.y }, 0.1);
    tile.position.set(world.x, world.y, world.z);
    snapObjectToGround(tile);
    scene.add(tile);
  }
}

function offsetTowardRiverMid(point: Point, kind: "dragon" | "baron", distance: number): Point {
  const riverDx = RIVER_PATH[1]!.x - RIVER_PATH[0]!.x;
  const riverDy = RIVER_PATH[1]!.y - RIVER_PATH[0]!.y;
  const length = Math.hypot(riverDx, riverDy) || 1;
  const sign = kind === "baron" ? 1 : -1;
  return {
    x: point.x + (riverDx / length) * distance * sign,
    y: point.y + (riverDy / length) * distance * sign
  };
}

function raiseRenderOrder(root: THREE.Object3D, order: number): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = order;
    }
  });
}

async function placeObjectiveGuardian(
  assets: AssetManager,
  parent: THREE.Group,
  kind: "dragon" | "baron",
  point: Point,
  modelPath: string,
  rotation: number
): Promise<THREE.Group> {
  const model = await assets.loadModel(modelPath, true);
  const character = model.scene;
  fitModelToFootprint(character, OBJECTIVE_GUARDIAN_WIDTH[kind]);
  character.rotation.y = rotation;
  raiseRenderOrder(character, 14);

  const wrapper = new THREE.Group();
  wrapper.name = `${kind}-guardian`;
  wrapper.add(character);

  const placement = offsetTowardRiverMid(point, kind, OBJECTIVE_GUARDIAN_RIVER_OFFSET);
  const world = logicToWorld(placement, OBJECTIVE_GUARDIAN_LIFT);
  wrapper.position.set(world.x, world.y, world.z);
  parent.add(wrapper);
  return wrapper;
}

async function addObjectiveStructures(scene: THREE.Scene, assets: AssetManager): Promise<ObjectiveGuardians> {
  const grassTemplate = await assets.loadProp(HEX_GRASS_TILE);
  fitHexTileOnGround(grassTemplate, HEX_TILE_WIDTH * 1.15, HEX_TILE_MAX_HEIGHT);

  const ringOffsets = campOrbitOffsets(OBJECTIVE_RING_PROP_RADIUS_LOGIC, OBJECTIVE_RING_PROP_COUNT);
  const guardians: Partial<ObjectiveGuardians> = {};
  const objectives: Array<{
    kind: keyof typeof OBJECTIVE_PIT_STYLE;
    point: Point;
    baseProp: string;
    landmarkProp: string;
    landmarkWidth: number;
    rotation: number;
    modelPath: string;
  }> = [
    {
      kind: "baron",
      point: OBJECTIVE_POSITIONS.baron,
      baseProp: OBJECTIVE_BASE_PROPS.baron,
      landmarkProp: OBJECTIVE_MARKER_PROPS.baron,
      landmarkWidth: 3.15,
      rotation: 2.1,
      modelPath: MONSTER_BARON_MODEL
    },
    {
      kind: "dragon",
      point: OBJECTIVE_POSITIONS.dragon,
      baseProp: OBJECTIVE_BASE_PROPS.dragon,
      landmarkProp: OBJECTIVE_MARKER_PROPS.dragon,
      landmarkWidth: 2.85,
      rotation: 0.4,
      modelPath: MONSTER_DRAGON_MODEL
    }
  ];

  const objectivesRoot = new THREE.Group();
  objectivesRoot.name = "objectives";
  scene.add(objectivesRoot);

  for (const objective of objectives) {
    const pitGroup = new THREE.Group();
    pitGroup.name = `${objective.kind}-pit`;
    addObjectivePit(pitGroup, objective.point, objective.kind);
    objectivesRoot.add(pitGroup);

    await addObjectiveHexPads(scene, assets, objective.point, objective.kind, grassTemplate);

    await placeProp(scene, assets, objective.baseProp, objective.point, 1.35, objective.rotation, 0.08);

    for (let index = 0; index < ringOffsets.length; index += 1) {
      const offset = ringOffsets[index]!;
      const ringProp = OBJECTIVE_RING_PROPS[index % OBJECTIVE_RING_PROPS.length]!;
      await placeProp(
        scene,
        assets,
        ringProp,
        { x: objective.point.x + offset.x, y: objective.point.y + offset.y },
        0.58,
        (index / ringOffsets.length) * Math.PI * 2,
        OBJECTIVE_PROP_LIFT
      );
    }

    await placeProp(
      scene,
      assets,
      objective.landmarkProp,
      objective.point,
      objective.landmarkWidth,
      objective.rotation,
      OBJECTIVE_PROP_LIFT
    );

    guardians[objective.kind] = await placeObjectiveGuardian(
      assets,
      objectivesRoot,
      objective.kind,
      objective.point,
      objective.modelPath,
      objective.rotation
    );
  }

  debugLog("RiftScene", "objective structures placed", { count: objectives.length });
  return guardians as ObjectiveGuardians;
}

export async function buildRiftScene(scene: THREE.Scene, assets: AssetManager): Promise<ObjectiveGuardians> {
  debugLog("RiftScene", "build start");
  await addHexTileGround(scene, assets);
  await addRiverHexPath(scene, assets);
  await addLaneHexPaths(scene, assets);

  const nature = await assets.getNatureManifest();
  const treePaths = pickNaturePaths(nature);

  await addJungleCampStructures(scene, assets);

  for (const side of ["blue", "red"] as const) {
    for (const half of ["top", "bot"] as const) {
      const center = JUNGLE_QUADRANT_CENTERS[side][half];
      for (let index = 0; index < 2; index += 1) {
        const offset = campOrbitOffsets(110, 2)[index]!;
        const point = { x: center.x + offset.x, y: center.y + offset.y };
        await placeProp(
          scene,
          assets,
          pickFrom(treePaths, point.x + point.y + index),
          point,
          TREE_WIDTH * (index === 0 ? 1.2 : 1.0),
          index * 1.1
        );
      }
    }
  }

  for (const point of buildScatterPoints()) {
    await placeProp(scene, assets, pickFrom(treePaths, point.x + point.y), point, point.scale * TREE_WIDTH, point.rotation);
  }

  // Dragon / baron landmarks + guardians last so they sit on top of the rift terrain.
  const guardians = await addObjectiveStructures(scene, assets);

  debugLog("RiftScene", "build complete", { children: scene.children.length });
  return guardians;
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
  rotation: number,
  lift = 0
): Promise<void> {
  try {
    const model = await assets.loadProp(modelPath);
    fitModelToFootprint(model, width);
    const world = logicToWorld(point, lift);
    model.position.set(world.x, 0, world.z);
    model.rotation.y = rotation;
    snapObjectToGround(model);
    if (lift > 0) {
      model.position.y += lift;
    }
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
