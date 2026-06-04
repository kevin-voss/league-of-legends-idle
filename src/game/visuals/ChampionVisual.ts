import * as THREE from "three";
import type { LoadedModel } from "../../gltf/AssetManager.js";
import { logicFacingY, logicToWorld } from "../../core/CoordinateMap.js";
import type { Champion } from "../entities/Champion.js";
import { clipsForState, resolveChampionAnimState } from "./AnimationClips.js";

export class ChampionVisual {
  readonly mesh: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: { idle: THREE.AnimationAction | null; walk: THREE.AnimationAction | null; attack: THREE.AnimationAction | null };
  private currentAction: THREE.AnimationAction | null = null;
  private lastPos = { x: 0, y: 0 };
  facingY = 0;

  constructor(model: LoadedModel, sideColor: number) {
    this.mesh = model.scene;
    this.mesh.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.tintSide(sideColor);
    this.mixer = new THREE.AnimationMixer(this.mesh);

    const idleClip = clipsForState(model.animations, "idle");
    const walkClip = clipsForState(model.animations, "walk");
    const attackClip = clipsForState(model.animations, "attack");

    this.actions = {
      idle: idleClip ? this.mixer.clipAction(idleClip) : null,
      walk: walkClip ? this.mixer.clipAction(walkClip) : null,
      attack: attackClip ? this.mixer.clipAction(attackClip) : null
    };

    this.playAction(this.actions.idle);
  }

  sync(champion: Champion, dt: number): void {
    const world = logicToWorld(champion.pos);
    this.mesh.position.set(world.x, 0.12, world.z);
    this.mesh.visible = champion.alive;

    const dx = champion.pos.x - this.lastPos.x;
    const dy = champion.pos.y - this.lastPos.y;
    if (dx * dx + dy * dy > 0.5) {
      this.facingY = logicFacingY(dx, dy);
    }
    this.mesh.rotation.y = this.facingY;
    this.lastPos.x = champion.pos.x;
    this.lastPos.y = champion.pos.y;

    const animKey = resolveChampionAnimState(champion.state);
    const next = this.actions[animKey] ?? this.actions.idle;
    if (next && next !== this.currentAction) {
      this.playAction(next);
    }

    this.mixer.update(dt);
  }

  headWorldPosition(): THREE.Vector3 {
    const anchor = new THREE.Vector3(0, 2.4, 0);
    this.mesh.localToWorld(anchor);
    return anchor;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mesh.removeFromParent();
  }

  private playAction(action: THREE.AnimationAction | null): void {
    if (!action) {
      return;
    }
    this.currentAction?.fadeOut(0.15);
    action.reset().fadeIn(0.15).play();
    this.currentAction = action;
  }

  private tintSide(color: number): void {
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => this.applyEmissive(entry, color));
      } else {
        this.applyEmissive(material, color);
      }
    });
  }

  private applyEmissive(material: THREE.Material, color: number): void {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.setHex(color);
      material.emissiveIntensity = 0.28;
    }
  }
}
