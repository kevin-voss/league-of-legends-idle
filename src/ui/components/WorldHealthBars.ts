import * as THREE from "three";
import type { ThreeEngine } from "../../core/ThreeEngine.js";
import type { EntitySide } from "../../data/models.js";
import type { Champion } from "../../game/entities/Champion.js";
import type { Minion } from "../../game/entities/Minion.js";
import type { Monster } from "../../game/entities/Monster.js";
import type { Structure } from "../../game/entities/Structure.js";
import type { ChampionVisual } from "../../game/visuals/ChampionVisual.js";

interface BarEntry {
  root: HTMLElement;
  fill: HTMLElement;
  level: HTMLElement | null;
}

interface EntityMeshEntry {
  mesh: THREE.Object3D;
}

export class WorldHealthBars {
  private readonly layer: HTMLElement;
  private readonly bars = new Map<string, BarEntry>();

  constructor(layer: HTMLElement) {
    this.layer = layer;
  }

  sync(
    engine: ThreeEngine,
    champions: Champion[],
    championVisuals: Map<string, ChampionVisual>,
    entityMeshes: Map<string, EntityMeshEntry>,
    minions: Minion[],
    monsters: Monster[],
    structures: Structure[]
  ): void {
    const live = new Set<string>();

    for (const champion of champions) {
      if (!champion.alive) {
        continue;
      }

      const visual = championVisuals.get(champion.id);
      if (!visual) {
        continue;
      }

      live.add(champion.id);
      const entry = this.ensureBar(champion.id, true);
      const screen = engine.projectToScreen(visual.headWorldPosition());
      this.placeBar(entry, screen, champion.hpPercent, champion.side, champion.matchLevel);
    }

    for (const minion of minions) {
      if (!minion.alive && minion.deathTimer <= 0) {
        continue;
      }
      const meshEntry = entityMeshes.get(minion.id);
      if (!this.syncMeshBar(engine, live, minion.id, minion.hpPercent, minion.side, meshEntry)) {
        continue;
      }
    }

    for (const monster of monsters) {
      if (!monster.alive && monster.deathTimer <= 0) {
        continue;
      }
      const meshEntry = entityMeshes.get(monster.id);
      if (!this.syncMeshBar(engine, live, monster.id, monster.hpPercent, monster.side, meshEntry)) {
        continue;
      }
    }

    for (const structure of structures) {
      if (!structure.alive && structure.deathTimer <= 0) {
        continue;
      }
      const meshEntry = entityMeshes.get(structure.id);
      if (!this.syncMeshBar(engine, live, structure.id, structure.hpPercent, structure.side, meshEntry, 0.35)) {
        continue;
      }
    }

    for (const [id, entry] of this.bars) {
      if (!live.has(id)) {
        entry.root.remove();
        this.bars.delete(id);
      }
    }
  }

  clear(): void {
    this.bars.forEach((entry) => entry.root.remove());
    this.bars.clear();
  }

  private syncMeshBar(
    engine: ThreeEngine,
    live: Set<string>,
    id: string,
    hpPercent: number,
    side: EntitySide,
    meshEntry: EntityMeshEntry | undefined,
    lift = 0.18
  ): boolean {
    if (!meshEntry || meshEntry.mesh.children.length === 0) {
      return false;
    }

    live.add(id);
    const bar = this.ensureBar(id, false);
    const screen = engine.projectToScreen(meshTopAnchor(meshEntry.mesh, lift));
    this.placeBar(bar, screen, hpPercent, side);
    return true;
  }

  private placeBar(
    entry: BarEntry,
    screen: { x: number; y: number; visible: boolean },
    hpPercent: number,
    side: EntitySide,
    level?: number
  ): void {
    if (!screen.visible) {
      entry.root.style.display = "none";
      return;
    }

    entry.root.style.display = "flex";
    entry.root.style.left = `${screen.x}px`;
    entry.root.style.top = `${screen.y}px`;
    entry.fill.style.width = `${Math.round(Math.max(0, Math.min(1, hpPercent)) * 100)}%`;
    entry.fill.style.background = fillColorForSide(side);
    if (entry.level && level !== undefined) {
      entry.level.textContent = String(level);
    }
  }

  private ensureBar(id: string, showLevel: boolean): BarEntry {
    const existing = this.bars.get(id);
    if (existing) {
      return existing;
    }

    const root = document.createElement("div");
    root.className = showLevel ? "world-health-bar" : "world-health-bar world-health-bar--compact";

    const track = document.createElement("div");
    track.className = "world-health-bar__track";
    const fill = document.createElement("div");
    fill.className = "world-health-bar__fill";
    track.append(fill);

    let level: HTMLElement | null = null;
    if (showLevel) {
      level = document.createElement("span");
      level.className = "world-health-bar__level";
      root.append(level, track);
    } else {
      root.append(track);
    }

    this.layer.append(root);
    const entry: BarEntry = { root, fill, level };
    this.bars.set(id, entry);
    return entry;
  }
}

function fillColorForSide(side: EntitySide): string {
  if (side === "blue") {
    return "#4aa3df";
  }
  if (side === "red") {
    return "#df6d5f";
  }
  return "#d4a84b";
}

function meshTopAnchor(mesh: THREE.Object3D, lift: number): THREE.Vector3 {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  return new THREE.Vector3(center.x, box.max.y + lift, center.z);
}
