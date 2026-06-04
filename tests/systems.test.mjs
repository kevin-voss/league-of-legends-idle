import test from "node:test";
import assert from "node:assert/strict";
import { AccountStore } from "../dist/state/AccountStore.js";
import { SaveManager } from "../dist/state/SaveManager.js";
import { Match } from "../dist/game/simulation/Match.js";
import { Minion } from "../dist/game/entities/Minion.js";
import { Structure } from "../dist/game/entities/Structure.js";
import { getLanePath } from "../dist/data/MapData.js";
import {
  BARON_BUFF_DURATION,
  DRAGON_LEVEL_REQUIREMENT,
  DRAGON_SPAWN_SECONDS,
  KILL_BUFF_BONUS,
  MATCH_LEVEL_CAP,
  matchLevelXpRequirement
} from "../dist/data/Constants.js";

function createMatch(rngValue = 0.4) {
  const store = new AccountStore(() => 0.2, new SaveManager(`test-systems-${rngValue}-${Math.random()}`));
  store.reset();
  return new Match({
    playerTeam: store.getSelectedRoster(),
    accountLevel: store.account.level,
    rng: () => rngValue
  });
}

test("champions gain in-match experience and level from 1 toward 18", () => {
  const match = createMatch();
  const champion = match.champions[0];

  assert.equal(champion.matchLevel, 1);
  champion.gainXp(matchLevelXpRequirement(1));
  assert.equal(champion.matchLevel, 2);

  // Leveling raises combat stats.
  const adAtTwo = champion.stats.ad;
  for (let level = 2; level < MATCH_LEVEL_CAP; level += 1) {
    champion.gainXp(matchLevelXpRequirement(level));
  }
  assert.equal(champion.matchLevel, MATCH_LEVEL_CAP);
  assert.ok(champion.stats.ad > adAtTwo);

  // The cap holds even with overflow experience.
  champion.gainXp(99999);
  assert.equal(champion.matchLevel, MATCH_LEVEL_CAP);
});

test("nearby champions soak experience when a minion dies", () => {
  const match = createMatch();
  match.update(0); // populate the target cache

  const champion = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "mid");
  assert.ok(champion);
  const minion = new Minion("red", "mid", "melee", getLanePath("mid", "red"), 1, { x: champion.pos.x, y: champion.pos.y });
  minion.currentHp = 1;
  match.minions.push(minion);

  const xpBefore = champion.matchXp;
  match.applyDamage(champion, minion, 9999, "physical", "test");

  assert.equal(champion.statsLine.creepScore, 1);
  assert.ok(champion.matchXp > xpBefore || champion.matchLevel > 1);
});

test("a champion kill registers a death, a kill, and a 30s empowerment buff", () => {
  const match = createMatch();
  const killer = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "adc");
  const victim = match.champions.find((candidate) => candidate.side === "red" && candidate.role === "adc");
  assert.ok(killer && victim);

  victim.currentHp = 1;
  match.applyDamage(killer, victim, 9999, "physical", "test");

  assert.equal(killer.statsLine.kills, 1);
  assert.equal(victim.statsLine.deaths, 1);
  assert.equal(victim.alive, false);
  const killBuff = killer.buffs.find((buff) => buff.id === "kill");
  assert.ok(killBuff);
  assert.equal(killBuff.bonus, KILL_BUFF_BONUS);
  assert.ok(killBuff.remaining > 0 && killBuff.remaining <= 30);
});

test("dragon grants a permanent stacking team buff, baron grants a timed one", () => {
  const match = createMatch();
  const dragon = match.monsters.find((monster) => monster.monsterType === "dragon");
  const jungler = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "jungle");
  dragon.alive = true;
  dragon.currentHp = 1;
  match.applyDamage(jungler, dragon, 9999, "physical", "test");

  const blueTeam = match.champions.filter((candidate) => candidate.side === "blue");
  assert.ok(blueTeam.every((candidate) => candidate.buffs.some((buff) => buff.id === "dragon")));
  assert.equal(blueTeam[0].buffs.find((buff) => buff.id === "dragon").remaining, Number.POSITIVE_INFINITY);

  const baron = match.monsters.find((monster) => monster.monsterType === "baron");
  match.elapsedSeconds = 200;
  baron.alive = true;
  baron.currentHp = 1;
  match.applyDamage(jungler, baron, 9999, "physical", "test");
  const baronBuff = blueTeam[0].buffs.find((buff) => buff.id === "baron");
  assert.ok(baronBuff);
  assert.ok(baronBuff.remaining > 0 && baronBuff.remaining <= BARON_BUFF_DURATION);
});

test("junglers only contest neutral objectives once they meet the level requirement", () => {
  const match = createMatch();
  match.elapsedSeconds = DRAGON_SPAWN_SECONDS + 1;
  const dragon = match.monsters.find((monster) => monster.monsterType === "dragon");
  dragon.alive = true;
  dragon.currentHp = dragon.maxHp;
  const jungler = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "jungle");

  jungler.matchLevel = 1;
  assert.equal(match.findObjectiveForJungler(jungler), null);

  jungler.matchLevel = DRAGON_LEVEL_REQUIREMENT;
  const objective = match.findObjectiveForJungler(jungler);
  assert.ok(objective);
  assert.equal(objective.monsterType, "dragon");
});

test("junglers never siege structures or push lane minions", () => {
  const match = createMatch(0.55);
  let structureTargets = 0;
  let laneMinionTargets = 0;

  for (let i = 0; i < 9000 && !match.completed; i += 1) {
    match.update(1 / 30);
    for (const jungler of match.champions.filter((candidate) => candidate.role === "jungle" && candidate.alive)) {
      if (jungler.target instanceof Structure) {
        structureTargets += 1;
      }
      if (jungler.target && jungler.target.kind === "minion") {
        laneMinionTargets += 1;
      }
    }
  }

  assert.equal(structureTargets, 0);
  assert.equal(laneMinionTargets, 0);
});

test("laners last-hit enemy minions for gold and creep score", () => {
  const match = createMatch();
  const laner = match.champions.find((candidate) => candidate.side === "blue" && candidate.role === "mid");
  assert.ok(laner);

  for (const champion of match.champions) {
    if (champion !== laner) {
      champion.pos.x = 40;
      champion.pos.y = 40;
    }
  }

  laner.pos.x = 900;
  laner.pos.y = 900;
  const path = getLanePath("mid", "red");
  const minion = new Minion("red", "mid", "melee", path, 1, { x: 940, y: 900 });
  match.minions.push(minion);
  match.update(0);
  minion.currentHp = 1;

  assert.equal(match.findTargetForChampion(laner), minion);

  const goldBefore = laner.statsLine.gold;
  const csBefore = laner.statsLine.creepScore;
  for (let i = 0; i < 180 && minion.alive; i += 1) {
    match.update(1 / 30);
  }

  assert.equal(minion.alive, false);
  assert.ok(laner.statsLine.creepScore > csBefore);
  assert.ok(laner.statsLine.gold > goldBefore);
});

test("winning requires structural progress, not just a clock advantage", () => {
  for (const seed of [0.2, 0.4, 0.6, 0.8]) {
    const match = createMatch(seed);
    for (let i = 0; i < 15000 && !match.completed; i += 1) {
      match.update(1 / 30);
    }

    const result = match.getResult();
    const loser = result.winner === "blue" ? "red" : "blue";
    const towersWinnerTook = match.structures.filter(
      (structure) => structure.side === loser && structure.structureType === "tower" && !structure.alive
    ).length;
    const structureDamage = match.structures
      .filter((structure) => structure.side === loser)
      .reduce((total, structure) => total + (structure.maxHp - structure.currentHp), 0);

    assert.ok(
      match.baseHp[loser] <= 0 || towersWinnerTook > 0 || structureDamage > 0,
      `seed ${seed}: winner ${result.winner} made no structural progress`
    );
    assert.ok(match.baseHp[loser] <= match.baseHp[result.winner]);
  }
});
