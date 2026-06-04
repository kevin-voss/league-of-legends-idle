import { debugLog, isDebugEnabled } from "./core/DebugLog.js";
import { Engine } from "./core/Engine.js";

if (isDebugEnabled()) {
  debugLog("Boot", "debug mode enabled (?debug=1 or localStorage idle-rifts-debug=1)");
}

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

new Engine(root).start();
