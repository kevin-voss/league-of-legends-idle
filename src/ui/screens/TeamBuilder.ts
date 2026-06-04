import { ROLE_LABELS, ROLES, TIER_ORDER } from "../../data/Constants.js";
import type { ChampionSelection, Role } from "../../data/models.js";
import type { AccountStore } from "../../state/AccountStore.js";
import { createButton } from "../components/Button.js";
import { createChampionCard } from "../components/ChampionCard.js";

type RoleFilter = Role | "all";
type SortMode = "level" | "rarity";

export function createTeamBuilderScreen(store: AccountStore, onBack: () => void, onStartMatch: () => void): HTMLElement {
  const shell = document.createElement("main");
  shell.className = "app-shell";
  let roleFilter: RoleFilter = "all";
  let sortMode: SortMode = "level";

  function render(): void {
    shell.replaceChildren();
    const topBar = document.createElement("div");
    topBar.className = "top-bar";
    const title = document.createElement("div");
    title.className = "screen-title";
    const h1 = document.createElement("h1");
    h1.textContent = "Team Builder";
    const status = document.createElement("span");
    status.textContent = store.isTeamValid() ? "5 roles selected" : "Select one champion per role";
    title.append(h1, status);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      createButton("Home", onBack, { variant: "ghost" }),
      createButton("Start", onStartMatch, { variant: "primary", disabled: !store.isTeamValid() })
    );
    topBar.append(title, actions);

    const layout = document.createElement("section");
    layout.className = "builder-layout";

    const selectedPanel = document.createElement("aside");
    selectedPanel.className = "panel";
    selectedPanel.append(panelHeader("Selected Team"));
    const selectedList = document.createElement("div");
    selectedList.className = "role-pick-list";
    const selectedByRole = store.getSelectedByRole();
    for (const role of ROLES) {
      selectedList.append(createRoleSlot(role, selectedByRole[role], store, render));
    }
    selectedPanel.append(selectedList);

    const rosterPanel = document.createElement("section");
    rosterPanel.className = "panel";
    rosterPanel.append(panelHeader("Roster"), createBuilderControls(roleFilter, sortMode, (nextRole) => {
      roleFilter = nextRole;
      render();
    }, (nextSort) => {
      sortMode = nextSort;
      render();
    }));
    const roster = document.createElement("div");
    roster.className = "roster-grid";
    const selections = store.getOwnedWithTemplates()
      .filter((selection) => roleFilter === "all" || selection.template.role === roleFilter)
      .sort((a, b) => compareSelections(a, b, sortMode, store));

    for (const selection of selections) {
      const selected = store.account.selectedTeam.includes(selection.owned.uid);
      const roleLocked = store.isRoleLocked(selection.template.role);
      roster.append(createChampionCard(selection, {
        selectable: true,
        selected,
        disabled: roleLocked && !selected,
        favorite: store.isFavoriteChampion(selection.owned.uid),
        locked: store.isLockedChampion(selection.owned.uid),
        onSelect: (uid) => {
          store.selectChampion(uid);
          render();
        },
        onFavorite: (uid) => {
          store.toggleFavoriteChampion(uid);
          render();
        },
        onLock: (uid) => {
          store.toggleLockedChampion(uid);
          render();
        }
      }));
    }
    rosterPanel.append(roster);

    layout.append(selectedPanel, rosterPanel);
    shell.append(topBar, layout);
  }

  render();
  return shell;
}

function createRoleSlot(role: Role, selection: ChampionSelection | undefined, store: AccountStore, onChange: () => void): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "lane-section";
  const title = document.createElement("h3");
  title.className = "section-title";
  title.textContent = ROLE_LABELS[role];
  wrapper.append(title);

  if (selection) {
    wrapper.append(createChampionCard(selection, {
      selected: true,
      favorite: store.isFavoriteChampion(selection.owned.uid),
      locked: store.isLockedChampion(selection.owned.uid),
      onFavorite: (uid) => {
        store.toggleFavoriteChampion(uid);
        onChange();
      },
      onLock: (uid) => {
        store.toggleLockedChampion(uid);
        onChange();
      }
    }));
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-slot";
    empty.textContent = "Open slot";
    wrapper.append(empty);
  }

  return wrapper;
}

function createBuilderControls(
  roleFilter: RoleFilter,
  sortMode: SortMode,
  onRole: (role: RoleFilter) => void,
  onSort: (sort: SortMode) => void
): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "builder-controls";

  const sortGroup = document.createElement("div");
  sortGroup.className = "segmented-control";
  sortGroup.append(
    createButton("Level", () => onSort("level"), { active: sortMode === "level", title: "Sort by champion level" }),
    createButton("Rarity", () => onSort("rarity"), { active: sortMode === "rarity", title: "Sort by rarity" })
  );

  const roleGroup = document.createElement("div");
  roleGroup.className = "role-tabs";
  roleGroup.append(createButton("All", () => onRole("all"), { active: roleFilter === "all", title: "Show all roles" }));
  for (const role of ROLES) {
    roleGroup.append(createButton(ROLE_LABELS[role], () => onRole(role), { active: roleFilter === role, title: `Show ${ROLE_LABELS[role]} champions` }));
  }

  controls.append(sortGroup, roleGroup);
  return controls;
}

function compareSelections(a: ChampionSelection, b: ChampionSelection, sortMode: SortMode, store: AccountStore): number {
  const favoriteDelta = Number(store.isFavoriteChampion(b.owned.uid)) - Number(store.isFavoriteChampion(a.owned.uid));
  if (favoriteDelta !== 0) {
    return favoriteDelta;
  }

  if (sortMode === "level") {
    const levelDelta = b.owned.level - a.owned.level;
    if (levelDelta !== 0) {
      return levelDelta;
    }
  } else {
    const rarityDelta = TIER_ORDER.indexOf(b.template.tier) - TIER_ORDER.indexOf(a.template.tier);
    if (rarityDelta !== 0) {
      return rarityDelta;
    }
  }

  return a.template.name.localeCompare(b.template.name);
}

function panelHeader(text: string): HTMLElement {
  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h2");
  heading.textContent = text;
  header.append(heading);
  return header;
}
