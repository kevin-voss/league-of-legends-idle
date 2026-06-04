import { TICK_RATE } from "../data/Constants.js";

export class GameLoop {
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private speedMultiplier = 1;
  private updateFn: (dt: number) => void;
  private renderFn: () => void;

  constructor(update: (dt: number) => void, render: () => void) {
    this.updateFn = update;
    this.renderFn = render;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    this.accumulator = 0;
  }

  setSpeed(speed: 1 | 3 | 5): void {
    this.speedMultiplier = speed;
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  private loop = (time: number): void => {
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
