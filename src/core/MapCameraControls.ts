import type { ThreeEngine } from "./ThreeEngine.js";

const ZOOM_SENSITIVITY = 0.0012;

export class MapCameraControls {
  private readonly viewport: HTMLElement;
  private readonly engine: ThreeEngine;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private activePointerId: number | null = null;

  constructor(viewport: HTMLElement, engine: ThreeEngine) {
    this.viewport = viewport;
    this.engine = engine;
    viewport.addEventListener("wheel", this.onWheel, { passive: false });
    viewport.addEventListener("pointerdown", this.onPointerDown);
    viewport.addEventListener("pointermove", this.onPointerMove);
    viewport.addEventListener("pointerup", this.onPointerUp);
    viewport.addEventListener("pointercancel", this.onPointerUp);
    viewport.addEventListener("dblclick", this.onDoubleClick);
  }

  destroy(): void {
    this.viewport.removeEventListener("wheel", this.onWheel);
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    this.viewport.removeEventListener("dblclick", this.onDoubleClick);
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const canvas = this.engine.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
    this.engine.zoomBy(factor, anchorX, anchorY, rect.width, rect.height);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    this.dragging = true;
    this.activePointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.viewport.setPointerCapture(event.pointerId);
    this.viewport.classList.add("is-panning");
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || this.activePointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (dx === 0 && dy === 0) {
      return;
    }
    const canvas = this.engine.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.engine.panScreenDelta(dx, dy, rect.width, rect.height);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.dragging = false;
    this.activePointerId = null;
    if (this.viewport.hasPointerCapture(event.pointerId)) {
      this.viewport.releasePointerCapture(event.pointerId);
    }
    this.viewport.classList.remove("is-panning");
  };

  private onDoubleClick = (): void => {
    this.engine.resetCamera();
  };
}
