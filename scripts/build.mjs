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

  console.log(`Built ${path.relative(root, distDir)}`);
}

await build();
