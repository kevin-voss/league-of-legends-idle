import { ACCOUNT_XP_PER_LEVEL, GAME_TITLE } from "../../data/Constants.js";
                                                                
import { createButton } from "../components/Button.js";
import { createChampionCard } from "../components/ChampionCard.js";

export function createHomeScreen(store              , onTeamBuilder            , onStartMatch            , onReset            )              {
  const shell = document.createElement("main");
  shell.className = "app-shell";

  const topBar = document.createElement("div");
  topBar.className = "top-bar";

  const brand = document.createElement("div");
  brand.className = "brand";
  const title = document.createElement("h1");
  title.textContent = GAME_TITLE;
  const subtitle = document.createElement("span");
  subtitle.textContent = "Idle auto-battler";
  brand.append(title, subtitle);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    createButton("Team", onTeamBuilder, { variant: "ghost" }),
    createButton("Start", onStartMatch, { variant: "primary", disabled: !store.isTeamValid() }),
    createButton("Reset", onReset, { variant: "danger" })
  );
  topBar.append(brand, actions);

  const grid = document.createElement("section");
  grid.className = "dashboard-grid";

  const accountPanel = document.createElement("aside");
  accountPanel.className = "panel";
  const accountHeader = panelHeader("Account");
  const stats = document.createElement("div");
  stats.className = "stat-stack";
  stats.append(
    statRow("Level", String(store.account.level)),
    statRow("XP", `${store.account.experience} / ${ACCOUNT_XP_PER_LEVEL}`),
    statRow("Gold", store.account.gold.toLocaleString()),
    statRow("Owned", String(store.account.ownedChampions.length))
  );
  accountPanel.append(accountHeader, stats);

  const rosterPanel = document.createElement("section");
  rosterPanel.className = "panel";
  rosterPanel.append(panelHeader("Owned Champions"));
  const roster = document.createElement("div");
  roster.className = "roster-grid";
  for (const selection of store.getOwnedWithTemplates()) {
    roster.append(createChampionCard(selection, { selected: store.account.selectedTeam.includes(selection.owned.uid) }));
  }
  rosterPanel.append(roster);

  grid.append(accountPanel, rosterPanel);
  shell.append(topBar, grid);
  return shell;
}

function panelHeader(text        )              {
  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h2");
  heading.textContent = text;
  header.append(heading);
  return header;
}

function statRow(label        , value        )              {
  const row = document.createElement("div");
  row.className = "stat-row";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
}
