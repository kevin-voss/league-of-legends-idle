import { TICK_RATE } from "../data/Constants.js";

export class GameLoop {
          lastTime = 0;
          accumulator = 0;
          running = false;
          speedMultiplier = 1;
          updateFn                      ;
          renderFn            ;

  constructor(update                      , render            ) {
    this.updateFn = update;
    this.renderFn = render;
  }

  start()       {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop()       {
    this.running = false;
    this.accumulator = 0;
  }

  setSpeed(speed           )       {
    this.speedMultiplier = speed;
  }

  getSpeed()         {
    return this.speedMultiplier;
  }

          loop = (time        )       => {
    if (!this.running) {
      return;
    }

    const deltaTime = Math.min(time - this.lastTime, 250);
    this.lastTime = time;
    this.accumulator += deltaTime * this.speedMultiplier;

    let processedTicks = 0;
    while (this.accumulator >= TICK_RATE && processedTicks < 12) {
      this.updateFn(TICK_RATE / 1000);
      this.accumulator -= TICK_RATE;
      processedTicks += 1;
    }

    if (processedTicks >= 12) {
      this.accumulator = 0;
    }

    this.renderFn();
    requestAnimationFrame(this.loop);
  };
}
