import test from "node:test";
import assert from "node:assert/strict";
import { calculateAttackPeriod, calculateDamage } from "../dist/game/combat/DamageCalculator.js";

test("damage uses standard resistance mitigation", () => {
  assert.equal(Number(calculateDamage(100, 50).toFixed(3)), 66.667);
  assert.equal(calculateDamage(100, 0), 100);
  assert.equal(calculateDamage(100, -25), 100);
});

test("attack speed maps to attacks per second", () => {
  assert.equal(calculateAttackPeriod(2), 0.5);
  assert.equal(calculateAttackPeriod(1), 1);
});
