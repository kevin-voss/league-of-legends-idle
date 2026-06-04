                                                                      
import { createButton } from "../components/Button.js";
import { createChampionCard } from "../components/ChampionCard.js";

export function createResultScreen(result             , rewards              , onHome            , onReplay            )              {
  const shell = document.createElement("main");
  shell.className = "app-shell result-panel";

  const topBar = document.createElement("div");
  topBar.className = "top-bar";
  const title = document.createElement("div");
  title.className = "screen-title";
  const h1 = document.createElement("h1");
  h1.textContent = result.playerWon ? "Victory" : "Defeat";
  const subtitle = document.createElement("span");
  subtitle.textContent = `${formatTime(result.durationSeconds)} match`;
  title.append(h1, subtitle);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  actions.append(createButton("Home", onHome, { variant: "ghost" }), createButton("Replay", onReplay, { variant: "primary" }));
  topBar.append(title, actions);

  const rewardBanner = document.createElement("section");
  rewardBanner.className = "reward-banner";
  const rewardTitle = document.createElement("h2");
  rewardTitle.className = "section-title";
  rewardTitle.textContent = "Rewards";
  const rewardText = document.createElement("p");
  rewardText.textContent = `${rewards.goldEarned} gold, ${rewards.accountXpEarned} account XP, ${rewards.championXpEarned} champion XP`;
  rewardBanner.append(rewardTitle, rewardText);

  if (rewards.droppedChampion && rewards.droppedTemplate) {
    rewardBanner.append(createChampionCard({ owned: rewards.droppedChampion, template: rewards.droppedTemplate }));
  } else {
    const pity = document.createElement("p");
    pity.className = "muted";
    pity.textContent = "No champion drop this time";
    rewardBanner.append(pity);
  }

  const tablePanel = document.createElement("section");
  tablePanel.className = "panel";
  tablePanel.append(panelHeader("Match Stats"));
  tablePanel.append(createStatsTable(result));

  shell.append(topBar, rewardBanner, tablePanel);
  return shell;
}

function createStatsTable(result             )              {
  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["Champion", "Side", "Lvl", "K", "D", "A", "CS", "Damage", "Gold"]) {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  }
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  for (const stats of result.championStats) {
    const row = document.createElement("tr");
    for (const value of [
      stats.name,
      stats.side,
      String(stats.level),
      String(stats.kills),
      String(stats.deaths),
      String(stats.assists),
      String(stats.creepScore),
      String(Math.round(stats.damageDealt)),
      String(Math.round(stats.gold))
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      row.append(td);
    }
    tbody.append(row);
  }

  table.append(thead, tbody);
  return table;
}

function panelHeader(text        )              {
  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h2");
  heading.textContent = text;
  header.append(heading);
  return header;
}

function formatTime(seconds        )         {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = (whole % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
