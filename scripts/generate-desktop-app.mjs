#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "window-test", "apps", "desktop");
const RANGER = path.join(ROOT, "bin", "ranger.js");

const SKIP = new Set(["node_modules", "dist", ".env"]);
const BINARY = new Set([".png", ".ico", ".woff2"]);

function escapeTemplate(value) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function applyCtxPlaceholders(relativePath, content) {
  const dynamicFiles = new Set([
    "main.go",
    "auth_storage.go",
    "wails.json",
    "index.html",
    "README.md",
    ".env.example",
  ]);

  if (!dynamicFiles.has(path.basename(relativePath))) {
    return content;
  }

  return content
    .replaceAll("Window Test", "${ctx.appTitle}")
    .replaceAll("window-test", "${ctx.packageName}")
    .replaceAll("http://localhost:4000", "http://localhost:${ctx.apiPort}");
}

async function walk(dir, base = SOURCE) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (SKIP.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(base, fullPath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      if (relative === "build/bin") {
        continue;
      }
      files.push(...(await walk(fullPath, base)));
      continue;
    }

    files.push({ relative, fullPath });
  }

  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

async function main() {
  const fileEntries = await walk(SOURCE);
  const lines = [
    "function addDesktopApp(files, ctx) {",
  ];

  for (const { relative, fullPath } of fileEntries) {
    const target = `apps/desktop/${relative}`;
    const extension = path.extname(fullPath).toLowerCase();

    if (BINARY.has(extension)) {
      const base64 = await fs.readFile(fullPath, "base64");
      lines.push(`  addBinary(files, ${JSON.stringify(target)}, ${JSON.stringify(base64)});`);
      continue;
    }

    const raw = await fs.readFile(fullPath, "utf8");
    const content = applyCtxPlaceholders(relative, escapeTemplate(raw));
    lines.push(
      `  add(`,
      `    files,`,
      `    ${JSON.stringify(target)},`,
      `    text\``,
      content,
      `\`,`,
      `  );`,
    );
  }

  lines.push("}");

  const generated = lines.join("\n");
  let ranger = await fs.readFile(RANGER, "utf8");
  const anchor = "\nasync function main() {\n  const parsed = parseArgs";
  const anchorIndex = ranger.indexOf(anchor);

  if (anchorIndex === -1) {
    throw new Error("Could not find main() anchor in bin/ranger.js");
  }

  const existingStart = ranger.indexOf("\nfunction addDesktopApp(files, ctx) {");
  if (existingStart !== -1 && existingStart < anchorIndex) {
    ranger = ranger.slice(0, existingStart) + ranger.slice(anchorIndex);
  }

  const nextAnchorIndex = ranger.indexOf(anchor);
  const updated = ranger.slice(0, nextAnchorIndex) + "\n" + generated + ranger.slice(nextAnchorIndex);

  await fs.writeFile(RANGER, updated, "utf8");
  console.log(`Embedded ${fileEntries.length} desktop files into bin/ranger.js`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
