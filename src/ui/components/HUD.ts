import { BASE_MAX_HP, SPEED_OPTIONS, type GameSpeed } from "../../data/Constants.js";
import type { Match } from "../../game/simulation/Match.js";
import { createButton } from "./Button.js";

export interface HUD {
  element: HTMLElement;
  update: () => void;
  setSpeed: (speed: GameSpeed) => void;
}

export function createHUD(match: Match, initialSpeed: GameSpeed, onSpeed: (speed: GameSpeed) => void): HUD {
  let activeSpeed = initialSpeed;
  const element = document.createElement("div");
  element.className = "match-top-bar";

  const scoreboard = document.createElement("div");
  scoreboard.className = "hud-scoreboard";

  const ourTeam = createTeamPanel("OUR TEAM");
  const enemyTeam = createTeamPanel("ENEMY TEAM");
  const centerStats = document.createElement("div");
  centerStats.className = "hud-center";
  const timer = createPill("Time", "00:00");
  const dragons = createPill("Dragons", "0 - 0");
  const barons = createPill("Barons", "0 - 0");
  centerStats.append(timer.wrapper, dragons.wrapper, barons.wrapper);
  scoreboard.append(ourTeam.wrapper, centerStats, enemyTeam.wrapper);

  const speedControls = document.createElement("div");
  speedControls.className = "speed-controls";

  function renderSpeedButtons(): void {
    speedControls.replaceChildren();
    for (const speed of SPEED_OPTIONS) {
      speedControls.append(createButton(`${speed}x`, () => {
        activeSpeed = speed;
        onSpeed(speed);
        renderSpeedButtons();
      }, { active: activeSpeed === speed, title: `Set ${speed}x speed` }));
    }
  }

  renderSpeedButtons();
  element.append(scoreboard, speedControls);

  return {
    element,
    update: () => {
      const blueTeamStats = match.getTeamStats("blue");
      const redTeamStats = match.getTeamStats("red");
      ourTeam.stats.value.textContent = formatStats(blueTeamStats);
      enemyTeam.stats.value.textContent = formatStats(redTeamStats);
      timer.value.textContent = formatTime(match.elapsedSeconds);
      ourTeam.base.value.textContent = `${Math.max(0, Math.round((match.baseHp.blue / BASE_MAX_HP) * 100))}%`;
      enemyTeam.base.value.textContent = `${Math.max(0, Math.round((match.baseHp.red / BASE_MAX_HP) * 100))}%`;
      dragons.value.textContent = `${match.dragonKills.blue} - ${match.dragonKills.red}`;
      barons.value.textContent = `${match.baronKills.blue} - ${match.baronKills.red}`;
    },
    setSpeed: (speed: GameSpeed) => {
      activeSpeed = speed;
      renderSpeedButtons();
    }
  };
}

function createTeamPanel(title: string): { wrapper: HTMLElement; stats: ReturnType<typeof createPill>; base: ReturnType<typeof createPill> } {
  const wrapper = document.createElement("section");
  wrapper.className = title === "OUR TEAM" ? "hud-team our-team" : "hud-team enemy-team";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const stats = createPill("K / D / CS / Gold", "0 / 0 / 0 / 0g");
  const base = createPill("Nexus", "100%");
  wrapper.append(heading, stats.wrapper, base.wrapper);
  return { wrapper, stats, base };
}

function formatStats(stats: { kills: number; deaths: number; creepScore: number; gold: number }): string {
  return `${stats.kills} / ${stats.deaths} / ${stats.creepScore} / ${stats.gold}g`;
}

function createPill(label: string, value: string): { wrapper: HTMLElement; value: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.className = "hud-pill";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value;
  wrapper.append(labelEl, valueEl);
  return { wrapper, value: valueEl };
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60).toString().padStart(2, "0");
  const rest = (whole % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
