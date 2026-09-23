import fs from "node:fs/promises";
import path from "node:path";

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const validName = (value) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
async function readOptional(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
export async function assertPackageAvailable(root, name, apps) {
  const names = new Set(
    apps.flatMap((app) => [app.pkg.name, app.frontend?.name]),
  );
  for (const folder of ["packages", "tooling"]) {
    const entries = await fs
      .readdir(path.join(root, folder), { withFileTypes: true })
      .catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
    for (const entry of entries.filter((entry) => entry.isDirectory())) {
      const contents = await readOptional(
        path.join(root, folder, entry.name, "package.json"),
      );
      if (contents) names.add(JSON.parse(contents).name);
    }
  }
  if (names.has(`@repo/${name}`) || names.has(`@repo/${name}-frontend`))
    throw new Error(
      `Workspace package @repo/${name} already exists. Choose another app name.`,
    );
}

async function choose(ask, question, choices) {
  console.log(question);
  choices.forEach((choice, i) => console.log(`  ${i + 1}. ${choice}`));
  const answer = await ask("Select number or name: ");
  const value = choices[Number(answer) - 1] ?? answer;
  if (!choices.includes(value))
    throw new Error(`Choose one of: ${choices.join(", ")}`);
  return value;
}

// Runtime overrides are service-scoped. Root DATABASE_URL and secrets still pass through.
const runner = `import { spawn } from "node:child_process";
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const mode = process.argv[2];
if (!["dev", "build", "start"].includes(mode)) throw new Error("Expected dev, build, or start.");
const port = process.env.RANGER_SERVER_PORT || String(pkg.ranger.port);
const origin = process.env.RANGER_SERVER_URL || "http://localhost:" + port;
const env = { ...process.env, PORT: port, BETTER_AUTH_URL: origin, NEXTAUTH_URL: origin, NEXT_PUBLIC_API_URL: "" };
const args = ["run", "ranger:base:" + mode];
if (pkg.ranger.backend === "next" && mode !== "build") args.push("--port", port);
const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, { stdio: "inherit", env, shell: process.platform === "win32" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
`;

export async function addServer({
  options,
  root,
  apps,
  rootPackage,
  generators,
  ask,
}) {
  if (options.frontend)
    throw new Error("Use --backend next or --backend express for servers.");
  if (options.new && options.existing)
    throw new Error("Choose --new or --existing, not both.");
  if (options.name && options.existing)
    throw new Error("Use only --existing <app> when joining an app.");
  const backend =
    options.backend ??
    (await choose(ask, "Server backend:", ["next", "express"]));
  if (!["next", "express"].includes(backend))
    throw new Error("--backend must be next or express.");
  const candidates = apps.filter((app) => app.pkg.dependencies?.[backend]);
  const mode = options.existing
    ? "existing"
    : options.new || options.name
      ? "new"
      : await choose(
          ask,
          "Create a server or join an existing app?",
          candidates.length ? ["new", "existing"] : ["new"],
        );
  const name =
    mode === "existing"
      ? (options.existing ??
        (await choose(
          ask,
          "Select an existing app:",
          candidates.map((app) => app.name),
        )))
      : (options.name ?? (await ask("Server app name: ")));
  if (!validName(name))
    throw new Error(
      "Use a lowercase app name with letters, numbers and hyphens.",
    );
  const existing = apps.find((app) => app.name === name);
  const appDir = path.join(root, "apps", name);
  if (mode === "existing" && !candidates.includes(existing))
    throw new Error(`${name} is not an existing ${backend} app.`);
  if (mode === "new") {
    try {
      await fs.lstat(appDir);
      throw new Error(`apps/${name} already exists.`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await assertPackageAvailable(root, name, apps);
    if (rootPackage.scripts?.[`dev:${name}`])
      throw new Error(`dev:${name} already exists.`);
  }
  for (const shared of ["api", "auth", "db"]) {
    if (
      !(await readOptional(path.join(root, `packages/${shared}/package.json`)))
    )
      throw new Error(`Missing shared package: packages/${shared}`);
  }
  if (existing?.pkg.ranger?.managedServer) {
    if (existing.pkg.ranger.backend !== backend)
      throw new Error(
        "This app is already registered with a different backend.",
      );
    if (options.port && Number(options.port) !== existing.pkg.ranger.port)
      throw new Error(
        "Server already joined. Change ranger.port in its package.json or use RANGER_SERVER_PORT.",
      );
    console.log(`Server ${name} is already joined. Run pnpm dev:${name}.`);
    return;
  }
  const occupied = new Set([3000, 4000, 5174, 8081]);
  for (const app of apps) {
    if (app === existing) continue;
    const port =
      app.pkg.ranger?.port ??
      Number(app.pkg.scripts?.dev?.match(/--port\s+(\d+)/)?.[1]);
    if (port) occupied.add(port);
  }
  const env = (await readOptional(path.join(root, ".env"))) ?? "";
  const envPort = Number(env.match(/^PORT=["\']?(\d+)/m)?.[1]);
  const originalPort =
    existing?.pkg.ranger?.port ??
    (Number(existing?.pkg.scripts?.dev?.match(/--port\s+(\d+)/)?.[1]) ||
      (existing ? (backend === "next" ? 3000 : envPort || 4000) : undefined));
  let port = options.port
    ? Number(options.port)
    : (originalPort ?? (backend === "next" ? 3001 : 4001));
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("--port must be an integer from 1024 to 65535.");
  if (options.port && occupied.has(port) && port !== originalPort)
    throw new Error(`Port ${port} is already used or reserved.`);
  if (!existing && !options.port) while (occupied.has(port)) port++;
  const scheme =
    env.match(/^EXPO_APP_SCHEME=["']?([^"'\r\n]+)/m)?.[1] ??
    rootPackage.name.replace(/[^a-z0-9]/g, "");
  const ctx = {
    packageName: name,
    appTitle: name,
    appScheme: scheme,
    dbName: rootPackage.name.replace(/-/g, "_"),
    backend,
    frontend: "next",
    apiPort: port,
    includeWeb: backend === "next",
    includeMobile: true,
    includeDesktop: false,
  };
  const template = {};
  if (backend === "next") generators.web(template, ctx);
  else generators.express(template, ctx);
  const prefix = backend === "next" ? "apps/web/" : "apps/server/";
  const templatePkg = JSON.parse(template[prefix + "package.json"]);
  let pkg = existing ? structuredClone(existing.pkg) : templatePkg;
  if (!existing) pkg.name = `@repo/${name}`;
  const files = {};
  if (!existing)
    for (const [file, content] of Object.entries(template))
      files[file.replace(prefix, `apps/${name}/`)] = content;
  else if (backend === "next") {
    if (!(await readOptional(path.join(appDir, "src/app/layout.tsx"))))
      throw new Error(
        "Joining Next requires the Ranger src/app App Router layout.",
      );
    const alreadyHosts = await readOptional(
      path.join(appDir, "src/app/api/trpc/[trpc]/route.ts"),
    );
    if (!alreadyHosts) {
      const routes = {};
      generators.nextBackend(routes);
      // Keep the existing UI's middleware; only install backend transport files.
      delete routes["apps/web/src/middleware.ts"];
      for (const [file, content] of Object.entries(routes)) {
        const destination = file.replace("apps/web/", `apps/${name}/`);
        const current = await readOptional(path.join(root, destination));
        if (current !== null && current !== content)
          throw new Error(
            `Cannot join: ${destination} already contains custom code. Merge the backend manually or create a new server.`,
          );
        files[destination] = content;
      }
      const configPath = `apps/${name}/next.config.mjs`;
      const config = await readOptional(path.join(root, configPath));
      if (!config)
        throw new Error(
          "Joining Next requires next.config.mjs. Create a new server for a custom configuration.",
        );
      // Remove only the exact proxy emitted by ranger add -w. Custom rewrites need manual review.
      const proxy =
        /  async rewrites\(\) \{ return \[\n    \{ source: "\/api\/:path\*", destination: "[^"\n]+" \},\n    \{ source: "\/uploads\/:path\*", destination: "[^"\n]+" \},\n  \]; \},/;
      const nextConfig = config.replace(proxy, "");
      if (/rewrites\s*\(/.test(nextConfig))
        throw new Error(
          "Custom Next rewrites found. Remove API/upload proxy rewrites before joining this app.",
        );
      files[configPath] = nextConfig;
    }
  } else {
    const entry = await readOptional(path.join(appDir, "src/index.ts"));
    if (
      !entry?.includes("createExpressMiddleware") ||
      !entry?.includes('"@repo/api"')
    )
      throw new Error(
        "Select an existing Ranger Express server with tRPC in src/index.ts, or create a new server. Custom Express entry points are not overwritten.",
      );
  }
  for (const section of ["dependencies", "devDependencies"]) {
    pkg[section] = { ...templatePkg[section], ...pkg[section] };
  }
  if (backend === "express") {
    const dbPackage = JSON.parse(
      await fs.readFile(path.join(root, "packages/db/package.json"), "utf8"),
    );
    pkg.dependencies["@prisma/client"] =
      dbPackage.dependencies["@prisma/client"];
    const authPackage = JSON.parse(
      await fs.readFile(path.join(root, "packages/auth/package.json"), "utf8"),
    );
    if (authPackage.dependencies?.next || authPackage.devDependencies?.next)
      pkg.dependencies.next =
        authPackage.dependencies?.next ?? authPackage.devDependencies.next;
    if (existing) {
      const configPath = `apps/${name}/tsup.config.ts`;
      const current = await readOptional(path.join(root, configPath));
      if (!current)
        throw new Error("Joining Express requires the Ranger tsup.config.ts.");
      if (!current.includes('external: ["@prisma/client", "next"]')) {
        const marker = 'noExternal: ["@repo/api", "@repo/auth", "@repo/db"],';
        if (!current.includes(marker) || /\bexternal\s*:/.test(current))
          throw new Error(
            "Custom tsup config: externalize @prisma/client and next before joining.",
          );
        files[configPath] = current.replace(
          marker,
          marker + '\n  external: ["@prisma/client", "next"],',
        );
      }
    }
  }
  pkg.scripts ??= {};
  for (const mode of ["dev", "build", "start"]) {
    if (pkg.scripts[`ranger:base:${mode}`])
      throw new Error(`Script ranger:base:${mode} already exists.`);
    let command = pkg.scripts[mode] ?? templatePkg.scripts[mode];
    if (backend === "next") {
      // Strip Ranger's frontend-only dotenv wrapper before hosting routes in this app.
      command = command
        .replace(/^dotenv -e \.env\.local --override -- /, "")
        .replace(/ --port \d+/g, "");
      if (!command.startsWith(`next ${mode}`))
        throw new Error(
          `Custom ${mode} script cannot be joined automatically. Create a new Next server instead.`,
        );
    }
    pkg.scripts[`ranger:base:${mode}`] = command;
    pkg.scripts[mode] = `node ./ranger-run.mjs ${mode}`;
  }
  pkg.ranger = {
    ...pkg.ranger,
    type: "server",
    backend,
    managedServer: true,
    legacyHost: Boolean(existing && !existing.pkg.ranger?.backendApp),
    port,
  };
  delete pkg.ranger.backendApp;
  files[`apps/${name}/package.json`] = json(pkg);
  if ((await readOptional(path.join(appDir, "ranger-run.mjs"))) !== null)
    throw new Error("ranger-run.mjs already exists; nothing was changed.");
  files[`apps/${name}/ranger-run.mjs`] = runner;
  files[`apps/${name}/.env.server.example`] =
    `# Set these in this service environment; do not share them across multiple servers.\nRANGER_SERVER_PORT=${port}\nRANGER_SERVER_URL=http://localhost:${port}\n# DATABASE_URL, BETTER_AUTH_SECRET and CORS_ORIGIN are inherited.\n`;
  rootPackage.scripts ??= {};
  rootPackage.scripts[`dev:${name}`] =
    `dotenv -e .env -- turbo run dev --filter=${pkg.name} --ui=stream`;
  rootPackage.scripts[`start:${name}`] =
    `dotenv -e .env -- pnpm --filter ${pkg.name} start`;
  for (const key of ["dev", "dev:stream"]) {
    const value = rootPackage.scripts[key];
    if (!value)
      rootPackage.scripts[key] =
        `dotenv -e .env -- turbo run dev --filter=${pkg.name} --ui=${key === "dev" ? "tui" : "stream"}`;
    else if (
      value.includes("turbo run dev") &&
      value.includes("--filter") &&
      !value.includes(`--filter=${pkg.name} `)
    )
      rootPackage.scripts[key] = value.replace(
        "turbo run dev",
        `turbo run dev --filter=${pkg.name}`,
      );
  }
  const turbo = JSON.parse(
    await fs.readFile(path.join(root, "turbo.json"), "utf8"),
  );
  turbo.globalEnv = [
    ...new Set([
      ...(turbo.globalEnv ?? []),
      "RANGER_SERVER_PORT",
      "RANGER_SERVER_URL",
      "PORT",
    ]),
  ];
  // All validation finishes before any existing file is modified.
  await generators.write({ targetDir: root }, files);
  await fs.writeFile(path.join(root, "package.json"), json(rootPackage));
  await fs.writeFile(path.join(root, "turbo.json"), json(turbo));
  console.log(
    `${existing ? "Joined" : "Created"} ${backend} server at apps/${name} (port ${port}).\nRun pnpm install, then pnpm dev:${name}.\nExisting clients keep their current API host. Set their API URL/proxy explicitly to use this server.`,
  );
}
