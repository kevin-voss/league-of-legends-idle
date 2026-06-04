import test from "node:test";
import assert from "node:assert/strict";
import { Iso } from "../dist/core/Isometric.js";

test("axis-aligned logic movement becomes diagonal screen movement", () => {
  const origin = Iso.toScreen(0, 0);

  // Walking along +x must shift the screen position both horizontally and
  // vertically — the hallmark of an isometric (not flat top-down) projection.
  const alongX = Iso.toScreen(100, 0);
  assert.notEqual(alongX.x, origin.x);
  assert.notEqual(alongX.y, origin.y);

  // Walking along +y is also diagonal, but mirrors horizontally.
  const alongY = Iso.toScreen(0, 100);
  assert.notEqual(alongY.x, origin.x);
  assert.notEqual(alongY.y, origin.y);
  assert.notEqual(Math.sign(alongX.x - origin.x), Math.sign(alongY.x - origin.x));
});

test("projection uses a 2:1 ratio so circles render as flat ovals", () => {
  const a = Iso.toScreen(0, 0);
  const b = Iso.toScreen(100, 0);
  const horizontal = Math.abs(b.x - a.x);
  const vertical = Math.abs(b.y - a.y);
  assert.equal(horizontal, vertical * 2);
});

test("withHeight lifts a projected point straight up the screen", () => {
  const ground = Iso.toScreen(200, 200);
  const lifted = Iso.withHeight(ground, 60);
  assert.equal(lifted.x, ground.x);
  assert.equal(lifted.y, ground.y - 60);
});

test("depth orders entities from back to front", () => {
  const back = { x: 100, y: 100 };
  const front = { x: 300, y: 300 };
  assert.ok(Iso.depth(front) > Iso.depth(back));
});

test("points sharing an iso column share a screen x and sort by depth", () => {
  const near = Iso.toScreen(150, 50); // x - y = 100
  const far = Iso.toScreen(250, 150); // x - y = 100, deeper
  assert.equal(near.x, far.x);
  assert.ok(far.y > near.y);
});
