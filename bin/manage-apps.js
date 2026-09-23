import { addServer, assertPackageAvailable } from "./manage-server.js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";

const readJSON = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const json = (value) => JSON.stringify(value, null, 2) + "\n";
async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function workspaceRoot() {
  let dir = process.cwd();
  while (true) {
    if (
      (await exists(path.join(dir, "pnpm-workspace.yaml"))) &&
      (await exists(path.join(dir, "turbo.json")))
    )
      return dir;
    const parent = path.dirname(dir);
    if (parent === dir)
      throw new Error("Run this command inside a Ranger workspace.");
    dir = parent;
  }
}
async function appsIn(root) {
  const entries = await fs.readdir(path.join(root, "apps"), {
    withFileTypes: true,
  });
  const apps = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, "apps", entry.name);
    if (!(await exists(path.join(dir, "package.json")))) continue;
    const pkg = await readJSON(path.join(dir, "package.json"));
    const frontend = (await exists(path.join(dir, "frontend/package.json")))
      ? await readJSON(path.join(dir, "frontend/package.json"))
      : null;
    apps.push({ name: entry.name, dir, pkg, frontend });
  }
  return apps;
}
function parse(command, args) {
  const result = { names: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (command === "add") {
      const type = {
        "-m": "mobile",
        "--mobile": "mobile",
        "-w": "web",
        "--web": "web",
        "-d": "desktop",
        "--desktop": "desktop",
        "-s": "server",
        "--server": "server",
      }[arg];
      if (type) {
        if (result.type && result.type !== type)
          throw new Error("Choose one app type per add command.");
        result.type = type;
      } else if (["--backend", "--existing", "--port"].includes(arg)) {
        const value = args[++i];
        if (!value || value.startsWith("-"))
          throw new Error(`${arg} requires a value.`);
        result[arg.slice(2)] = value;
      } else if (arg === "--new") {
        result.new = true;
      } else if (arg === "server" && !result.type && !result.name) {
        result.type = "server";
      } else if (arg === "--frontend") {
        result.frontend = args[++i];
        if (!["next", "react"].includes(result.frontend))
          throw new Error("--frontend must be next or react.");
      } else if (!arg.startsWith("-") && !result.name) result.name = arg;
      else throw new Error(`Unknown argument: ${arg}`);
    } else {
      const name = arg.startsWith("-") ? arg.slice(1) : arg;
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name))
        throw new Error(`Invalid app name: ${arg}`);
      result.names.push(name);
    }
  }
  return result;
}
async function ask(question) {
  if (!process.stdin.isTTY)
    throw new Error(
      "Interactive input requires a terminal. Supply an app type and name in the command.",
    );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
async function checkbox(apps) {
  if (!process.stdin.isTTY)
    throw new Error("Supply app names: ranger remove -my-app -other-app");
  console.log(
    "Select apps to remove (↑/↓ move, Space toggle, Enter remove, Esc cancel):",
  );
  emitKeypressEvents(process.stdin);
  const previousRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let cursor = 0;
  const selected = new Set();
  const render = () => {
    process.stdout.write(
      apps
        .map(
          (app, i) =>
            `\x1b[2K${i === cursor ? ">" : " "} [${selected.has(app.name) ? "x" : " "}] ${app.name}`,
        )
        .join("\n") + "\n",
    );
  };
  render();
  return new Promise((resolve) => {
    const finish = (names) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(previousRaw);
      process.stdin.pause();
      resolve(names);
    };
    const onKey = (value, key = {}) => {
      if (key.name === "escape" || (key.ctrl && key.name === "c"))
        return finish([]);
      if (key.name === "return") return finish([...selected]);
      if (key.name === "up") cursor = (cursor + apps.length - 1) % apps.length;
      if (key.name === "down") cursor = (cursor + 1) % apps.length;
      if (value === " ") {
        const name = apps[cursor].name;
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
      }
      process.stdout.write(`\x1b[${apps.length}A`);
      render();
    };
    process.stdin.on("keypress", onKey);
  });
}
const packageNames = (apps) =>
  apps.flatMap((app) => [app.pkg.name, app.frontend?.name].filter(Boolean));
const escapeRE = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function manageApps(command, args, generators) {
  const options = parse(command, args);
  const root = await workspaceRoot();
  const apps = await appsIn(root);
  const rootPackage = await readJSON(path.join(root, "package.json"));
  const turbo = await readJSON(path.join(root, "turbo.json"));
  let workspace = await fs.readFile(
    path.join(root, "pnpm-workspace.yaml"),
    "utf8",
  );
  if (command === "remove") {
    if (!apps.length) {
      console.log("No apps to remove.");
      return;
    }
    const names = options.names.length
      ? [...new Set(options.names)]
      : await checkbox(apps);
    if (!names.length) {
      console.log("No apps removed.");
      return;
    }
    for (const name of names)
      if (!apps.some((app) => app.name === name))
        throw new Error(`App not found: ${name}`);
    const removed = apps.filter((app) => names.includes(app.name));
    const removedPackages = packageNames(removed);
    const remaining = apps.filter((app) => !names.includes(app.name));
    for (const app of remaining) {
      const dependencies = {
        ...app.pkg.dependencies,
        ...app.pkg.devDependencies,
        ...app.frontend?.dependencies,
      };
      const refs = [app.pkg.ranger?.backendApp, app.pkg.ranger?.webApp];
      if (app.frontend && !app.pkg.ranger) refs.push("web");
      if (
        removedPackages.some((name) => name in dependencies) ||
        refs.some((name) => names.includes(name))
      ) {
        throw new Error(
          `${app.name} depends on an app selected for removal. Select it too or update its dependencies first.`,
        );
      }
    }
    // The original API host is an implicit runtime dependency of scaffolded clients.
    for (const app of removed) {
      if (
        (!app.pkg.ranger?.managedServer || app.pkg.ranger?.legacyHost) &&
        (app.pkg.dependencies?.express ||
          (await exists(path.join(app.dir, "src/app/api/trpc")))) &&
        remaining.some((other) => !other.pkg.ranger?.managedServer)
      ) {
        throw new Error(
          `${app.name} hosts the API used by the remaining apps. Remove those apps together or migrate the API first.`,
        );
      }
    }
    for (const [key, value] of Object.entries(rootPackage.scripts ?? {})) {
      let next = value;
      for (const name of removedPackages)
        next = next.replace(
          new RegExp(`\\s*--filter(?:=|\\s+)${escapeRE(name)}(?=\\s|$)`, "g"),
          "",
        );
      if (next !== value && !next.includes("--filter"))
        delete rootPackage.scripts[key];
      else rootPackage.scripts[key] = next;
      if (
        names.some(
          (name) =>
            key === `dev:${name}` ||
            key === `dev:${name}:all` ||
            value.includes(`apps/${name}/`),
        )
      )
        delete rootPackage.scripts[key];
    }
    if (names.includes("desktop")) delete rootPackage.scripts["desktop:setup"];
    for (const key of ["dev", "dev:stream"]) {
      if (!remaining.length) delete rootPackage.scripts[key];
    }
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      for (const name of removedPackages)
        if (rootPackage[section]) delete rootPackage[section][name];
    }
    for (const [key, task] of Object.entries(turbo.tasks ?? {})) {
      if (removedPackages.some((name) => key.startsWith(name + "#")))
        delete turbo.tasks[key];
      else
        for (const field of ["dependsOn", "with"]) {
          if (task[field])
            task[field] = task[field].filter(
              (dep) =>
                !removedPackages.some((name) => dep.startsWith(name + "#")),
            );
        }
    }
    workspace = workspace
      .split("\n")
      .filter(
        (line) =>
          !names.some((name) =>
            new RegExp(
              `^\\s*-\\s*['"]?apps/${escapeRE(name)}(?:/[^'"\\s]*)?['"]?\\s*$`,
            ).test(line),
          ),
      )
      .join("\n");
    const lockPath = path.join(root, "pnpm-lock.yaml");
    let lock;
    if (await exists(lockPath)) {
      lock = await fs.readFile(lockPath, "utf8");
      let inImporters = false;
      let skip = false;
      lock = lock
        .split("\n")
        .filter((line) => {
          if (/^\S/.test(line)) {
            inImporters = line === "importers:";
            skip = false;
          }
          if (inImporters && /^  \S/.test(line)) {
            const importer = line
              .trim()
              .replace(/:.*$/, "")
              .replace(/^['"]|['"]$/g, "");
            skip = names.some(
              (name) =>
                importer === `apps/${name}` ||
                importer.startsWith(`apps/${name}/`),
            );
          }
          return !skip;
        })
        .join("\n");
    }
    for (const app of removed) await fs.rm(app.dir, { recursive: true });
    if (lock !== undefined) await fs.writeFile(lockPath, lock);
    await fs.writeFile(path.join(root, "package.json"), json(rootPackage));
    await fs.writeFile(path.join(root, "turbo.json"), json(turbo));
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), workspace);
    console.log(
      `Removed: ${names.join(", ")}. Workspace and Turbo references cleaned up.\nRun pnpm install to refresh the lockfile.`,
    );
    return;
  }

  const type =
    options.type ?? (await ask("App type (mobile/web/desktop/server): "));
  if (!["mobile", "web", "desktop", "server"].includes(type))
    throw new Error("Choose mobile, web, desktop, or server.");
  if (type === "server") {
    await addServer({ options, root, apps, rootPackage, generators, ask });
    return;
  }
  if (options.backend || options.existing || options.new || options.port)
    throw new Error(
      "--backend, --existing, --new and --port apply only to servers.",
    );
  if (options.frontend && type !== "web")
    throw new Error("--frontend applies only to web apps.");
  const name = options.name ?? (await ask("App name: "));
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name))
    throw new Error(
      "Use a lowercase app name with letters, numbers, and hyphens (for example my-blog).",
    );
  if (await exists(path.join(root, "apps", name)))
    throw new Error(`apps/${name} already exists.`);
  await assertPackageAvailable(root, name, apps);
  if (rootPackage.scripts?.[`dev:${name}`])
    throw new Error(`dev:${name} already exists in root scripts.`);
  const server = apps.find((app) => app.pkg.dependencies?.express);
  const nextServer = [];
  for (const app of apps)
    if (await exists(path.join(app.dir, "src/app/api/trpc")))
      nextServer.push(app);
  const hosts = apps.filter(
    (app) =>
      app.pkg.dependencies?.express ||
      (type !== "desktop" && nextServer.includes(app)),
  );
  const selectedHost =
    hosts.length > 1 && process.stdin.isTTY
      ? await ask(`Backend app (${hosts.map((app) => app.name).join("/")}): `)
      : null;
  const backend = selectedHost
    ? hosts.find((app) => app.name === selectedHost)
    : (server ?? nextServer[0]);
  if (selectedHost && !backend)
    throw new Error(`Unknown backend app: ${selectedHost}`);
  if (!backend)
    throw new Error(
      "No Ranger API host found. Keep an existing Express server or Next.js API app.",
    );
  const web = apps.find(
    (app) =>
      app.pkg.dependencies?.next ||
      app.pkg.dependencies?.["@tanstack/react-router"],
  );
  if (type === "desktop" && !server)
    throw new Error(
      "The Wails template requires an Express backend. This workspace uses Next.js API routes.",
    );
  if (type === "desktop" && !web)
    throw new Error(
      "Add a web app first; the Wails template reuses its blog UI.",
    );
  const env = await fs
    .readFile(path.join(root, ".env"), "utf8")
    .catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
  const envValue = (key) =>
    env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]*)`, "m"))?.[1];
  const apiPort =
    backend.pkg.ranger?.port ||
    Number(envValue("PORT")) ||
    (backend.pkg.dependencies?.express ? 4000 : 3000);
  const apiURL = (
    backend.pkg.ranger?.managedServer
      ? `http://localhost:${apiPort}`
      : envValue("BETTER_AUTH_URL") || `http://localhost:${apiPort}`
  ).replace(/\/$/, "");
  if (!/^https?:\/\/[^\s"'`]+$/.test(apiURL))
    throw new Error("BETTER_AUTH_URL must be an HTTP(S) URL.");
  const frontend =
    options.frontend ?? (web?.pkg.dependencies?.next ? "next" : "react");
  const occupied = new Set([
    3000,
    4000,
    5174,
    8081,
    ...apps.map((app) => app.pkg.ranger?.port),
  ]);
  for (const app of apps) {
    const match = app.pkg.scripts?.dev?.match(/--port\s+(\d+)/);
    if (match) occupied.add(Number(match[1]));
  }
  let port = type === "mobile" ? 8082 : type === "desktop" ? 5175 : 3001;
  while (occupied.has(port)) port++;
  const ctx = {
    packageName: name,
    appTitle: name,
    appScheme:
      envValue("EXPO_APP_SCHEME") || rootPackage.name.replace(/-/g, ""),
    backend: "express",
    frontend,
    apiPort,
    includeWeb: true,
    includeMobile: type === "mobile",
    includeDesktop: type === "desktop",
  };
  const files = {};
  generators[type](files, ctx);
  const prefix = `apps/${type}/`;
  const output = {};
  for (const [file, content] of Object.entries(files)) {
    let value = content;
    if (typeof value === "string") {
      value = value.replace(
        new RegExp(`@repo/${type}(-frontend)?(?=[^a-z0-9-]|$)`, "g"),
        (_, suffix = "") => `@repo/${name}${suffix}`,
      );
      if (type === "desktop")
        value = value
          .replaceAll("../../web/src", `../../${web.name}/src`)
          .replaceAll("apps/web", `apps/${web.name}`)
          .replaceAll("port: 5174", `port: ${port}`)
          .replaceAll("http://localhost:4000", apiURL);
      if (type === "web")
        value = value
          .replaceAll("--port 3000", `--port ${port}`)
          .replaceAll("port: 3000", `port: ${port}`);
    }
    output[file.replace(prefix, `apps/${name}/`)] = value;
  }
  const packagePath = `apps/${name}/package.json`;
  const pkg = JSON.parse(output[packagePath]);
  pkg.ranger = {
    type,
    backendApp: backend.name,
    ...(type === "desktop" ? { webApp: web.name } : {}),
    port,
  };
  if (type === "mobile") {
    pkg.scripts.dev += ` --port ${port}`;
    if (!envValue("EXPO_APP_SCHEME"))
      output[".env"] = env.trimEnd() + `\nEXPO_APP_SCHEME="${ctx.appScheme}"\n`;
  }
  if (type === "web") {
    // Override the original host's root environment for this separate frontend.
    const key = frontend === "next" ? "NEXT_PUBLIC_API_URL" : "VITE_API_URL";
    // Same-origin proxies also support workspaces whose Next API has no CORS middleware.
    if (frontend === "next") {
      const configPath = `apps/${name}/next.config.mjs`;
      output[configPath] = output[configPath].replace(
        "const nextConfig = {",
        `const nextConfig = {
  async rewrites() { return [
    { source: "/api/:path*", destination: ${JSON.stringify(apiURL + "/api/:path*")} },
    { source: "/uploads/:path*", destination: ${JSON.stringify(apiURL + "/uploads/:path*")} },
  ]; },`,
      );
    } else {
      const configPath = `apps/${name}/vite.config.ts`;
      output[configPath] = output[configPath].replace(
        "server: {",
        `server: {
    proxy: { "/api": { target: ${JSON.stringify(apiURL)}, changeOrigin: true }, "/uploads": { target: ${JSON.stringify(apiURL)}, changeOrigin: true } },`,
      );
    }
    output[`apps/${name}/.env.local`] = `${key}=""\n`;
    for (const script of ["dev", "build", "start", "preview"]) {
      if (pkg.scripts[script])
        pkg.scripts[script] =
          `dotenv -e .env.local --override -- ${pkg.scripts[script]}`;
    }
    pkg.devDependencies["dotenv-cli"] = "^8.0.0";
  }
  if (
    backend.pkg.ranger?.managedServer &&
    ["mobile", "desktop"].includes(type)
  ) {
    const clientEnv =
      type === "mobile"
        ? `EXPO_PUBLIC_API_URL=${JSON.stringify(apiURL)}\nEXPO_PUBLIC_API_PORT=${JSON.stringify(String(apiPort))}\n`
        : `VITE_API_URL=${JSON.stringify(apiURL)}\n`;
    output[`apps/${name}/.env.ranger-client`] = clientEnv;
    pkg.devDependencies ??= {};
    pkg.devDependencies["dotenv-cli"] = "^8.0.0";
    for (const script of [
      "dev",
      "start",
      "build",
      "android",
      "ios",
      "web",
      "frontend:dev",
      "frontend:build",
    ]) {
      if (pkg.scripts[script])
        pkg.scripts[script] =
          `dotenv -e .env.ranger-client --override -- ${pkg.scripts[script]}`;
    }
  }
  output[packagePath] = json(pkg);
  if (type === "desktop") {
    output[`apps/${name}/README.md`] = output[`apps/${name}/README.md`]
      .replaceAll("pnpm dev:desktop:all", `pnpm dev:${name}:all`)
      .replaceAll("pnpm dev:desktop", `pnpm dev:${name}`)
      .replaceAll("pnpm dev:server", `pnpm dev:${backend.name}`);
    workspace = workspace.replace(
      /^(packages:\s*\n)/m,
      `$1  - "apps/${name}/frontend"\n`,
    );
  }
  rootPackage.scripts ??= {};
  rootPackage.scripts[`dev:${name}`] =
    `dotenv -e .env -- turbo run dev --filter=@repo/${name} --ui=stream`;
  if (type === "desktop")
    rootPackage.scripts[`dev:${name}:all`] =
      `dotenv -e .env -- turbo run dev --filter=${backend.pkg.name} --filter=@repo/${name} --ui=stream`;
  for (const key of ["dev", "dev:stream"]) {
    const value = rootPackage.scripts[key];
    if (value?.includes("turbo run dev") && value.includes("--filter"))
      rootPackage.scripts[key] = value.replace(
        "turbo run dev",
        `turbo run dev --filter=@repo/${name}`,
      );
  }
  await generators.write({ targetDir: root }, output);
  await fs.writeFile(path.join(root, "package.json"), json(rootPackage));
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), workspace);
  console.log(
    `Added ${type} app at apps/${name}.\nRun pnpm install, then pnpm dev:${name}.`,
  );
  if (type === "desktop")
    console.log("Desktop requires Go and the Wails v2 CLI.");
}
