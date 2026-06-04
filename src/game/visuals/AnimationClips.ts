import type { AnimationClip } from "three";
import type { ChampionAIState } from "../../data/models.js";

const IDLE_NAMES = ["Idle_A", "Idle_B", "Idle"];
const WALK_NAMES = ["Walking_A", "Walking_B", "Running_A", "Running_B", "Walk", "Run"];
/** Short general clips; played partially and time-scaled to match auto-attack cadence. */
const ATTACK_NAMES = ["Interact", "Throw", "Hit_A", "Hit_B"];

export function pickClip(clips: AnimationClip[], names: string[], allowFallback = true): AnimationClip | null {
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
  return allowFallback ? (clips[0] ?? null) : null;
}

export function resolveChampionAnimState(state: ChampionAIState, moving: boolean): "idle" | "walk" {
  if (
    moving ||
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
    return pickClip(clips, ATTACK_NAMES, false);
  }
  if (anim === "walk") {
    return pickClip(clips, WALK_NAMES);
  }
  return pickClip(clips, IDLE_NAMES);
}
