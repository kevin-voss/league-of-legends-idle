import { debugError, debugLog } from "./DebugLog.js";
import { GameLoop } from "./GameLoop.js";
import { ThreeRenderer } from "./ThreeRenderer.js";
import { AccountStore } from "../state/AccountStore.js";
import { Match } from "../game/simulation/Match.js";
import type { GameSpeed } from "../data/Constants.js";
import type { MatchResult, RewardResult } from "../data/models.js";
import { createHomeScreen } from "../ui/screens/HomeScreen.js";
import { createMatchScreen, type MatchScreen } from "../ui/screens/MatchScreen.js";
import { createResultScreen } from "../ui/screens/ResultScreen.js";
import { createTeamBuilderScreen } from "../ui/screens/TeamBuilder.js";

export class Engine {
  private root: HTMLElement;
  private store = new AccountStore();
  private loop: GameLoop | null = null;
  private renderer: ThreeRenderer | null = null;
  private match: Match | null = null;
  private matchScreen: MatchScreen | null = null;
  private speed: GameSpeed = 1;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.showHome();
  }

  showHome(): void {
    this.stopMatch();
    this.setScreen(createHomeScreen(
      this.store,
      () => this.showTeamBuilder(),
      () => this.startMatch(),
      () => {
        this.store.reset();
        this.showHome();
      }
    ));
  }

  showTeamBuilder(): void {
    this.stopMatch();
    this.setScreen(createTeamBuilderScreen(this.store, () => this.showHome(), () => this.startMatch()));
  }

  startMatch(): void {
    if (!this.store.isTeamValid()) {
      this.showTeamBuilder();
      return;
    }

    this.stopMatch();
    this.match = new Match({
      playerTeam: this.store.getSelectedRoster(),
      accountLevel: this.store.account.level
    });
    this.matchScreen = createMatchScreen(this.match, this.speed, (speed) => {
      this.speed = speed;
      this.loop?.setSpeed(speed);
    });
    this.setScreen(this.matchScreen.element);
    void this.bootMatchRenderer();
  }

  private async bootMatchRenderer(): Promise<void> {
    if (!this.match || !this.matchScreen) {
      return;
    }

    const { canvas, worldOverlay, viewport, debugOverlay } = this.matchScreen;
    viewport.classList.add("is-loading");
    if (debugOverlay) {
      debugOverlay.textContent = "phase: loading assets…";
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));
    debugLog("Engine", "bootMatchRenderer", {
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight
    });

    const renderer = new ThreeRenderer(canvas, worldOverlay, debugOverlay);
    try {
      await renderer.init(this.match);
    } catch (error) {
      debugError("Engine", "Three.js init failed", error);
      const message = error instanceof Error ? error.message : String(error);
      viewport.classList.remove("is-loading");
      if (debugOverlay) {
        debugOverlay.textContent = `init failed:\n${message}`;
      }
      this.showViewportError(viewport, message);
      return;
    }

    this.renderer = renderer;
    this.loop = new GameLoop((dt) => this.updateMatch(dt), () => this.renderMatch());
    this.loop.setSpeed(this.speed);
    viewport.classList.remove("is-loading");
    this.loop.start();
  }

  private updateMatch(dt: number): void {
    if (!this.match) {
      return;
    }

    this.match.update(dt);
    this.matchScreen?.update();

    if (this.match.completed) {
      const result = this.match.getResult();
      const rewards = this.store.completeMatch(result);
      this.showResult(result, rewards);
    }
  }

  private renderMatch(): void {
    if (this.match && this.renderer) {
      this.renderer.render(this.match);
    }
  }

  private showResult(result: MatchResult, rewards: RewardResult): void {
    this.stopLoopOnly();
    this.setScreen(createResultScreen(result, rewards, () => this.showHome(), () => this.startMatch()));
  }

  private stopMatch(): void {
    this.stopLoopOnly();
    this.renderer?.dispose();
    this.match = null;
    this.renderer = null;
    this.matchScreen = null;
  }

  private stopLoopOnly(): void {
    this.loop?.stop();
    this.loop = null;
  }

  private setScreen(element: HTMLElement): void {
    this.root.replaceChildren(element);
  }

  private showViewportError(viewport: HTMLElement, message: string): void {
    const banner = document.createElement("div");
    banner.className = "match-error-banner";
    banner.textContent = `3D failed to load: ${message}. Open DevTools or add ?debug=1 to the URL.`;
    viewport.append(banner);
  }
}
