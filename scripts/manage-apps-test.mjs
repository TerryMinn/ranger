import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/ranger.js", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ranger-manage-"));
const read = (root, file) => fs.readFile(path.join(root, file), "utf8");
const readJSON = async (root, file) => JSON.parse(await read(root, file));
const exists = async (root, file) => fs.access(path.join(root, file)).then(() => true, () => false);
function run(cwd, args, status = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd, encoding: "utf8", env: { ...process.env, RANGER_SKIP_DESKTOP_SETUP: "1" },
  });
  assert.equal(result.status, status, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  run(temp, ["workspace", "--yes", "--react", "--no-mobile"]);
  const root = path.join(temp, "workspace");
  const env = await read(root, ".env");
  const originalWeb = await read(root, "apps/web/package.json");
  assert.doesNotMatch(await read(root, "apps/server/src/index.ts"), /manage-apps/);
  run(root, ["add", "-m", "blog-phone"]);
  run(path.join(root, "apps/blog-phone/src"), ["add", "-m", "second-phone"]);
  const mobile = await readJSON(root, "apps/blog-phone/package.json");
  assert.equal(mobile.name, "@repo/blog-phone");
  assert.equal(mobile.scripts.dev, "expo start --port 8082");
  assert.equal((await readJSON(root, "apps/second-phone/package.json")).scripts.dev, "expo start --port 8083");
  assert.equal((await readJSON(root, "apps/blog-phone/app.json")).expo.slug, "blog-phone");
  assert.equal(await exists(root, "apps/blog-phone/src/features/posts/screens/posts-screen.tsx"), true);
  assert.equal(await exists(root, "apps/blog-phone/src/features/auth/screens/auth-screen.tsx"), true);
  assert.match(await read(root, ".env"), /EXPO_APP_SCHEME="workspace"/);
  assert.ok((await read(root, ".env")).startsWith(env.trimEnd()));
  run(root, ["add", "-w", "admin"]);
  run(root, ["add", "-w", "portal", "--frontend", "next"]);
  const web = await readJSON(root, "apps/admin/package.json");
  assert.equal(web.name, "@repo/admin");
  assert.match(web.scripts.dev, /--port 3001/);
  assert.match(await read(root, "apps/admin/vite.config.ts"), /proxy:/);
  assert.match(await read(root, "apps/portal/next.config.mjs"), /rewrites/);
  assert.match((await readJSON(root, "apps/portal/package.json")).scripts.dev, /--port 3002/);
  assert.equal(await read(root, "apps/web/package.json"), originalWeb);
  run(root, ["add", "-d", "desktop-two"]);
  assert.equal((await readJSON(root, "apps/desktop-two/frontend/package.json")).name, "@repo/desktop-two-frontend");
  assert.match(await read(root, "apps/desktop-two/wails.json"), /@repo\/desktop-two-frontend/);
  assert.match(await read(root, "apps/desktop-two/frontend/vite.config.ts"), /\.\.\/\.\.\/admin\/src/);
  assert.match(await read(root, "pnpm-workspace.yaml"), /apps\/desktop-two\/frontend/);
  const manifest = await read(root, "package.json");
  run(root, ["add", "-m", "blog-phone"], 1);
  run(root, ["add", "-w", "../escape"], 1);
  run(root, ["add", "-m", "-w", "ambiguous"], 1);
  run(root, ["remove", "-missing"], 1);
  run(root, ["remove", "-admin"], 1);
  run(root, ["remove", "-server"], 1);
  assert.equal(await read(root, "package.json"), manifest);
  assert.equal(await exists(root, "apps/server"), true);
  // User-authored tasks survive; package-specific tasks/references are removed.
  const turbo = await readJSON(root, "turbo.json");
  turbo.tasks["@repo/blog-phone#custom"] = {};
  turbo.tasks.custom = { dependsOn: ["@repo/blog-phone#custom", "@repo/web#build"], with: ["@repo/blog-phone#dev"] };
  await fs.writeFile(path.join(root, "turbo.json"), JSON.stringify(turbo));
  await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies: {}\n  apps/blog-phone:\n    dependencies: {}\n  apps/desktop-two:\n    dependencies: {}\n  apps/desktop-two/frontend:\n    dependencies: {}\n  apps/web:\n    dependencies: {}\npackages:\n  expo@1.0.0:\n    resolution: {}\n");
  run(root, ["remove", "-blog-phone", "-desktop-two"]);
  assert.equal(await exists(root, "apps/blog-phone"), false);
  assert.equal(await exists(root, "apps/desktop-two"), false);
  assert.equal(await exists(root, "apps/second-phone"), true);
  assert.doesNotMatch(await read(root, "package.json"), /@repo\/(blog-phone|desktop-two)/);
  assert.doesNotMatch(await read(root, "pnpm-workspace.yaml"), /desktop-two/);
  assert.doesNotMatch(await read(root, "turbo.json"), /blog-phone/);
  assert.match(await read(root, "turbo.json"), /@repo\/web#build/);
  const lock = await read(root, "pnpm-lock.yaml");
  assert.doesNotMatch(lock, /blog-phone|desktop-two/);
  assert.match(lock, /apps\/web:\n    dependencies: {}/);
  assert.match(lock, /packages:\n  expo@1.0.0:/);
  run(root, ["remove", "admin", "portal", "second-phone", "server", "web"]);
  assert.deepEqual(await fs.readdir(path.join(root, "apps")), []);
  assert.equal((await readJSON(root, "package.json")).scripts.dev, undefined);

  run(temp, ["next-workspace", "--yes", "--no-mobile"]);
  const next = path.join(temp, "next-workspace");
  assert.doesNotMatch(await read(next, "apps/web/src/app/api/uploads/route.ts"), /manage-apps/);
  run(next, ["add", "-w", "site"]);
  assert.match(await read(next, "apps/site/next.config.mjs"), /http:\/\/localhost:3000\/api/);
  assert.equal(await exists(next, "apps/site/src/app/api"), false);
  run(next, ["add", "-m", "phone"]);
  assert.match(await read(next, "apps/phone/src/lib/get-api-base-url.ts"), /DEFAULT_PORT = "3000"/);
  run(next, ["add", "-d", "native"], 1);
  assert.equal(await exists(next, "apps/native"), false);
  run(temp, ["add", "-m", "outside"], 1);
  console.log("App management tests passed: add, nested cwd, unique ports, collisions, dependency guards, multi-remove, Turbo and lockfile cleanup.");
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
