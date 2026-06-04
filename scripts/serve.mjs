import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const preferredPort = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const requested = safePath === "/" ? "/index.html" : safePath;
    const filePath = path.join(distDir, requested);

    if (!filePath.startsWith(distDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const target = await exists(filePath) ? filePath : path.join(distDir, "index.html");

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
