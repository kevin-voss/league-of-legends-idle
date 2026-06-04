import { CANVAS_HEIGHT, CANVAS_WIDTH, type GameSpeed } from "../../data/Constants.js";
import type { Match } from "../../game/simulation/Match.js";
import { createHUD, type HUD } from "../components/HUD.js";

export interface MatchScreen {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HUD;
  update: () => void;
}

export function createMatchScreen(match: Match, speed: GameSpeed, onSpeed: (speed: GameSpeed) => void): MatchScreen {
  const shell = document.createElement("main");
  shell.className = "match-shell";

  const hud = createHUD(match, speed, onSpeed);
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "canvas-wrap";

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.setAttribute("aria-label", "Idle Rifts match simulation");
  canvasWrap.append(canvas);

  const log = document.createElement("div");
  log.className = "match-log";

  shell.append(hud.element, canvasWrap, log);

  return {
    element: shell,
    canvas,
    hud,
    update: () => {
      hud.update();
      log.textContent = match.eventLog[0] ?? "";
    }
  };
}
