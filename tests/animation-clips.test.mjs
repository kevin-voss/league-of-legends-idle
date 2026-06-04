import assert from "node:assert/strict";
import test from "node:test";

test("pickClip prefers short combat gestures over item use", async () => {
  const { pickClip } = await import("../dist/game/visuals/AnimationClips.js");
  const clips = [
    { name: "Use_Item", duration: 1.6 },
    { name: "Hit_A", duration: 0.67 },
    { name: "Interact", duration: 1.3 }
  ];

  const attack = pickClip(clips, ["Interact", "Throw", "Hit_A", "Hit_B"], false);
  assert.equal(attack?.name, "Interact");
});

test("resolveChampionAnimState uses walk while moving in combat", async () => {
  const { resolveChampionAnimState } = await import("../dist/game/visuals/AnimationClips.js");

  assert.equal(resolveChampionAnimState("fighting", true), "walk");
  assert.equal(resolveChampionAnimState("fighting", false), "idle");
  assert.equal(resolveChampionAnimState("sieging", false), "idle");
});

test("attack windup scales with attack speed", async () => {
  const { attackWindupSeconds, attackClipTimeScale } = await import("../dist/game/visuals/CombatAnimation.js");

  const fast = attackWindupSeconds(1.4);
  const slow = attackWindupSeconds(0.6);
  assert.ok(fast < slow);
  assert.ok(attackClipTimeScale(1.3, fast) > 1);
});
