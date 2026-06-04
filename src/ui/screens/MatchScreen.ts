import { isDebugEnabled } from "../../core/DebugLog.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, type GameSpeed } from "../../data/Constants.js";
import type { Match } from "../../game/simulation/Match.js";
import { createHUD, type HUD } from "../components/HUD.js";

export interface MatchScreen {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  viewport: HTMLElement;
  worldOverlay: HTMLElement;
  debugOverlay: HTMLElement | null;
  hud: HUD;
  update: () => void;
}

export function createMatchScreen(match: Match, speed: GameSpeed, onSpeed: (speed: GameSpeed) => void): MatchScreen {
  const shell = document.createElement("main");
  shell.className = "match-shell";

  const hud = createHUD(match, speed, onSpeed);

  const viewport = document.createElement("div");
  viewport.className = "match-viewport";
  viewport.setAttribute("role", "application");
  viewport.setAttribute("aria-label", "Summoner's Rift map");

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.setAttribute("aria-label", "Idle Rifts match simulation");

  const worldOverlay = document.createElement("div");
  worldOverlay.className = "world-overlay";
  worldOverlay.setAttribute("aria-hidden", "true");

  const debugOverlay = document.createElement("pre");
  debugOverlay.className = "match-debug";
  debugOverlay.hidden = !isDebugEnabled();

  viewport.append(canvas, worldOverlay, debugOverlay);

  const log = document.createElement("div");
  log.className = "match-log";

  shell.append(hud.element, viewport, log);

  return {
    element: shell,
    canvas,
    viewport,
    worldOverlay,
    debugOverlay: isDebugEnabled() ? debugOverlay : null,
    hud,
    update: () => {
      hud.update();
      log.textContent = match.eventLog[0] ?? "";
    }
  };
}
