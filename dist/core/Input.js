import { Vector2 } from "./Vector2.js";

export class Input {
  mouse = new Vector2();
  isPointerDown = false;
          canvas                   ;

  constructor(canvas                   ) {
    this.canvas = canvas;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  destroy()       {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
  }

          onPointerMove = (event              )       => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (event.clientX - rect.left) * scaleX;
    this.mouse.y = (event.clientY - rect.top) * scaleY;
  };

          onPointerDown = ()       => {
    this.isPointerDown = true;
  };

          onPointerUp = ()       => {
    this.isPointerDown = false;
  };
}
