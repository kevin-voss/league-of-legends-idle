import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const gameAssetsDir = path.join(root, "src", "assets");
const threeDir = path.join(root, "node_modules", "three");
const preferredPort = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream"
};

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveTarget(requested) {
  if (requested.startsWith("/vendor/three/")) {
    const filePath = path.join(threeDir, requested.slice("/vendor/three/".length));
    if (!filePath.startsWith(threeDir)) {
      return null;
    }
    return (await exists(filePath)) ? filePath : null;
  }

  if (requested.startsWith("/game-assets/")) {
    const filePath = path.join(gameAssetsDir, requested.slice("/game-assets/".length));
    if (!filePath.startsWith(gameAssetsDir)) {
      return null;
    }
    return (await exists(filePath)) ? filePath : null;
  }

  const filePath = path.join(distDir, requested);
  if (!filePath.startsWith(distDir)) {
    return null;
  }

  return (await exists(filePath)) ? filePath : path.join(distDir, "index.html");
}

function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const requested = safePath === "/" ? "/index.html" : safePath;
    const target = await resolveTarget(requested);

    if (!target) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    try {
      const body = await fs.readFile(target);
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(target)] ?? "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
}

async function listen(port) {
  if (port > 65535) {
    throw new Error("No available local port found.");
  }

  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      server.close();
      if (error && error.code === "EADDRINUSE") {
        resolve(listen(port + 1));
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => resolve({ server, port }));
  });
}

try {
  const result = await listen(preferredPort);
  console.log(`Idle Rifts running at http://127.0.0.1:${result.port}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
