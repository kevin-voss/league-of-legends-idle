import * as THREE from "three";
import { debugLog, isDebugEnabled } from "./DebugLog.js";
import { AssetManager } from "../gltf/AssetManager.js";
import {
  getAllSkinnedEntityModelPaths,
  getAllStructureModelPaths,
  getChampionModelPath,
  getJungleCampModelPath,
  getMinionModelPath,
  getStructureModelPath
} from "../gltf/AssetCatalog.js";
import { fitModelToFootprint, setModelOpacity } from "../gltf/ModelUtils.js";
import { logicToWorld, LOGIC_TO_WORLD } from "./CoordinateMap.js";
import { MapCameraControls } from "./MapCameraControls.js";
import { ThreeEngine } from "./ThreeEngine.js";
import type { Match } from "../game/simulation/Match.js";
import { Minion } from "../game/entities/Minion.js";
import { Monster } from "../game/entities/Monster.js";
import { Structure } from "../game/entities/Structure.js";
import { buildRiftScene, type ObjectiveGuardians } from "../game/map/RiftScene.js";
import { ChampionVisual } from "../game/visuals/ChampionVisual.js";
import { WorldHealthBars } from "../ui/components/WorldHealthBars.js";

const SIDE_COLOR = { blue: 0x4aa3df, red: 0xdf6d5f } as const;
const CHAMPION_WIDTH = 1.55;
const MINION_WIDTH = 0.46;
const MONSTER_WIDTH = { camp: 1.12, dragon: 1.72, baron: 2.15 } as const;
const TOWER_SIZE = 2.2;
const NEXUS_SIZE = 3.4;
const TOWER_RANGE_RING_SEGMENTS = 72;
/** Above hex tiles so the ring is not z-fighting with the ground. */
const TOWER_RANGE_RING_Y = 0.14;

interface EntityMesh {
  mesh: THREE.Object3D;
  rangeRing?: THREE.Group;
}

export class ThreeRenderer {
  private readonly engine: ThreeEngine;
  private readonly assets = new AssetManager();
  private readonly championVisuals = new Map<string, ChampionVisual>();
  private readonly entityMeshes = new Map<string, EntityMesh>();
  private readonly structureTemplates = new Map<string, THREE.Group>();
  private readonly projectileMeshes: THREE.Mesh[] = [];
  private readonly healthBars: WorldHealthBars;
  private readonly clock = new THREE.Clock();
  private readonly debugOverlay: HTMLElement | null;
  private cameraControls: MapCameraControls | null = null;
  private objectiveGuardians: ObjectiveGuardians | null = null;
  private ready = false;
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement, viewport: HTMLElement, debugOverlay: HTMLElement | null = null) {
    this.engine = new ThreeEngine(canvas);
    this.healthBars = new WorldHealthBars(overlay);
    this.debugOverlay = debugOverlay;
    this.cameraControls = new MapCameraControls(viewport, this.engine);
  }

  async init(match: Match): Promise<void> {
    debugLog("ThreeRenderer", "init start");
    this.objectiveGuardians = await buildRiftScene(this.engine.scene, this.assets);
    debugLog("ThreeRenderer", "rift scene built", { children: this.engine.scene.children.length });
    await this.preloadStructureModels();
    debugLog("ThreeRenderer", "structures loaded", { templates: this.structureTemplates.size });
    await this.spawnChampions(match);
    debugLog("ThreeRenderer", "champions spawned", { count: this.championVisuals.size });
    await this.preloadEntityModels();
    for (const structure of match.structures) {
      this.ensureStructureMesh(structure);
    }
    for (const structure of match.structures) {
      const entry = this.entityMeshes.get(structure.id);
      if (entry) {
        const world = logicToWorld(structure.pos);
        entry.mesh.position.set(world.x, entry.mesh.position.y, world.z);
      }
    }
    debugLog("ThreeRenderer", "structures placed", { count: match.structures.length });
    this.bindObjectiveGuardians(match);
    this.ready = true;
    this.updateDebugPanel(match, "ready");
    if (isDebugEnabled()) {
      const scene = this.engine.scene;
      (globalThis as typeof globalThis & { __idleRiftsScene?: THREE.Scene }).__idleRiftsScene = scene;
      (globalThis as typeof globalThis & { __idleRiftsChampionDump?: () => unknown }).__idleRiftsChampionDump = () =>
        [...this.championVisuals.entries()].map(([id, visual]) => ({
          id,
          scale: visual.mesh.scale.toArray().map((v) => Number(v.toFixed(4))),
          pos: visual.mesh.position.toArray().map((v) => Number(v.toFixed(2))),
          visible: visual.mesh.visible
        }));
      (globalThis as typeof globalThis & { __idleRiftsSceneDump?: () => unknown }).__idleRiftsSceneDump = () => {
        const rows: Array<{ name: string; max: number; size: number[] }> = [];
        scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) {
            return;
          }
          const box = new THREE.Box3().setFromObject(obj);
          const size = box.getSize(new THREE.Vector3());
          const max = Math.max(size.x, size.y, size.z);
          if (max > 1.2) {
            rows.push({
              name: obj.name || obj.parent?.name || obj.type,
              max: Number(max.toFixed(2)),
              size: [size.x, size.y, size.z].map((v) => Number(v.toFixed(2)))
            });
          }
        });
        return rows.sort((a, b) => b.max - a.max).slice(0, 15);
      };
    }
    debugLog("ThreeRenderer", "init complete");
  }

  render(match: Match): void {
    if (!this.ready) {
      return;
    }

    const dt = this.clock.getDelta();
    this.syncChampions(match, dt);
    this.syncGenericEntities(match);
    this.syncStructures(match);
    this.syncProjectiles(match);
    this.pruneStaleEntityMeshes(match);
    this.healthBars.sync(
      this.engine,
      match.champions,
      this.championVisuals,
      this.entityMeshes,
      match.minions,
      match.monsters,
      match.structures
    );
    this.engine.render();
    this.frameCount += 1;
    if (isDebugEnabled() && this.frameCount % 120 === 0) {
      this.updateDebugPanel(match, "rendering");
    }
  }

  private updateDebugPanel(match: Match, phase: string): void {
    if (!this.debugOverlay) {
      return;
    }
    const canvas = this.engine.renderer.domElement;
    const aliveChampions = match.champions.filter((champion) => champion.alive).length;
    this.debugOverlay.textContent = [
      `phase: ${phase}`,
      `canvas: ${canvas.width}x${canvas.height} (client ${canvas.clientWidth}x${canvas.clientHeight})`,
      `scene children: ${this.engine.scene.children.length}`,
      `champions: ${this.championVisuals.size} (${aliveChampions} alive)`,
      `entities: ${this.entityMeshes.size} | structure templates: ${this.structureTemplates.size}`
    ].join("\n");
  }

  resize(): void {
    this.engine.resize(this.engine.renderer.domElement);
  }

  dispose(): void {
    this.cameraControls?.destroy();
    this.cameraControls = null;
    this.healthBars.clear();
    for (const visual of this.championVisuals.values()) {
      visual.dispose();
    }
    this.championVisuals.clear();
    for (const entry of this.entityMeshes.values()) {
      entry.mesh.removeFromParent();
    }
    this.entityMeshes.clear();
    this.structureTemplates.clear();
    this.engine.dispose();
  }

  private async preloadStructureModels(): Promise<void> {
    await Promise.all(
      getAllStructureModelPaths().map(async (modelPath) => {
        const model = await this.assets.loadProp(modelPath);
        const size = modelPath.includes("castle") ? NEXUS_SIZE : TOWER_SIZE;
        fitModelToFootprint(model, size);
        model.userData.baseScale = model.scale.x;
        this.structureTemplates.set(modelPath, model);
      })
    );
  }

  private async spawnChampions(match: Match): Promise<void> {
    const modelPaths = new Set(
      match.champions.map((champion) => getChampionModelPath(champion.template.id, champion.role))
    );
    await Promise.all([...modelPaths].map((path) => this.assets.loadModel(path, true)));

    for (const champion of match.champions) {
      const modelPath = getChampionModelPath(champion.template.id, champion.role);
      const model = await this.assets.loadModel(modelPath, true);
      const visual = new ChampionVisual(model, SIDE_COLOR[champion.side as keyof typeof SIDE_COLOR]);
      fitModelToFootprint(visual.mesh, CHAMPION_WIDTH);
      this.engine.scene.add(visual.mesh);
      this.championVisuals.set(champion.id, visual);
    }
  }

  private async preloadEntityModels(): Promise<void> {
    await Promise.all(getAllSkinnedEntityModelPaths().map((modelPath) => this.assets.loadModel(modelPath, true)));
  }

  private syncChampions(match: Match, dt: number): void {
    for (const champion of match.champions) {
      const visual = this.championVisuals.get(champion.id);
      visual?.sync(champion, dt);
    }
  }

  private syncGenericEntities(match: Match): void {
    const minions = match.minions.filter((minion) => minion.alive || minion.deathTimer > 0);
    const monsters = match.monsters.filter(
      (monster) =>
        monster.monsterType === "dragon" ||
        monster.monsterType === "baron" ||
        monster.alive ||
        monster.deathTimer > 0
    );

    for (const minion of minions) {
      this.syncMinion(minion);
    }

    for (const monster of monsters) {
      this.syncMonster(monster);
    }
  }

  private syncMinion(minion: Minion): void {
    const entry = this.ensureSkinnedEntity(minion.id, getMinionModelPath(minion.type), MINION_WIDTH);
    this.placeEntity(entry.mesh, minion.pos.x, minion.pos.y, minion.alive, minion.alive ? 1 : 0.35);
  }

  private bindObjectiveGuardians(match: Match): void {
    if (!this.objectiveGuardians) {
      return;
    }

    for (const monster of match.monsters) {
      if (monster.monsterType !== "dragon" && monster.monsterType !== "baron") {
        continue;
      }
      const guardian = this.objectiveGuardians[monster.monsterType];
      this.entityMeshes.set(monster.id, { mesh: guardian });
      this.syncMonster(monster);
    }
  }

  private syncMonster(monster: Monster): void {
    const isMajorObjective = monster.monsterType === "dragon" || monster.monsterType === "baron";

    if (isMajorObjective && this.objectiveGuardians) {
      const guardian = this.objectiveGuardians[monster.monsterType];
      this.entityMeshes.set(monster.id, { mesh: guardian });
      guardian.visible = true;
      setModelOpacity(guardian, monster.alive ? 1 : 0.72);
      return;
    }

    const modelPath = getJungleCampModelPath(monster.campId);
    const entry = this.ensureSkinnedEntity(monster.id, modelPath, MONSTER_WIDTH.camp);
    this.placeEntity(entry.mesh, monster.pos.x, monster.pos.y, monster.alive, monster.alive ? 1 : 0.3);
  }

  private syncStructures(match: Match): void {
    for (const structure of match.structures) {
      const entry = this.ensureStructureMesh(structure);
      const world = logicToWorld(structure.pos);
      entry.mesh.position.set(world.x, entry.mesh.position.y, world.z);
      entry.mesh.visible = structure.alive || structure.deathTimer > 0;
      const opacity = structure.alive ? 1 : 0.4;
      setModelOpacity(entry.mesh, opacity);
      const baseScale = (entry.mesh.userData.baseScale as number | undefined) ?? entry.mesh.scale.x;
      entry.mesh.userData.baseScale = baseScale;
      entry.mesh.scale.setScalar(baseScale * (structure.alive ? 1 : 0.82));

      if (entry.rangeRing) {
        entry.rangeRing.position.set(world.x, TOWER_RANGE_RING_Y, world.z);
        entry.rangeRing.visible = structure.alive && structure.structureType === "tower";
      }
    }
  }

  private syncProjectiles(match: Match): void {
    while (this.projectileMeshes.length > match.projectiles.length) {
      const mesh = this.projectileMeshes.pop();
      mesh?.removeFromParent();
    }

    match.projectiles.forEach((projectile, index) => {
      let mesh = this.projectileMeshes[index];
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshStandardMaterial({ color: projectile.color, emissive: new THREE.Color(projectile.color), emissiveIntensity: 0.6 })
        );
        mesh.castShadow = true;
        this.engine.scene.add(mesh);
        this.projectileMeshes[index] = mesh;
      }

      const world = logicToWorld(projectile.pos, 0.45);
      mesh.position.set(world.x, world.y, world.z);
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.set(projectile.color);
        mesh.material.emissive.set(projectile.color);
      }
      mesh.visible = projectile.life > 0;
    });
  }

  private ensureSkinnedEntity(id: string, modelPath: string, width: number): EntityMesh {
    const existing = this.entityMeshes.get(id);
    if (existing && existing.mesh.children.length > 0) {
      return existing;
    }

    if (!existing) {
      this.entityMeshes.set(id, { mesh: new THREE.Group() });
    }

    const entry = this.entityMeshes.get(id)!;
    if (entry.mesh.userData.loading) {
      return entry;
    }
    entry.mesh.userData.loading = true;

    void this.assets.loadModel(modelPath, true).then((model) => {
      if (!this.entityMeshes.has(id)) {
        return;
      }
      const root = model.scene;
      fitModelToFootprint(root, width);
      entry.mesh.clear();
      entry.mesh.add(root);
      this.engine.scene.add(entry.mesh);
      entry.mesh.userData.loading = false;
    }).catch((error) => {
      console.error(`Failed to load entity model ${modelPath}`, error);
      entry.mesh.userData.loading = false;
    });

    return entry;
  }

  private ensureStructureMesh(structure: Structure): EntityMesh {
    const existing = this.entityMeshes.get(structure.id);
    if (existing) {
      return existing;
    }

    const modelPath = getStructureModelPath(structure.side as "blue" | "red", structure.structureType, structure.tier);
    const template = this.structureTemplates.get(modelPath);
    const mesh = template ? template.clone(true) : new THREE.Group();
    if (template?.userData.baseScale) {
      mesh.userData.baseScale = template.userData.baseScale;
    }
    this.engine.scene.add(mesh);

    const entry: EntityMesh = { mesh };
    if (structure.structureType === "tower") {
      entry.rangeRing = createTowerRangeRing(structure.side as "blue" | "red", structure.attackRange);
      this.engine.scene.add(entry.rangeRing);
    }
    this.entityMeshes.set(structure.id, entry);
    return entry;
  }

  private placeEntity(mesh: THREE.Object3D, logicX: number, logicY: number, visible: boolean, opacity: number): void {
    const world = logicToWorld({ x: logicX, y: logicY }, 0.1);
    mesh.position.set(world.x, world.y, world.z);
    mesh.visible = visible;
    setModelOpacity(mesh, opacity);
  }

  private pruneStaleEntityMeshes(match: Match): void {
    const liveIds = new Set<string>();

    for (const structure of match.structures) {
      liveIds.add(structure.id);
    }

    for (const minion of match.minions) {
      if (minion.alive || minion.deathTimer > 0) {
        liveIds.add(minion.id);
      }
    }

    for (const monster of match.monsters) {
      if (
        monster.monsterType === "dragon" ||
        monster.monsterType === "baron" ||
        monster.alive ||
        monster.deathTimer > 0
      ) {
        liveIds.add(monster.id);
      }
    }

    this.pruneEntityMeshes(liveIds);
  }

  private pruneEntityMeshes(liveIds: Set<string>): void {
    for (const [id, entry] of this.entityMeshes) {
      if (this.championVisuals.has(id) || liveIds.has(id)) {
        continue;
      }
      entry.rangeRing?.removeFromParent();
      entry.mesh.removeFromParent();
      this.entityMeshes.delete(id);
    }
  }
}

function createTowerRangeRing(side: "blue" | "red", attackRange: number): THREE.Group {
  const radius = attackRange * LOGIC_TO_WORLD;
  const strokeColor = side === "blue" ? 0x77b9ff : 0xff8b7d;
  const fillColor = side === "blue" ? 0x4aa3df : 0xdf6d5f;
  const group = new THREE.Group();
  group.name = "tower-range";

  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.07,
      depthWrite: false
    })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.renderOrder = 1;
  group.add(fill);

  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= TOWER_RANGE_RING_SEGMENTS; index += 1) {
    const angle = (index / TOWER_RANGE_RING_SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }

  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: strokeColor,
      dashSize: 0.16,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })
  );
  outline.computeLineDistances();
  outline.renderOrder = 2;
  group.add(outline);

  return group;
}
