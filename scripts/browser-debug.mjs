/**
 * Headless browser smoke test — captures console logs and a screenshot.
 * Usage: node scripts/browser-debug.mjs
 */
import { chromium } from "playwright";

const url = process.env.APP_URL ?? "http://127.0.0.1:4173/?debug=1";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const logs = [];
page.on("console", (msg) => {
  logs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (error) => {
  logs.push(`[pageerror] ${error.message}`);
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  await page.click('button:has-text("Start")', { timeout: 8000 });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: "debug-match.png", fullPage: true });

  const sceneInfo = await page.evaluate(() => {
    const dump = globalThis.__idleRiftsSceneDump;
    const largeMeshes = typeof dump === "function" ? dump() : null;
    const champDump = globalThis.__idleRiftsChampionDump;
    const champions = typeof champDump === "function" ? champDump() : null;
    return { largeMeshes, champions };
  });

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector(".match-viewport canvas");
    if (!canvas) {
      return { found: false };
    }
    return {
      found: true,
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      webgl: Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
    };
  });

  console.log("Scene:", JSON.stringify(sceneInfo, null, 2));
  console.log("Canvas:", JSON.stringify(canvasInfo, null, 2));
  console.log("--- Console ---");
  for (const line of logs) {
    console.log(line);
  }
} catch (error) {
  console.error("Browser debug failed:", error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
