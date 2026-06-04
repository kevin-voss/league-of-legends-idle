import type { AnimationClip } from "three";
import type { ChampionAIState } from "../../data/models.js";

const IDLE_NAMES = ["Idle", "Idle_A", "Idle_B"];
const WALK_NAMES = ["Walk", "Walk_A", "Run", "Run_A"];
const ATTACK_NAMES = ["Attack", "Attack_A", "Melee_Attack", "Hit_A", "Hit"];

export function pickClip(clips: AnimationClip[], names: string[]): AnimationClip | null {
  for (const name of names) {
    const exact = clips.find((clip) => clip.name === name);
    if (exact) {
      return exact;
    }
    const partial = clips.find((clip) => clip.name.includes(name));
    if (partial) {
      return partial;
    }
  }
  return clips[0] ?? null;
}

export function resolveChampionAnimState(state: ChampionAIState): "idle" | "walk" | "attack" {
  if (state === "fighting" || state === "sieging") {
    return "attack";
  }
  if (
    state === "movingToLane" ||
    state === "rotating" ||
    state === "movingToObjective" ||
    state === "movingToGank" ||
    state === "retreating"
  ) {
    return "walk";
  }
  return "idle";
}

export function clipsForState(clips: AnimationClip[], anim: "idle" | "walk" | "attack"): AnimationClip | null {
  if (anim === "attack") {
    return pickClip(clips, ATTACK_NAMES);
  }
  if (anim === "walk") {
    return pickClip(clips, WALK_NAMES);
  }
  return pickClip(clips, IDLE_NAMES);
}
