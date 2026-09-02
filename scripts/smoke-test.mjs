#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "ranger.js");
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ranger-smoke-"));

function generate(name, args) {
  const target = path.join(tempRoot, name);
  const result = spawnSync(process.execPath, [cli, target, "--yes", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      RANGER_SKIP_DESKTOP_SETUP: "1",
    },
  });

  assert.equal(
    result.status,
    0,
    `Failed to generate ${name}:\n${result.stdout}\n${result.stderr}`,
  );

  return target;
}

function runInProject(target, command, args) {
  const result = spawnSync(command, args, {
    cwd: target,
    encoding: "utf8",
    env: process.env,
  });

  assert.equal(
    result.status,
    0,
    `Command failed in ${path.basename(target)}: ${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
}

async function exists(target, relativePath) {
  try {
    await fs.access(path.join(target, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(target, relativePath) {
  return fs.readFile(path.join(target, relativePath), "utf8");
}

try {
  const next = generate("next", [
    "--frontend",
    "next",
    "--web",
    "--no-mobile",
    "--backend",
    "next",
  ]);
  assert.equal(await exists(next, "apps/web/next.config.mjs"), true);
  assert.equal(await exists(next, "apps/web/vite.config.ts"), false);
  assert.equal(await exists(next, ".cursor/rules/web-arch/nextjs.mdc"), true);

  const nextExpress = generate("next-express", [
    "--frontend",
    "next",
    "--web",
    "--no-mobile",
    "--backend",
    "express",
  ]);
  assert.equal(await exists(nextExpress, "apps/web/next.config.mjs"), true);
  assert.equal(await exists(nextExpress, "apps/server/src/index.ts"), true);
  assert.equal(
    await exists(nextExpress, "apps/web/src/app/api/trpc/[trpc]/route.ts"),
    false,
  );
  assert.match(
    await read(nextExpress, "apps/server/src/index.ts"),
    /createExpressMiddleware/,
  );

  const react = generate("react", [
    "--frontend",
    "react",
    "--web",
    "--no-mobile",
  ]);
  assert.equal(await exists(react, "apps/web/vite.config.ts"), true);
  assert.equal(await exists(react, "apps/web/next.config.mjs"), false);
  assert.equal(await exists(react, "apps/web/src/app"), false);
  assert.equal(await exists(react, "apps/web/src/router.tsx"), true);
  assert.notEqual(
    await read(react, ".env"),
    await read(react, ".env.example"),
    "Generated .env must contain a unique local auth secret.",
  );
  const reactWebPackage = await read(react, "apps/web/package.json");
  assert.match(reactWebPackage, /@tanstack\/react-router/);
  assert.doesNotMatch(reactWebPackage, /"next"\s*:/);
  assert.match(await read(react, "apps/server/package.json"), /"build": "tsup"/);
  assert.match(
    await read(react, "apps/server/src/index.ts"),
    /createExpressMiddleware/,
  );
  assert.match(
    await read(react, "apps/web/src/trpc/client.tsx"),
    /getApiBaseUrl\(\) \+ "\/api\/trpc"/,
  );
  assert.match(await read(react, ".env"), /VITE_API_URL="http:\/\/localhost:4000"/);
  assert.match(
    await read(react, "package.json"),
    /--filter=@repo\/web --filter=@repo\/server/,
  );
  assert.equal(
    await exists(react, ".cursor/rules/web-arch/react-vite.mdc"),
    true,
  );

  const desktop = generate("react-desktop", [
    "--frontend",
    "react",
    "--web",
    "--no-mobile",
    "--desktop",
    "--backend",
    "express",
  ]);
  assert.equal(await exists(desktop, "apps/desktop/wails.json"), true);
  assert.equal(
    await exists(desktop, ".cursor/rules/desktop-arch/desktop-arch.mdc"),
    true,
  );
  assert.match(
    await read(desktop, "apps/desktop/frontend/vite.config.ts"),
    /@\/lib\/navigation/,
  );

  const nextDesktop = generate("next-desktop", [
    "--frontend",
    "next",
    "--web",
    "--no-mobile",
    "--desktop",
    "--backend",
    "express",
  ]);
  assert.equal(await exists(nextDesktop, "apps/web/next.config.mjs"), true);
  assert.equal(await exists(nextDesktop, "apps/desktop/wails.json"), true);

  if (process.env.RANGER_SMOKE_INSTALL === "1") {
    for (const target of [next, nextExpress, react, desktop, nextDesktop]) {
      runInProject(target, "pnpm", ["install", "--no-frozen-lockfile"]);
      runInProject(target, "pnpm", ["typecheck"]);
      runInProject(target, "pnpm", ["--filter", "@repo/web", "build"]);
    }

    runInProject(react, "pnpm", ["--filter", "@repo/server", "build"]);
    runInProject(nextExpress, "pnpm", ["--filter", "@repo/server", "build"]);
    runInProject(desktop, "pnpm", [
      "--filter",
      "@repo/desktop-frontend",
      "build",
    ]);
    runInProject(nextDesktop, "pnpm", [
      "--filter",
      "@repo/desktop-frontend",
      "build",
    ]);
  }

  console.log(
    "Ranger smoke matrix passed: Next.js with either server, React + automatic Express/tRPC, and both Wails variants",
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
