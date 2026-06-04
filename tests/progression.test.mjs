import test from "node:test";
import assert from "node:assert/strict";
import { AccountStore, createDefaultAccount, rollChampion } from "../dist/state/AccountStore.js";
import { SaveManager } from "../dist/state/SaveManager.js";

test("default account starts with a valid five-role team", () => {
  const store = new AccountStore(() => 0, new SaveManager("test-default-account"));
  store.reset();
  assert.equal(store.account.ownedChampions.length, 5);
  assert.equal(store.isTeamValid(), true);
});

test("S+ pity guarantees a drop on the tenth failed roll", () => {
  const account = createDefaultAccount();
  account.level = 50;
  account.pityCounters["S+"] = 9;
  const values = [0.99, 0];
  const drop = rollChampion(account.level, account, () => values.shift() ?? 0);
  assert.ok(drop);
  assert.equal(drop.tier, "S+");
  assert.equal(account.pityCounters["S+"], 0);
});
