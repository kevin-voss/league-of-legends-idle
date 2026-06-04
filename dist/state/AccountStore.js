import { ACCOUNT_XP_PER_LEVEL, DROP_RATES, PITY_LIMITS, ROLES, STARTING_TEMPLATE_IDS, STORAGE_KEY, TIER_ORDER, TIER_UNLOCK_LEVEL } from "../data/Constants.js";
import { createOwnedChampion, getChampionTemplate, getRandomChampionOfTier } from "../data/Champions.js";
                                                                                                                                                 
import { SaveManager } from "./SaveManager.js";

export class AccountStore {
  account              ;
          saveManager                           ;
          rng              ;

  constructor(rng               = Math.random, saveManager = new SaveManager              (STORAGE_KEY)) {
    this.rng = rng;
    this.saveManager = saveManager;
    this.account = this.saveManager.load() ?? createDefaultAccount();
    this.normalize();
    this.save();
  }

  getOwnedWithTemplates()                      {
    return this.account.ownedChampions.map((owned) => ({ owned, template: getChampionTemplate(owned.templateId) }));
  }

  getSelectedRoster()                      {
    const ownedByUid = new Map(this.getOwnedWithTemplates().map((selection) => [selection.owned.uid, selection]));
    return this.account.selectedTeam
      .map((uid) => ownedByUid.get(uid))
      .filter((selection)                                 => Boolean(selection));
  }

  getSelectedByRole()                                           {
    const selected                                           = {};
    for (const selection of this.getSelectedRoster()) {
      selected[selection.template.role] = selection;
    }
    return selected;
  }

  selectChampion(uid        )       {
    const selection = this.getOwnedWithTemplates().find((candidate) => candidate.owned.uid === uid);
    if (!selection) {
      return;
    }

    const role = selection.template.role;
    const lockedForRole = this.getSelectedRoster()
      .find((candidate) => candidate.template.role === role && this.account.lockedChampionUids.includes(candidate.owned.uid));
    if (lockedForRole && lockedForRole.owned.uid !== uid) {
      return;
    }

    const others = this.getSelectedRoster()
      .filter((candidate) => candidate.template.role !== role)
      .map((candidate) => candidate.owned.uid);
    this.account.selectedTeam = [...others, uid];
    this.save();
  }

  toggleFavoriteChampion(uid        )       {
    this.toggleUidList("favoriteChampionUids", uid);
  }

  toggleLockedChampion(uid        )       {
    const selection = this.getOwnedWithTemplates().find((candidate) => candidate.owned.uid === uid);
    if (!selection) {
      return;
    }

    if (!this.account.selectedTeam.includes(uid)) {
      this.selectChampion(uid);
    }

    if (!this.account.selectedTeam.includes(uid)) {
      return;
    }

    this.toggleUidList("lockedChampionUids", uid);
  }

  isFavoriteChampion(uid        )          {
    return this.account.favoriteChampionUids.includes(uid);
  }

  isLockedChampion(uid        )          {
    return this.account.lockedChampionUids.includes(uid);
  }

  isRoleLocked(role      )          {
    return this.getSelectedRoster().some((selection) =>
      selection.template.role === role &&
      this.isLockedChampion(selection.owned.uid)
    );
  }

  setSelectedTeam(uids          )       {
    this.account.selectedTeam = [...new Set(uids)];
    this.save();
  }

  isTeamValid()          {
    const roles = this.getSelectedRoster().map((selection) => selection.template.role);
    return ROLES.every((role) => roles.filter((candidate) => candidate === role).length === 1);
  }

  completeMatch(result             )               {
    this.account.gold += result.goldEarned;
    const previousLevel = this.account.level;
    this.addAccountXp(result.accountXpEarned);

    const selectedUids = new Set(this.account.selectedTeam);
    for (const owned of this.account.ownedChampions) {
      if (selectedUids.has(owned.uid)) {
        addChampionXp(owned, result.championXpEarned);
      }
    }

    const droppedTemplate = rollChampion(this.account.level, this.account, this.rng);
    const droppedChampion = droppedTemplate ? createOwnedChampion(droppedTemplate.id, 1, "drop") : null;
    if (droppedChampion) {
      this.account.ownedChampions.push(droppedChampion);
    }

    this.normalize();
    this.save();

    return {
      goldEarned: result.goldEarned,
      accountXpEarned: result.accountXpEarned,
      championXpEarned: result.championXpEarned,
      accountLeveled: this.account.level > previousLevel,
      droppedChampion,
      droppedTemplate
    };
  }

  reset()       {
    this.account = createDefaultAccount();
    this.save();
  }

  save()       {
    this.saveManager.save(this.account);
  }

          addAccountXp(amount        )       {
    this.account.experience += amount;
    while (this.account.experience >= ACCOUNT_XP_PER_LEVEL) {
      this.account.experience -= ACCOUNT_XP_PER_LEVEL;
      this.account.level += 1;
    }
  }

          normalize()       {
    this.account.favoriteChampionUids ??= [];
    this.account.lockedChampionUids ??= [];

    for (const tier of TIER_ORDER) {
      this.account.pityCounters[tier] ??= 0;
    }

    const ownedUids = new Set(this.account.ownedChampions.map((champion) => champion.uid));
    this.account.selectedTeam = this.account.selectedTeam.filter((uid) => ownedUids.has(uid));
    this.account.favoriteChampionUids = [...new Set(this.account.favoriteChampionUids.filter((uid) => ownedUids.has(uid)))];
    this.account.lockedChampionUids = [...new Set(this.account.lockedChampionUids.filter((uid) => ownedUids.has(uid)))];

    for (const role of ROLES) {
      const hasRole = this.getSelectedRoster().some((selection) => selection.template.role === role);
      if (!hasRole) {
        const firstOwned = this.getOwnedWithTemplates().find((selection) => selection.template.role === role);
        if (firstOwned) {
          this.account.selectedTeam.push(firstOwned.owned.uid);
        }
      }
    }

    const selectedUids = new Set(this.account.selectedTeam);
    this.account.lockedChampionUids = this.account.lockedChampionUids.filter((uid) => selectedUids.has(uid));
  }

          toggleUidList(key                                               , uid        )       {
    const values = new Set(this.account[key]);
    if (values.has(uid)) {
      values.delete(uid);
    } else {
      values.add(uid);
    }
    this.account[key] = [...values];
    this.save();
  }
}

export function createDefaultAccount()               {
  const ownedChampions = STARTING_TEMPLATE_IDS.map((templateId, index) => ({
    uid: `starter-${index}-${templateId}`,
    templateId,
    level: 1,
    experience: 0
  }));

  return {
    level: 1,
    experience: 0,
    gold: 250,
    ownedChampions,
    selectedTeam: ownedChampions.map((champion) => champion.uid),
    favoriteChampionUids: [],
    lockedChampionUids: [],
    pityCounters: {
      D: 0,
      C: 0,
      B: 0,
      A: 0,
      S: 0,
      "S+": 0
    }
  };
}

export function getTierForLevel(accountLevel        )       {
  let tier       = "D";
  for (const candidate of TIER_ORDER) {
    if (accountLevel >= TIER_UNLOCK_LEVEL[candidate]) {
      tier = candidate;
    }
  }
  return tier;
}

export function rollChampion(accountLevel        , account              , rng               = Math.random)                          {
  const tier = getTierForLevel(accountLevel);
  const roll = rng();
  const pityLimit = PITY_LIMITS[tier] ?? Number.POSITIVE_INFINITY;

  if (roll <= DROP_RATES[tier]) {
    account.pityCounters[tier] = 0;
    return getRandomChampionOfTier(tier, rng);
  }

  account.pityCounters[tier] += 1;
  if (account.pityCounters[tier] >= pityLimit) {
    account.pityCounters[tier] = 0;
    return getRandomChampionOfTier(tier, rng);
  }

  return null;
}

function addChampionXp(champion               , amount        )       {
  champion.experience += amount;
  let threshold = getChampionLevelThreshold(champion.level);
  while (champion.experience >= threshold) {
    champion.experience -= threshold;
    champion.level += 1;
    threshold = getChampionLevelThreshold(champion.level);
  }
}

function getChampionLevelThreshold(level        )         {
  return 80 + level * 35;
}
