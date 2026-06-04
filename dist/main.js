import { Engine } from "./core/Engine.js";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

new Engine(root).start();
