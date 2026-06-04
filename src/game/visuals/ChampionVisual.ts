import * as THREE from "three";
import type { LoadedModel } from "../../gltf/AssetManager.js";
import { logicFacingY, logicToWorld } from "../../core/CoordinateMap.js";
import type { Champion } from "../entities/Champion.js";
import { ATTACK_CLIP_PORTION, attackClipTimeScale, attackWindupSeconds } from "./CombatAnimation.js";
import { clipsForState, resolveChampionAnimState } from "./AnimationClips.js";

const WALK_ENTER_SQ = 1.1;
const WALK_EXIT_SQ = 0.2;
const BASE_BLEND = 0.18;
const ATTACK_BLEND = 0.06;

export class ChampionVisual {
  readonly mesh: THREE.Group;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: { idle: THREE.AnimationAction | null; walk: THREE.AnimationAction | null; attack: THREE.AnimationAction | null };
  private currentAction: THREE.AnimationAction | null = null;
  private baseAction: THREE.AnimationAction | null = null;
  private attackStopTime = 0;
  private attackInFlight = false;
  private lastAttackTimer = 0;
  private isMoving = false;
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
      idle: idleClip ? this.createLoopAction(idleClip) : null,
      walk: walkClip ? this.createLoopAction(walkClip) : null,
      attack: attackClip ? this.createAttackAction(attackClip) : null
    };

    this.setBaseAction(this.actions.idle);
  }

  sync(champion: Champion, dt: number): void {
    const world = logicToWorld(champion.pos);
    this.mesh.position.set(world.x, 0.12, world.z);
    this.mesh.visible = champion.alive;

    const dx = champion.pos.x - this.lastPos.x;
    const dy = champion.pos.y - this.lastPos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > WALK_ENTER_SQ) {
      this.isMoving = true;
    } else if (distSq < WALK_EXIT_SQ) {
      this.isMoving = false;
    }

    this.updateFacing(champion, dx, dy);
    this.lastPos.x = champion.pos.x;
    this.lastPos.y = champion.pos.y;

    if (champion.attackTimer > this.lastAttackTimer + 0.02) {
      this.triggerAttack(champion);
    }
    this.lastAttackTimer = champion.attackTimer;

    const animKey = resolveChampionAnimState(champion.state, this.isMoving);
    const nextBase = this.actions[animKey] ?? this.actions.idle;
    if (nextBase && nextBase !== this.baseAction) {
      this.setBaseAction(nextBase);
    }

    this.mixer.update(dt);
    this.updateAttackPlayback();
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

  private createLoopAction(clip: THREE.AnimationClip): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    return action;
  }

  private createAttackAction(clip: THREE.AnimationClip): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    return action;
  }

  private updateFacing(champion: Champion, dx: number, dy: number): void {
    const target = champion.target;
    if (target?.alive && (champion.state === "fighting" || champion.state === "sieging" || champion.state === "farming")) {
      const tx = target.pos.x - champion.pos.x;
      const ty = target.pos.y - champion.pos.y;
      if (tx * tx + ty * ty > 4) {
        this.facingY = logicFacingY(tx, ty);
      }
    } else if (this.isMoving) {
      this.facingY = logicFacingY(dx, dy);
    }
    this.mesh.rotation.y = this.facingY;
  }

  private setBaseAction(action: THREE.AnimationAction | null): void {
    if (!action) {
      return;
    }
    this.baseAction = action;
    if (this.attackInFlight) {
      return;
    }
    this.blendTo(action, BASE_BLEND);
  }

  private triggerAttack(champion: Champion): void {
    const attack = this.actions.attack;
    if (!attack) {
      return;
    }

    const clip = attack.getClip();
    const windup = attackWindupSeconds(champion.stats.as);
    this.attackStopTime = clip.duration * ATTACK_CLIP_PORTION;
    if (this.attackInFlight) {
      attack.stop();
    }
    attack.enabled = true;
    attack.reset();
    attack.setLoop(THREE.LoopOnce, 1);
    attack.setEffectiveTimeScale(attackClipTimeScale(clip.duration, windup));
    attack.setEffectiveWeight(1);
    attack.play();
    this.attackInFlight = true;

    const from = this.currentAction;
    if (from && from !== attack) {
      from.crossFadeTo(attack, ATTACK_BLEND, false);
    }
    this.currentAction = attack;
  }

  private updateAttackPlayback(): void {
    const attack = this.actions.attack;
    if (!this.attackInFlight || !attack) {
      return;
    }
    if (attack.time < this.attackStopTime) {
      return;
    }
    this.finishAttack();
  }

  private finishAttack(): void {
    const attack = this.actions.attack;
    this.attackInFlight = false;
    const resume = this.baseAction ?? this.actions.idle;
    if (attack) {
      attack.stop();
      attack.enabled = false;
      if (resume && this.currentAction === attack) {
        resume.enabled = true;
        resume.setEffectiveTimeScale(1);
        resume.setEffectiveWeight(1);
        if (!resume.isRunning()) {
          resume.play();
        }
        attack.crossFadeTo(resume, BASE_BLEND, false);
        this.currentAction = resume;
        return;
      }
    }
    if (resume) {
      this.blendTo(resume, BASE_BLEND);
    }
  }

  private blendTo(action: THREE.AnimationAction, duration: number): void {
    if (this.currentAction === action && action.isRunning()) {
      return;
    }
    const previous = this.currentAction;
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.setLoop(THREE.LoopRepeat, Infinity);
    if (previous && previous !== action) {
      action.play();
      previous.crossFadeTo(action, duration, false);
    } else {
      action.reset().fadeIn(duration).play();
    }
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
