import test from "node:test";
import assert from "node:assert/strict";
import { AccountStore } from "../dist/state/AccountStore.js";
import { SaveManager } from "../dist/state/SaveManager.js";
import { Match } from "../dist/game/simulation/Match.js";
import { Minion } from "../dist/game/entities/Minion.js";
import { getLanePath } from "../dist/data/MapData.js";
import { UtilityBrain } from "../dist/game/ai/UtilityBrain.js";
import { BackportAction } from "../dist/game/ai/actions/BackportAction.js";
import { RetreatAction } from "../dist/game/ai/actions/RetreatAction.js";
import { AttackChampionAction } from "../dist/game/ai/actions/AttackChampionAction.js";
import { FarmMinionAction } from "../dist/game/ai/actions/FarmMinionAction.js";

function createMatch(rngValue = 0.4) {
  const store = new AccountStore(() => 0.2, new SaveManager(`test-ai-account-${rngValue}`));
  store.reset();
  return new Match({
    playerTeam: store.getSelectedRoster(),
    accountLevel: store.account.level,
    rng: () => rngValue
  });
}

test("the coward: a low-HP champion next to a healthy enemy retreats, not fights", () => {
  const match = createMatch();
  const champ = match.champions.find((c) => c.side === "blue" && c.role === "mid");
  const enemy = match.champions.find((c) => c.side === "red" && c.role === "mid");
  assert.ok(champ && enemy);

  champ.pos.x = 600;
  champ.pos.y = 360;
  champ.currentHp = champ.maxHp * 0.1;
  enemy.pos.x = 663;
  enemy.pos.y = 380;
  enemy.currentHp = enemy.maxHp;

  match.update(0); // build the target cache from the configured board and run the brain

  const retreat = new RetreatAction().calculateScore(champ, match);
  const attack = new AttackChampionAction().calculateScore(champ, match);
  const backport = new BackportAction().calculateScore(champ, match);

  assert.ok(retreat > 80, `expected retreat > 80, got ${retreat}`);
  assert.ok(attack < 20, `expected attack < 20, got ${attack}`);
  // Pinned by the enemy, a hard recall is not safe — so retreat carries the play.
  assert.equal(backport, 0);
  assert.ok(champ.state === "retreating" || champ.state === "backing", `state was ${champ.state}`);
});

test("the hunter: a healthy champion with minions dives a low-HP enemy", () => {
  const match = createMatch();
  const champ = match.champions.find((c) => c.side === "blue" && c.role === "top");
  const enemy = match.champions.find((c) => c.side === "red" && c.role === "top");
  assert.ok(champ && enemy);

  champ.pos.x = 600;
  champ.pos.y = 360;
  champ.currentHp = champ.maxHp;
  enemy.pos.x = 660;
  enemy.pos.y = 372;
  enemy.currentHp = enemy.maxHp * 0.2;

  // Two allied minions back up the dive.
  const path = getLanePath("top", "blue");
  match.minions.push(new Minion("blue", "top", "melee", path, 1, { x: 612, y: 360 }));
  match.minions.push(new Minion("blue", "top", "caster", path, 1, { x: 622, y: 372 }));

  match.update(0);

  const attack = new AttackChampionAction().calculateScore(champ, match);
  const farm = new FarmMinionAction().calculateScore(champ, match);

  assert.ok(attack > farm, `expected attack(${attack}) > farm(${farm})`);
  assert.equal(champ.state, "fighting");
  assert.equal(champ.target, enemy);
});

test("healthy laners prefer last-hits over trading at high enemy HP", () => {
  const match = createMatch();
  const champ = match.champions.find((c) => c.side === "blue" && c.role === "mid");
  const enemy = match.champions.find((c) => c.side === "red" && c.role === "mid");
  assert.ok(champ && enemy);

  champ.pos.x = 900;
  champ.pos.y = 900;
  champ.currentHp = champ.maxHp;
  enemy.pos.x = 940;
  enemy.pos.y = 900;
  enemy.currentHp = enemy.maxHp;

  const path = getLanePath("mid", "red");
  const minion = new Minion("red", "mid", "melee", path, 1, { x: 930, y: 900 });
  match.minions.push(minion);
  match.update(0);

  const farm = new FarmMinionAction().calculateScore(champ, match);
  const attack = new AttackChampionAction().calculateScore(champ, match);

  assert.ok(farm > attack, `expected farm(${farm}) > attack(${attack})`);
  assert.equal(attack, 0);
});

test("the brain always commits to exactly one action", () => {
  const match = createMatch();
  match.update(0);
  const brain = new UtilityBrain();
  for (const champ of match.champions.filter((c) => c.alive)) {
    const chosen = brain.select(champ, match);
    assert.ok(chosen, `no action selected for ${champ.role}`);
    const scores = brain.evaluate(champ, match);
    const best = Math.max(...scores.map((entry) => entry.score));
    assert.equal(chosen.calculateScore(champ, match), best);
  }
});
