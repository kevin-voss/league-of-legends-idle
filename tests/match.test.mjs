import test from "node:test";
import assert from "node:assert/strict";
import { AccountStore } from "../dist/state/AccountStore.js";
import { SaveManager } from "../dist/state/SaveManager.js";
import { Match } from "../dist/game/simulation/Match.js";
import { Minion } from "../dist/game/entities/Minion.js";
import { Spawner } from "../dist/game/map/Spawner.js";
import {
  BASE_POSITIONS,
  JUNGLE_CAMPS,
  JUNGLE_PATHS,
  JUNGLE_QUADRANT_CENTERS,
  MAP_RAILS,
  MIN_JUNGLE_CAMP_SPACING,
  MIN_TOWER_SPACING,
  TOWER_ATTACK_RANGE,
  TOWER_T1_LANE_PROGRESS,
  TOWER_T2_LANE_PROGRESS,
  getEnemySide,
  getLanePath,
  getNexusToEdgeRail,
  mirrorPoint
} from "../dist/data/MapData.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, MATCH_MAX_SECONDS, MATCH_OVERTIME_SECONDS } from "../dist/data/Constants.js";

const MAP_MARGIN = 120;

function createMatch(rngValue = 0.35) {
  const store = new AccountStore(() => 0.2, new SaveManager(`test-match-account-${rngValue}`));
  store.reset();
  return new Match({
    playerTeam: store.getSelectedRoster(),
    accountLevel: store.account.level,
    rng: () => rngValue
  });
}

function structure(match, id) {
  const found = match.structures.find((candidate) => candidate.id === id);
  assert.ok(found, `Expected structure ${id}`);
  return found;
}

test("a full match completes within the configured window", () => {
  const match = createMatch();

  for (let i = 0; i < 9000 && !match.completed; i += 1) {
    match.update(1 / 30);
  }

  const result = match.getResult();
  const losingSide = result.winner === "blue" ? "red" : "blue";
  assert.equal(match.completed, true);
  assert.ok(result.durationSeconds >= 120);
  assert.ok(result.durationSeconds <= MATCH_MAX_SECONDS + MATCH_OVERTIME_SECONDS + 1);
  assert.ok(match.baseHp[losingSide] <= match.baseHp[result.winner]);
  assert.equal(result.championStats.length, 10);
});

test("matches spawn lane towers and nexuses", () => {
  const match = createMatch();
  assert.equal(match.structures.length, 14);
  assert.equal(match.structures.filter((candidate) => candidate.structureType === "tower").length, 12);
  assert.equal(match.structures.filter((candidate) => candidate.structureType === "nexus").length, 2);
  const towers = match.structures.filter((candidate) => candidate.structureType === "tower");
  assert.ok(towers.every((candidate) => candidate.attackRange <= 150));
  assert.ok(towers.every((candidate) => candidate.distanceTo(BASE_POSITIONS[candidate.side]) > 180));
  assert.ok(match.champions.every((champion) => champion.stats.range < towers[0].attackRange));
});

test("inner lane towers are locked until their outer tower falls", () => {
  const match = createMatch();
  const outer = structure(match, "blue_top_t1");
  const inner = structure(match, "blue_top_t2");

  assert.equal(inner.isInvulnerable, true);
  assert.equal(inner.takeDamage(500), 0);
  assert.equal(inner.currentHp, inner.maxHp);

  outer.takeDamage(outer.maxHp);
  match.update(0);

  assert.equal(inner.isInvulnerable, false);
  assert.ok(inner.takeDamage(100) > 0);
});

test("nexus damage requires an active attacker in range after a lane is open", () => {
  const match = createMatch();
  const redNexus = structure(match, "red_nexus");
  const before = redNexus.currentHp;

  match.damageEnemyBase("blue", 900);
  assert.equal(redNexus.currentHp, before);

  for (const tier of [1, 2]) {
    const tower = structure(match, `red_top_t${tier}`);
    tower.takeDamage(tower.maxHp);
    match.update(0);
  }

  match.damageEnemyBase("blue", 900);
  assert.equal(redNexus.currentHp, before);

  const attacker = match.champions.find((champion) => champion.side === "blue");
  assert.ok(attacker);
  attacker.target = redNexus;
  attacker.pos.x = redNexus.pos.x - attacker.stats.range + 4;
  attacker.pos.y = redNexus.pos.y;

  match.damageEnemyBase("blue", 900, attacker);
  assert.ok(redNexus.currentHp < before);
});

test("towers prefer lane minions before enemy champions", () => {
  const match = createMatch();
  const tower = structure(match, "blue_mid_t1");
  const redChampion = match.champions.find((champion) => champion.side === "red");
  assert.ok(redChampion);
  redChampion.pos.x = tower.pos.x + 28;
  redChampion.pos.y = tower.pos.y + 12;

  const minion = new Minion("red", "mid", "melee", getLanePath("mid", "red"), 1, {
    x: tower.pos.x + 18,
    y: tower.pos.y + 8
  });
  match.minions.push(minion);
  match.update(0);

  assert.equal(match.findTargetForStructure(tower), minion);
});

test("dead champions respawn at their base after the timer expires", () => {
  const match = createMatch();
  const champion = match.champions[0];
  champion.die(match);

  assert.equal(champion.alive, false);
  for (let elapsed = 0; elapsed < 25 && !champion.alive; elapsed += 0.25) {
    match.update(0.25);
  }

  assert.equal(champion.alive, true);
  assert.deepEqual({ x: champion.pos.x, y: champion.pos.y }, BASE_POSITIONS[champion.side]);
});

test("top and bot lane layouts mirror each other like a rift map", () => {
  assert.notDeepEqual(getLanePath("bot", "blue"), getLanePath("top", "blue"));
  assert.ok(getLanePath("bot", "blue").length >= 4);
  assert.ok(getLanePath("top", "blue").length >= 4);
  assert.deepEqual(getLanePath("mid", "red"), [...getLanePath("mid", "blue")].reverse());
  assert.notDeepEqual(getLanePath("top", "blue"), getLanePath("mid", "blue"));
  assert.notDeepEqual(getLanePath("bot", "blue"), getLanePath("mid", "blue"));
});

test("lane towers sit directly on mathematically mirrored rails", () => {
  const match = createMatch();

  for (const tower of match.structures.filter((candidate) => candidate.structureType === "tower")) {
    const lanePath =
      tower.tier === 1
        ? getLanePath(tower.lane, getEnemySide(tower.side))
        : getLanePath(tower.lane, tower.side);
    const distance = distanceToPath(tower.pos, lanePath);
    assert.ok(distance < 0.001, `${tower.id} is off its lane rail by ${distance}`);
  }
});

test("same-lane towers keep MOBA spacing without overlapping attack radii", () => {
  const match = createMatch();

  for (const side of ["blue", "red"]) {
    for (const lane of ["top", "mid", "bot"]) {
      const towers = match.structures
        .filter((candidate) => candidate.side === side && candidate.lane === lane && candidate.structureType === "tower")
        .sort((left, right) => left.tier - right.tier);
      const spacing = Math.hypot(towers[1].pos.x - towers[0].pos.x, towers[1].pos.y - towers[0].pos.y);
      assert.ok(spacing >= MIN_TOWER_SPACING, `${side} ${lane} tower spacing ${spacing} < ${MIN_TOWER_SPACING}`);
      assert.ok(spacing >= towers[0].attackRange * 2, `${side} ${lane} attack ranges overlap`);
      assert.equal(towers[0].attackRange, TOWER_ATTACK_RANGE);
    }
  }
});

test("lane towers sit at 35% and 70% progress from nexus to lane edge", () => {
  const match = createMatch();
  const expectedProgress = { 1: TOWER_T1_LANE_PROGRESS, 2: TOWER_T2_LANE_PROGRESS };

  for (const tower of match.structures.filter((candidate) => candidate.structureType === "tower")) {
    const nexusToEdge = getNexusToEdgeRail(tower.lane, tower.side);
    const progress = progressOnPath(tower.pos, nexusToEdge);
    assert.ok(
      Math.abs(progress - expectedProgress[tower.tier]) < 0.01,
      `${tower.id} progress ${progress} expected ${expectedProgress[tower.tier]}`
    );
  }
});

test("opposing minion waves reach T1 towers on roughly the same simulation tick", () => {
  for (const lane of ["top", "mid", "bot"]) {
    const blueTicks = ticksUntilT1Range("blue", lane);
    const redTicks = ticksUntilT1Range("red", lane);
    assert.ok(
      Math.abs(blueTicks - redTicks) <= 80,
      `${lane} T1 arrival tick mismatch: blue ${blueTicks} red ${redTicks}`
    );
  }
});

test("jungle camps stay off the lane paths", () => {
  assert.equal(JUNGLE_CAMPS.filter((camp) => camp.side === "blue").length, 4);
  assert.equal(JUNGLE_CAMPS.filter((camp) => camp.side === "red").length, 4);

  for (const side of ["blue", "red"]) {
    const topCamps = JUNGLE_CAMPS.filter((camp) => camp.side === side && camp.id.includes("-top-"));
    const botCamps = JUNGLE_CAMPS.filter((camp) => camp.side === side && camp.id.includes("-bot-"));
    assert.equal(topCamps.length, 2, `${side} top jungle camp count`);
    assert.equal(botCamps.length, 2, `${side} bot jungle camp count`);

    const topCenter = JUNGLE_QUADRANT_CENTERS[side].top;
    const botCenter = JUNGLE_QUADRANT_CENTERS[side].bot;
    for (const camp of topCamps) {
      assert.ok(
        Math.hypot(camp.x - topCenter.x, camp.y - topCenter.y) < 320,
        `${camp.id} should sit in ${side} top jungle`
      );
    }
    for (const camp of botCamps) {
      assert.ok(
        Math.hypot(camp.x - botCenter.x, camp.y - botCenter.y) < 320,
        `${camp.id} should sit in ${side} bot jungle`
      );
    }
  }

  const blueTop = JUNGLE_QUADRANT_CENTERS.blue.top;
  const blueBot = JUNGLE_QUADRANT_CENTERS.blue.bot;
  assert.ok(blueTop.y < blueBot.y, "blue top jungle sits above bot jungle on the logic plane");

  assert.deepEqual(JUNGLE_QUADRANT_CENTERS.red.top, mirrorPoint(blueBot));
  assert.deepEqual(JUNGLE_QUADRANT_CENTERS.red.bot, mirrorPoint(blueTop));

  for (const camp of JUNGLE_CAMPS) {
    const closestLaneDistance = Math.min(
      ...["top", "mid", "bot"].map((lane) => distanceToPath(camp, getLanePath(lane, camp.side)))
    );
    const midLaneDistance = distanceToPath(camp, getLanePath("mid", camp.side));
    assert.ok(closestLaneDistance > 80, `${camp.id} is too close to a lane: ${closestLaneDistance}`);
    assert.ok(midLaneDistance > 120, `${camp.id} is too close to the mid lane: ${midLaneDistance}`);
  }

  for (const side of ["blue", "red"]) {
    const sideCamps = JUNGLE_CAMPS.filter((camp) => camp.side === side);
    for (let left = 0; left < sideCamps.length; left += 1) {
      for (let right = left + 1; right < sideCamps.length; right += 1) {
        const a = sideCamps[left];
        const b = sideCamps[right];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(
          gap >= MIN_JUNGLE_CAMP_SPACING,
          `${side} camps ${a.id} and ${b.id} are too close: ${gap}`
        );
      }
    }
  }
});

test("bot lane uses an L-shaped path through the southeast river bend on the iso centerline", () => {
  const botBlue = MAP_RAILS.bot.blue;
  assert.deepEqual(botBlue[0], BASE_POSITIONS.blue);
  assert.equal(botBlue[1].x, CANVAS_WIDTH - MAP_MARGIN);
  assert.equal(botBlue[1].y, BASE_POSITIONS.blue.y);
  assert.equal(botBlue[2].x, CANVAS_WIDTH - MAP_MARGIN);
  assert.equal(botBlue[2].y, CANVAS_HEIGHT - MAP_MARGIN);
});

test("each side clears bot jungle before top jungle", () => {
  for (const side of ["blue", "red"]) {
    const path = JUNGLE_PATHS[side];
    const botCamps = JUNGLE_CAMPS.filter((camp) => camp.side === side && camp.id.includes("-bot-"));
    const topCamps = JUNGLE_CAMPS.filter((camp) => camp.side === side && camp.id.includes("-top-"));
    assert.deepEqual(path[0], BASE_POSITIONS[side]);
    assert.deepEqual(path.slice(1, 3), botCamps);
    assert.deepEqual(path.slice(3, 5), topCamps);
  }
});

test("jungle camps have a steady respawn timer", () => {
  const match = createMatch();
  const camps = match.monsters.filter((monster) => monster.monsterType === "camp");

  assert.equal(camps.length, 8);
  assert.ok(camps.every((camp) => camp.respawnSeconds === 30));
});

test("low health champions backport for three seconds and heal at base", () => {
  const match = createMatch();
  const champion = match.champions[0];
  champion.currentHp = champion.maxHp * 0.2;
  champion.pos.x = 500;
  champion.pos.y = 500;

  match.update(0.1);

  assert.equal(champion.state, "backing");
  assert.ok(champion.backTimer <= 3);

  match.update(3);

  assert.equal(champion.alive, true);
  assert.equal(champion.currentHp, champion.maxHp);
  assert.deepEqual({ x: champion.pos.x, y: champion.pos.y }, BASE_POSITIONS[champion.side]);
});

test("taking damage during the recall channel cancels the backport", () => {
  const match = createMatch();
  const champion = match.champions[0];
  champion.currentHp = champion.maxHp * 0.2;
  champion.pos.x = 500;
  champion.pos.y = 500;

  match.update(0.1);
  assert.equal(champion.state, "backing");

  // A tower shot lands mid-channel: the recall must break, not teleport home.
  const attacker = match.champions.find((candidate) => candidate.side === "red");
  match.applyDamage(attacker, champion, 40, "physical", "Tower");
  match.update(0.1);

  assert.notEqual(champion.state, "backing");
  assert.notDeepEqual({ x: champion.pos.x, y: champion.pos.y }, BASE_POSITIONS[champion.side]);
});

test("destroying both lane turrets makes attackers push and defenders collapse", () => {
  const match = createMatch();
  const attacker = match.champions.find((champion) => champion.side === "blue");
  assert.ok(attacker);
  const outer = structure(match, "red_top_t1");
  const inner = structure(match, "red_top_t2");

  match.applyDamage(attacker, outer, outer.maxHp, "physical", "Test");
  match.update(0);
  match.applyDamage(attacker, inner, inner.maxHp, "physical", "Test");

  const topLaners = match.champions.filter((champion) => champion.role === "top");
  assert.ok(topLaners.every((champion) => champion.rotationLane === "top"));
  assert.ok(topLaners.filter((champion) => champion.side === "blue").every((champion) => champion.rotationIntent === "push"));
  assert.ok(topLaners.filter((champion) => champion.side === "red").every((champion) => champion.rotationIntent === "defend"));
  assert.ok(match.champions.filter((champion) => champion.role === "jungle").every((champion) => champion.rotationLane === null));
});

test("each lane wave spawns seven minions per side", () => {
  const spawner = new Spawner();
  const wave = spawner.spawnWave("blue", "mid", 1);
  assert.equal(wave.length, 7);
  assert.ok(wave.every((minion) => minion.speed === 95));
});

test("champions only siege towers while allied minions are tanking", () => {
  const match = createMatch();
  const tower = structure(match, "red_mid_t1");
  const champion = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "mid");
  assert.ok(champion);

  champion.pos.x = tower.pos.x - 80;
  champion.pos.y = tower.pos.y;
  match.update(0);

  assert.equal(match.findTargetForChampion(champion), null);

  const minion = new Minion("blue", "mid", "melee", getLanePath("mid", "blue"), 1, {
    x: tower.pos.x - 18,
    y: tower.pos.y + 8
  });
  match.minions.push(minion);
  match.update(0);

  assert.equal(match.findTargetForChampion(champion), tower);
});

test("champions retreat from enemy tower range when the wave is gone", () => {
  const match = createMatch();
  const tower = structure(match, "red_mid_t1");
  const champion = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "mid");
  assert.ok(champion);

  champion.pos.x = tower.pos.x - 36;
  champion.pos.y = tower.pos.y;
  match.update(0.5);

  assert.equal(champion.state, "retreating");
  assert.equal(champion.target, null);
  assert.ok(champion.distanceTo(tower) > 36);
});

function getHalfRail(lane, side) {
  const path = getLanePath(lane, side);
  const clashIndex = Math.floor((path.length - 1) / 2);
  return path.slice(0, clashIndex + 1);
}

function progressOnPath(point, path) {
  let totalLength = 0;
  const segments = [];

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length, startDistance: totalLength });
    totalLength += length;
  }

  let closestDistance = Number.POSITIVE_INFINITY;
  let closestProgress = 0;

  for (const segment of segments) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / (dx * dx + dy * dy))
    );
    const x = segment.start.x + t * dx;
    const y = segment.start.y + t * dy;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestProgress = (segment.startDistance + t * segment.length) / totalLength;
    }
  }

  return closestProgress;
}

function distanceToPath(point, path) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, path[index - 1], path[index]));
  }
  return closest;
}

function ticksUntilT1Range(side, lane) {
  const spawner = new Spawner();
  const minion = spawner.spawnWave(side, lane, 1)[0];
  const match = createMatch();
  const targetTower = structure(match, `${getEnemySide(side)}_${lane}_t1`);
  const dt = 1 / 30;

  for (let ticks = 0; ticks < 4000; ticks += 1) {
    if (minion.distanceTo(targetTower) <= minion.attackRange) {
      return ticks;
    }

    minion.pathIndex = minion.moveAlongPath(minion.path, minion.pathIndex, dt);
  }

  assert.fail(`${side} ${lane} minion did not reach the opposing T1`);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}
