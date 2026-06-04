import { promises as fs } from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";

const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  const message = typeof warning === "string" ? warning : warning.message;
  if (message.includes("stripTypeScriptTypes")) {
    return;
  }
  originalEmitWarning(warning, ...args);
};

const root = process.cwd();
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
      continue;
    }
    await fs.copyFile(from, to);
  }
}

function shouldSkipBundledAsset(relativePath) {
  if (!relativePath.startsWith(`assets${path.sep}`)) {
    return false;
  }
  return !relativePath.endsWith(".gitkeep");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function build() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  const files = await walk(srcDir);

  for (const filePath of files) {
    const relativePath = path.relative(srcDir, filePath);
    const extension = path.extname(filePath);

    if (shouldSkipBundledAsset(relativePath)) {
      continue;
    }

    if (extension === ".ts") {
      const targetPath = path.join(distDir, relativePath.replace(/\.ts$/, ".js"));
      const source = await fs.readFile(filePath, "utf8");
      const output = stripTypeScriptTypes(source, { mode: "strip" });
      await ensureDir(targetPath);
      await fs.writeFile(targetPath, output, "utf8");
      continue;
    }

    const targetPath = path.join(distDir, relativePath);
    await ensureDir(targetPath);
    await fs.copyFile(filePath, targetPath);
  }

  const threeSource = path.join(root, "node_modules", "three");
  const threeTarget = path.join(distDir, "vendor", "three");
  try {
    await copyDir(threeSource, threeTarget);
  } catch (error) {
    console.warn("Skipping Three.js vendor copy. Run `npm install` before building.", error);
  }

  await writeNatureManifest();

  console.log(`Built ${path.relative(root, distDir)}`);
}

function classifyNatureAsset(relativePath) {
  const name = relativePath.toLowerCase();
  if (/tree|palm|pine|bush|forest|log/.test(name)) {
    return "trees";
  }
  if (/rock|stone|boulder|cliff/.test(name)) {
    return "rocks";
  }
  if (/hill|mountain|mesa/.test(name)) {
    return "hills";
  }
  if (/grass|flower|plant|fern|reed|mushroom|veg/.test(name)) {
    return "plants";
  }
  if (/ground|terrain|tile|hex|water|river|lake/.test(name)) {
    return "terrain";
  }
  return "plants";
}

async function writeNatureManifest() {
  const natureRoot = path.join(root, "src", "assets", "Stylized Nature MegaKit");
  const manifest = {
    available: false,
    trees: [],
    rocks: [],
    plants: [],
    hills: [],
    terrain: []
  };

  let files = [];
  try {
    files = await walk(natureRoot);
  } catch {
    await fs.writeFile(path.join(distDir, "nature-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  for (const filePath of files) {
    if (!/\.(fbx|glb|gltf)$/i.test(filePath)) {
      continue;
    }
    const relative = path.relative(path.join(root, "src", "assets"), filePath).split(path.sep).join("/");
    const url = `/game-assets/${relative}`;
    const bucket = classifyNatureAsset(relative);
    manifest[bucket].push(url);
    manifest.available = true;
  }

  await fs.writeFile(path.join(distDir, "nature-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await build();
