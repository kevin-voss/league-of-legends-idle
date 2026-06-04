import { debugError, debugLog } from "./DebugLog.js";
import { GameLoop } from "./GameLoop.js";
import { ThreeRenderer } from "./ThreeRenderer.js";
import { AccountStore } from "../state/AccountStore.js";
import { Match } from "../game/simulation/Match.js";
                                                      
                                                                   
import { createHomeScreen } from "../ui/screens/HomeScreen.js";
import { createMatchScreen,                  } from "../ui/screens/MatchScreen.js";
import { createResultScreen } from "../ui/screens/ResultScreen.js";
import { createTeamBuilderScreen } from "../ui/screens/TeamBuilder.js";

export class Engine {
          root             ;
          store = new AccountStore();
          loop                  = null;
          renderer                       = null;
          match               = null;
          matchScreen                     = null;
          speed            = 1;

  constructor(root             ) {
    this.root = root;
  }

  start()       {
    this.showHome();
  }

  showHome()       {
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

  showTeamBuilder()       {
    this.stopMatch();
    this.setScreen(createTeamBuilderScreen(this.store, () => this.showHome(), () => this.startMatch()));
  }

  startMatch()       {
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

          async bootMatchRenderer()                {
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

    const renderer = new ThreeRenderer(canvas, worldOverlay, viewport, debugOverlay);
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

          updateMatch(dt        )       {
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

          renderMatch()       {
    if (this.match && this.renderer) {
      this.renderer.render(this.match);
    }
  }

          showResult(result             , rewards              )       {
    this.stopLoopOnly();
    this.setScreen(createResultScreen(result, rewards, () => this.showHome(), () => this.startMatch()));
  }

          stopMatch()       {
    this.stopLoopOnly();
    this.renderer?.dispose();
    this.match = null;
    this.renderer = null;
    this.matchScreen = null;
  }

          stopLoopOnly()       {
    this.loop?.stop();
    this.loop = null;
  }

          setScreen(element             )       {
    this.root.replaceChildren(element);
  }

          showViewportError(viewport             , message        )       {
    const banner = document.createElement("div");
    banner.className = "match-error-banner";
    banner.textContent = `3D failed to load: ${message}. Open DevTools or add ?debug=1 to the URL.`;
    viewport.append(banner);
  }
}
