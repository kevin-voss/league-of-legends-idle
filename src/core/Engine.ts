import { GameLoop } from "./GameLoop.js";
import { Renderer } from "./Renderer.js";
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
  private renderer: Renderer | null = null;
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
    this.renderer = new Renderer(this.matchScreen.canvas);
    this.loop = new GameLoop((dt) => this.updateMatch(dt), () => this.renderMatch());
    this.loop.setSpeed(this.speed);
    this.setScreen(this.matchScreen.element);
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
}
