#!/usr/bin/env node

import fs from "node:fs/promises";
import { manageApps } from "./manage-apps.js";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

const BACKENDS = new Set(["next", "express"]);
const FRONTENDS = new Set(["next", "react"]);

function text(strings, ...values) {
  const raw = String.raw({ raw: strings }, ...values)
    .replace(/^\n/, "")
    .replace(/\s*$/, "\n");
  const lines = raw.split("\n");
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return (
    lines
      .map((line) => (line.trim().length > 0 ? line.slice(indent) : ""))
      .join("\n")
      .replace(/\s*$/, "") + "\n"
  );
}

function json(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function toKebabCase(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toTitle(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function backendLabel(backend) {
  return backend === "express"
    ? "Express server + tRPC"
    : "Next.js server + tRPC";
}

function parseArgs(argv) {
  const options = {
    appName: "",
    includeWeb: undefined,
    includeMobile: undefined,
    includeDesktop: undefined,
    frontend: undefined,
    backend: undefined,
    yes: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--force" || arg === "-f") {
      options.force = true;
      continue;
    }
    if (arg === "--web") {
      options.includeWeb = true;
      continue;
    }
    if (arg === "--no-web") {
      options.includeWeb = false;
      continue;
    }
    if (arg === "--mobile") {
      options.includeMobile = true;
      continue;
    }
    if (arg === "--no-mobile") {
      options.includeMobile = false;
      continue;
    }
    if (arg === "--desktop") {
      options.includeDesktop = true;
      continue;
    }
    if (arg === "--no-desktop") {
      options.includeDesktop = false;
      continue;
    }
    if (arg === "--next" || arg === "--nextjs") {
      options.frontend = "next";
      options.includeWeb = true;
      continue;
    }
    if (arg === "--react") {
      options.frontend = "react";
      options.includeWeb = true;
      continue;
    }
    if (arg === "--frontend") {
      const next = argv[index + 1];
      if (!FRONTENDS.has(next)) {
        throw new Error("--frontend must be either next or react.");
      }
      options.frontend = next;
      options.includeWeb = true;
      index += 1;
      continue;
    }
    if (arg.startsWith("--frontend=")) {
      const frontend = arg.slice("--frontend=".length);
      if (!FRONTENDS.has(frontend)) {
        throw new Error("--frontend must be either next or react.");
      }
      options.frontend = frontend;
      options.includeWeb = true;
      continue;
    }
    if (arg === "--backend") {
      const next = argv[index + 1];
      if (!BACKENDS.has(next)) {
        throw new Error("--backend must be either next or express.");
      }
      options.backend = next;
      index += 1;
      continue;
    }
    if (arg.startsWith("--backend=")) {
      const backend = arg.slice("--backend=".length);
      if (!BACKENDS.has(backend)) {
        throw new Error("--backend must be either next or express.");
      }
      options.backend = backend;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!options.appName) {
      options.appName = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

async function promptForOptions(options) {
  if (options.yes) {
    return {
      ...options,
      appName: options.appName || "my-ranger-app",
      includeWeb: options.includeWeb ?? true,
      includeMobile: options.includeMobile ?? true,
      includeDesktop: options.includeDesktop ?? false,
      frontend: options.frontend ?? "next",
      backend:
        options.backend ??
        (options.includeDesktop ||
        options.frontend === "react" ||
        options.includeWeb === false
          ? "express"
          : "next"),
    };
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const appName =
      options.appName ||
      (await rl.question("Project name: ")) ||
      "my-ranger-app";

    const includeMobile =
      options.includeMobile ??
      (await confirm(rl, "Include Expo mobile app?", true));

    const includeWeb =
      options.includeWeb ??
      (await confirm(rl, "Include web/admin app?", true));

    const frontend = includeWeb
      ? options.frontend ??
        (await select(rl, "Web frontend", [
          { value: "next", label: "Next.js App Router" },
          { value: "react", label: "React + Vite + TanStack Router" },
        ]))
      : options.frontend;

    const includeDesktop =
      options.includeDesktop ??
      (await confirm(
        rl,
        "Include Wails desktop app? (requires Go + Wails CLI)",
        false,
      ));

    let backend =
      options.backend ??
      (includeDesktop || frontend === "react" || !includeWeb
        ? "express"
        : await select(rl, "Backend server", [
            { value: "next", label: "Next.js server + tRPC" },
            {
              value: "express",
              label: "Express server + tRPC (required for desktop)",
            },
          ]));

    if (includeDesktop && backend !== "express") {
      console.log("Desktop app requires Express backend. Switching backend to express.");
      backend = "express";
    }

    if (frontend === "react" && backend !== "express") {
      console.log("React + Vite requires the Express backend. Switching backend to express.");
      backend = "express";
    }

    console.log("");
    console.log("Selected configuration:");
    console.log("  Web: " + (includeWeb ? "yes" : "no"));
    console.log("  Mobile: " + (includeMobile ? "yes" : "no"));
    console.log("  Desktop: " + (includeDesktop ? "yes" : "no"));
    if (includeWeb) {
      console.log(
        "  Frontend: " +
          (frontend === "react" ? "React + Vite + TanStack Router" : "Next.js App Router"),
      );
    }
    const automaticBackend =
      frontend === "react"
        ? " (automatic for React + Vite)"
        : includeDesktop
          ? " (required for desktop)"
          : "";
    console.log("  Backend: " + backendLabel(backend) + automaticBackend);
    console.log("");

    return {
      ...options,
      appName,
      includeMobile,
      includeWeb,
      includeDesktop,
      frontend,
      backend,
    };
  } finally {
    rl.close();
  }
}

async function confirm(rl, question, defaultValue) {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${suffix}) `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

async function select(rl, question, choices) {
  console.log(`${question}:`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });

  while (true) {
    const answer = (await rl.question("Choose 1 or 2: ")).trim();
    const index = Number(answer || "1") - 1;
    if (choices[index]) {
      return choices[index].value;
    }
  }
}

function normalizeOptions(options) {
  const targetDir = path.resolve(process.cwd(), options.appName);
  const basename = path.basename(targetDir);
  const packageName = toKebabCase(basename || "my-ranger-app");

  if (!packageName) {
    throw new Error("Project name must contain at least one letter or number.");
  }

  const includeDesktop = Boolean(options.includeDesktop);
  let frontend = options.frontend ?? "next";
  let backend = options.backend ?? "next";
  let includeWeb = backend === "next" ? true : Boolean(options.includeWeb);
  const includeMobile = Boolean(options.includeMobile);

  if (!FRONTENDS.has(frontend)) {
    throw new Error("Frontend must be either next or react.");
  }

  if (frontend === "react" && backend !== "express") {
    throw new Error(
      "React + Vite requires --backend express (Vite does not host the server API).",
    );
  }

  if (backend === "next") {
    frontend = "next";
  }

  if (includeDesktop) {
    if (backend !== "express") {
      throw new Error(
        "Desktop app requires --backend express (the Wails frontend calls the API via VITE_API_URL).",
      );
    }
    if (options.includeWeb === false) {
      throw new Error(
        "Desktop app requires the web app (it reuses apps/web UI through Vite aliases).",
      );
    }
    includeWeb = true;
  }

  if (!includeWeb && !includeMobile && !includeDesktop) {
    throw new Error("Choose at least one app: web, mobile, or desktop.");
  }

  return {
    targetDir,
    packageName,
    appTitle: toTitle(packageName),
    appScheme: packageName.replace(/-/g, ""),
    authSecret: crypto.randomBytes(32).toString("base64url"),
    dbName: packageName.replace(/-/g, "_"),
    includeWeb,
    includeMobile,
    includeDesktop,
    frontend,
    backend,
    apiPort: backend === "express" ? 4000 : 3000,
    force: options.force,
    enabledNextForBackend: backend === "next" && options.includeWeb === false,
    enabledWebForDesktop: includeDesktop && options.includeWeb !== true,
  };
}

async function ensureWritableTarget(ctx) {
  try {
    const entries = await fs.readdir(ctx.targetDir);
    if (entries.length > 0 && !ctx.force) {
      throw new Error(
        `Target directory is not empty: ${ctx.targetDir}\nUse --force to overwrite generated files.`,
      );
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(ctx.targetDir, { recursive: true });
      return;
    }
    throw error;
  }
}

async function writeFiles(ctx, files) {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));

  for (const [relativePath, contents] of entries) {
    const filePath = path.join(ctx.targetDir, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (contents && typeof contents === "object" && contents.binary) {
      await fs.writeFile(filePath, Buffer.from(contents.data, "base64"));
      continue;
    }

    await fs.writeFile(filePath, contents, "utf8");
  }
}

function add(files, filePath, contents) {
  files[filePath] = contents;
}

function addBinary(files, filePath, base64) {
  files[filePath] = { binary: true, data: base64 };
}

function createFiles(ctx) {
  const files = {};

  addRootFiles(files, ctx);
  addCursorRules(files, ctx);
  addToolingFiles(files);
  addDbPackage(files, ctx);
  addAuthPackage(files, ctx);
  addApiPackage(files);

  if (ctx.includeWeb) {
    addWebApp(files, ctx);
  }

  if (ctx.includeMobile) {
    addMobileApp(files, ctx);
  }

  if (ctx.backend === "express") {
    addExpressServer(files, ctx);
  }

  if (ctx.includeDesktop) {
    addDesktopApp(files, ctx);
  }

  return files;
}

function rootScripts(ctx) {
  const filters = [];
  if (ctx.includeWeb) filters.push("--filter=@repo/web");
  if (ctx.includeMobile) filters.push("--filter=@repo/mobile");
  if (ctx.backend === "express") filters.push("--filter=@repo/server");
  if (ctx.includeDesktop) filters.push("--filter=@repo/desktop");
  const withEnv = (command) => `dotenv -e .env -- ${command}`;

  const scripts = {
    postinstall: withEnv("turbo run db:generate --filter=@repo/db"),
    build: withEnv("turbo run build"),
    dev: withEnv(`turbo run dev ${filters.join(" ")} --ui=tui`),
    "dev:stream": withEnv(`turbo run dev ${filters.join(" ")} --ui=stream`),
    lint: withEnv("turbo run lint"),
    format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,md,mdc}"',
    "format:check": 'prettier --check "**/*.{ts,tsx,js,jsx,json,md,mdc}"',
    "db:generate": withEnv("turbo run db:generate"),
    "db:reset": "bash ./scripts/reset-database.sh",
    "db:push": withEnv("turbo run db:push --filter=@repo/db"),
    "db:migrate": withEnv("turbo run db:migrate --filter=@repo/db"),
    "db:seed": withEnv("turbo run db:seed --filter=@repo/db"),
    "db:studio": withEnv("pnpm --filter @repo/db db:studio"),
    typecheck: withEnv("turbo run typecheck"),
  };

  if (ctx.includeWeb) scripts["dev:web"] = withEnv("turbo run dev --filter=@repo/web --ui=stream");
  if (ctx.includeMobile) scripts["dev:mobile"] = withEnv("turbo run dev --filter=@repo/mobile --ui=stream");
  if (ctx.backend === "express") scripts["dev:server"] = withEnv("turbo run dev --filter=@repo/server --ui=stream");
  if (ctx.includeDesktop) {
    scripts["desktop:setup"] = "bash ./scripts/setup-desktop.sh";
    scripts["dev:desktop"] = withEnv("turbo run dev --filter=@repo/desktop --ui=stream");
    scripts["dev:desktop:all"] =
      withEnv("turbo run dev --filter=@repo/server --filter=@repo/desktop --ui=stream");
  }

  return scripts;
}

function databaseUrl(ctx) {
  return `postgresql://postgres:postgres@localhost:5432/${ctx.dbName}?schema=public`;
}

function rootEnv(ctx, example = false) {
  return text`
    DATABASE_URL="${databaseUrl(ctx)}"
    BETTER_AUTH_SECRET="${example ? "replace-with-a-long-random-secret" : ctx.authSecret}"
    BETTER_AUTH_URL="http://localhost:${ctx.apiPort}"
    CORS_ORIGIN="http://localhost:3000"
    NEXT_PUBLIC_API_URL="${ctx.backend === "express" ? "http://localhost:4000" : ""}"
    VITE_API_URL="${ctx.backend === "express" ? "http://localhost:4000" : ""}"
    EXPO_PUBLIC_API_URL="http://127.0.0.1:${ctx.apiPort}"
    EXPO_PUBLIC_API_PORT="${ctx.apiPort}"
    ${ctx.includeMobile ? `EXPO_PUBLIC_APP_SCHEME="${ctx.appScheme}"\n    EXPO_APP_SCHEME="${ctx.appScheme}"` : ""}
    SEED_ADMIN_EMAIL="admin@localhost"
    SEED_ADMIN_PASSWORD=""
  `;
}

function dbEnv(ctx) {
  return text`
    # Prisma Database
    DATABASE_URL="${databaseUrl(ctx)}"

    # Local seed only — set before pnpm db:seed
    SEED_ADMIN_EMAIL="admin@localhost"
    SEED_ADMIN_PASSWORD=""
  `;
}

function webEnv(ctx) {
  if (ctx.frontend === "react") {
    return text`
      # Root .env is authoritative. This file documents the Vite-specific key.
      VITE_API_URL="http://localhost:4000"
    `;
  }

  if (ctx.backend === "next") {
    return text`
      # Database
      DATABASE_URL="${databaseUrl(ctx)}"

      # Better Auth
      BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
      BETTER_AUTH_URL="http://localhost:3000"

      # CORS for Expo mobile app
      CORS_ORIGIN="http://localhost:8081"

      # Same-origin API routes are used by default.
      NEXT_PUBLIC_API_URL=""
      ${ctx.includeMobile ? `\n      EXPO_APP_SCHEME="${ctx.appScheme}"` : ""}
    `;
  }

  return text`
    # Root .env is authoritative. These are the Next.js client keys.
    NEXT_PUBLIC_API_URL="http://localhost:4000"
    BETTER_AUTH_URL="http://localhost:4000"
  `;
}

function mobileEnv(ctx) {
  return text`
    # Deep link scheme — must match app.json and server EXPO_APP_SCHEME.
    EXPO_PUBLIC_APP_SCHEME="${ctx.appScheme}"

    # API URL for tRPC and Better Auth.
    # iOS simulator uses 127.0.0.1. Android emulator auto-falls back to 10.0.2.2 in code.
    # Physical devices should use your Mac LAN IP, for example http://192.168.1.10:${ctx.apiPort}.
    EXPO_PUBLIC_API_URL="http://127.0.0.1:${ctx.apiPort}"
    EXPO_PUBLIC_API_PORT="${ctx.apiPort}"
  `;
}

function serverEnv(ctx) {
  return text`
    DATABASE_URL="${databaseUrl(ctx)}"
    BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
    BETTER_AUTH_URL="http://localhost:4000"
    CORS_ORIGIN="http://localhost:3000"
    PORT="4000"
    NODE_ENV="development"
    ${ctx.includeMobile ? `EXPO_APP_SCHEME="${ctx.appScheme}"` : ""}
  `;
}

function setupDesktopScript() {
  return text`
    #!/usr/bin/env bash
    set -euo pipefail

    append_go_bin_to_path() {
      if ! command -v go >/dev/null 2>&1; then
        return
      fi

      local gobin
      gobin="$(go env GOPATH)/bin"
      if [[ -d "$gobin" ]]; then
        case ":$PATH:" in
          *":$gobin:"*) ;;
          *) export PATH="$gobin:$PATH" ;;
        esac
      fi
    }

    install_go() {
      echo "Go not found. Installing..."

      if [[ "$OSTYPE" == darwin* ]]; then
        if command -v brew >/dev/null 2>&1; then
          brew install go
          return
        fi

        echo "Homebrew is required to auto-install Go on macOS." >&2
        echo "Install Homebrew from https://brew.sh or Go from https://go.dev/dl/" >&2
        exit 1
      fi

      if [[ "$OSTYPE" == linux-gnu* ]]; then
        if command -v apt-get >/dev/null 2>&1; then
          sudo apt-get update
          sudo apt-get install -y golang-go
          return
        fi

        if command -v brew >/dev/null 2>&1; then
          brew install go
          return
        fi
      fi

      echo "Install Go manually from https://go.dev/dl/" >&2
      exit 1
    }

    ensure_go() {
      if command -v go >/dev/null 2>&1; then
        echo "Go is installed: $(go version)"
        append_go_bin_to_path
        return
      fi

      install_go
      append_go_bin_to_path

      if ! command -v go >/dev/null 2>&1; then
        echo "Go installation finished but go is still not on PATH." >&2
        exit 1
      fi

      echo "Go is installed: $(go version)"
    }

    install_wails() {
      echo "Wails CLI not found. Installing with go install..."
      ensure_go
      append_go_bin_to_path
      go install github.com/wailsapp/wails/v2/cmd/wails@latest
      append_go_bin_to_path
    }

    ensure_wails() {
      ensure_go
      append_go_bin_to_path

      if command -v wails >/dev/null 2>&1; then
        echo "Wails is installed: $(wails version)"
        return
      fi

      install_wails

      if ! command -v wails >/dev/null 2>&1; then
        echo "Wails was installed but is not on PATH." >&2
        echo 'Add this to your shell profile: export PATH="$(go env GOPATH)/bin:$PATH"' >&2
        exit 1
      fi

      echo "Wails is installed: $(wails version)"
    }

    ensure_go
    ensure_wails

    echo
    echo "Desktop toolchain is ready."
    echo "Next: pnpm dev:desktop:all"
  `;
}

async function runDesktopSetup(targetDir) {
  const scriptPath = path.join(targetDir, "scripts", "setup-desktop.sh");
  await fs.chmod(scriptPath, 0o755);

  return new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath], {
      cwd: targetDir,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error("desktop setup exited with code " + code));
    });
  });
}

function addRootFiles(files, ctx) {
  add(
    files,
    "package.json",
    json({
      name: ctx.packageName,
      private: true,
      scripts: rootScripts(ctx),
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "dotenv-cli": "^8.0.0",
        prettier: "^3.3.3",
        turbo: "^2.3.0",
      },
      packageManager: "pnpm@9.12.0",
      engines: {
        node: ">=20.0.0",
      },
    }),
  );

  add(
    files,
    "pnpm-workspace.yaml",
    text`
      packages:
        - "apps/*"
        ${ctx.includeDesktop ? '- "apps/desktop/frontend"' : ""}
        - "packages/*"
        - "tooling/*"
    `,
  );

  add(
    files,
    "AGENTS.md",
    text`
      # ${ctx.appTitle} Agent Guide

      ## Architecture

      - Apps are delivery layers. Shared server behavior belongs in \`packages/api\`, authentication in \`packages/auth\`, and persistence in \`packages/db\`.
      - The web frontend is ${ctx.frontend === "react" ? "React + Vite with TanStack Router" : "Next.js App Router"}.
      ${ctx.includeDesktop ? "- The Wails desktop reuses web feature modules. Keep shared modules framework-portable and use `@/lib/navigation`." : ""}
      ${ctx.backend === "express" ? "- Express owns HTTP transport only; add business procedures to typed tRPC routers." : "- Next.js route handlers host auth, tRPC, and uploads."}
      - Feature components render state. View-model hooks own queries, mutations, forms, uploads, and navigation side effects.

      ## Required checks

      - Run \`pnpm typecheck\` after TypeScript changes.
      - Run \`pnpm --filter @repo/web build\` after web routing or configuration changes.
      ${ctx.backend === "express" ? "- Run `pnpm --filter @repo/server build` after server or shared-package changes." : ""}
      ${ctx.includeDesktop ? "- Run `pnpm --filter @repo/desktop-frontend build` after changing shared web modules." : ""}
      - Never commit real secrets. The root \`.env\` is the local source of truth.
    `,
  );

  const globalEnv = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "CORS_ORIGIN",
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_API_PORT",
    "EXPO_PUBLIC_APP_SCHEME",
    "EXPO_APP_SCHEME",
    "NEXT_PUBLIC_API_URL",
    "VITE_API_URL",
  ];

  add(
    files,
    "turbo.json",
    json({
      $schema: "https://turbo.build/schema.json",
      globalDependencies: ["**/.env.*local", "**/.env"],
      globalEnv,
      tasks: {
        build: {
          dependsOn: ["^build"],
          outputs: [
            ".next/**",
            "!.next/cache/**",
            "dist/**",
            "frontend/dist/**",
            "build/bin/**",
          ],
        },
        dev: {
          cache: false,
          persistent: true,
        },
        lint: {
          dependsOn: ["^build"],
        },
        typecheck: {
          dependsOn: ["^build"],
        },
        clean: {
          cache: false,
        },
        "db:generate": {
          cache: false,
        },
        "db:push": {
          cache: false,
        },
        "db:migrate": {
          cache: false,
        },
        "db:seed": {
          cache: false,
        },
      },
    }),
  );

  add(
    files,
    "scripts/reset-database.sh",
    text`
      #!/usr/bin/env bash
      set -euo pipefail

      ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
      ENV_FILE="$ROOT_DIR/.env"
      ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"

      if ! command -v node >/dev/null 2>&1; then
        echo "node is required to read package.json and DATABASE_URL." >&2
        exit 1
      fi

      if ! command -v psql >/dev/null 2>&1; then
        echo "psql is required. Install PostgreSQL client tools first." >&2
        exit 1
      fi

      PROJECT_NAME="$(node - "$ROOT_DIR/package.json" <<'NODE'
      const fs = require("fs");
      const packagePath = process.argv[2];
      const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      process.stdout.write(pkg.name || "ranger_app");
      NODE
      )"

      DATABASE_NAME="$(node - "$PROJECT_NAME" <<'NODE'
      const value = process.argv[2] || "ranger_app";
      const snake = value
        .replace(/^@/, "")
        .replace(/\\//g, "_")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
      process.stdout.write(snake || "ranger_app");
      NODE
      )"

      if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
          cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
          echo "Created .env from .env.example"
        else
          touch "$ENV_FILE"
        fi
      fi

      mkdir -p "$ROOT_DIR/packages/db"
      ln -sf ../../.env "$ROOT_DIR/packages/db/.env"
      echo "Linked packages/db/.env -> ../../.env"

      RAW_DATABASE_URL="$(node - "$ENV_FILE" "$DATABASE_NAME" <<'NODE'
      const fs = require("fs");
      const [envFile, databaseName] = process.argv.slice(2);
      const fallback = "postgresql://postgres:postgres@localhost:5432/" + databaseName + "?schema=public";
      const text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
      const match = text.match(/^DATABASE_URL=(.*)$/m);
      let value = match ? match[1].trim() : fallback;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.stdout.write(value || fallback);
      NODE
      )"

      TARGET_DATABASE_URL="$(node - "$RAW_DATABASE_URL" "$DATABASE_NAME" <<'NODE'
      const [rawUrl, databaseName] = process.argv.slice(2);
      const url = new URL(rawUrl);
      url.pathname = "/" + databaseName;
      process.stdout.write(url.toString());
      NODE
      )"

      ADMIN_DATABASE_URL="$(node - "$TARGET_DATABASE_URL" <<'NODE'
      const url = new URL(process.argv[2]);
      url.pathname = "/postgres";
      url.search = "";
      process.stdout.write(url.toString());
      NODE
      )"

      echo "Project name: $PROJECT_NAME"
      echo "Database name: $DATABASE_NAME"
      echo "Postgres server: $ADMIN_DATABASE_URL"
      echo
      echo "This will terminate active connections, drop database '$DATABASE_NAME' if it exists, and create it again."
      read -r -p "Continue? Type 'yes' to confirm: " CONFIRM

      if [[ "$CONFIRM" != "yes" ]]; then
        echo "Cancelled."
        exit 1
      fi

      psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v database_name="$DATABASE_NAME" <<'SQL'
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = :'database_name'
        AND pid <> pg_backend_pid();

      SELECT 'DROP DATABASE IF EXISTS ' || quote_ident(:'database_name') || ';' \\gexec
      SELECT 'CREATE DATABASE ' || quote_ident(:'database_name') || ';' \\gexec
      SQL

      node - "$ENV_FILE" "$TARGET_DATABASE_URL" <<'NODE'
      const fs = require("fs");
      const [envFile, databaseUrl] = process.argv.slice(2);
      const line = 'DATABASE_URL="' + databaseUrl + '"';
      let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";

      if (/^DATABASE_URL=.*$/m.test(text)) {
        text = text.replace(/^DATABASE_URL=.*$/m, line);
      } else {
        text = text.replace(/\\s*$/u, "");
        text += (text ? "\\n" : "") + line + "\\n";
      }

      fs.writeFileSync(envFile, text.endsWith("\\n") ? text : text + "\\n");
      NODE

      echo
      echo "Database '$DATABASE_NAME' is ready."
      echo "Updated DATABASE_URL in the root .env source of truth."
      echo "Next: pnpm db:push && pnpm db:seed"
    `,
  );

  if (ctx.includeDesktop) {
    add(files, "scripts/setup-desktop.sh", setupDesktopScript());
  }

  add(
    files,
    ".gitignore",
    text`
      .DS_Store
      node_modules
      .turbo
      .env
      .env.local
      .env.*.local
      dist
      .next
      .expo
      coverage
      npm-debug.log*
      pnpm-debug.log*
      yarn-debug.log*
      yarn-error.log*
    `,
  );

  add(
    files,
    ".env.example",
    rootEnv(ctx, true),
  );

  add(
    files,
    ".env",
    rootEnv(ctx),
  );

  add(
    files,
    "prettier.config.mjs",
    text`
      export default {
        semi: true,
        singleQuote: false,
        trailingComma: "all",
      };
    `,
  );

  add(
    files,
    "README.md",
    text`
      # ${ctx.appTitle}

      Generated by Ranger.

      ## Stack

      - pnpm workspace + Turbo
      - shared tRPC API package
      - Better Auth + Prisma
      ${ctx.includeWeb ? `- ${ctx.frontend === "react" ? "React + Vite + TanStack Router" : "Next.js App Router"} web/admin app with shadcn-style black and white UI` : ""}
      ${ctx.includeMobile ? "- Expo mobile app using React Native StyleSheet only" : ""}
      ${ctx.includeDesktop ? "- Wails desktop app reusing the web feature modules" : ""}
      - ${ctx.backend === "next" ? "Next.js server for auth, tRPC, and uploads" : "Express + tRPC server for auth and uploads"}

      ## App layout

      ${ctx.includeWeb ? "- `apps/web` — " + (ctx.frontend === "react" ? "React + Vite frontend" : "Next.js frontend") : ""}
      ${ctx.backend === "express" ? "- `apps/server` — Express server hosting tRPC, Better Auth, and uploads" + (ctx.frontend === "react" ? "; already connected to `apps/web`" : "") : "- `apps/web/src/app/api` — Next.js route handlers hosting tRPC, Better Auth, and uploads"}
      - \`packages/api\` — shared tRPC routers used by the selected server
      - \`packages/auth\` — shared Better Auth configuration
      - \`packages/db\` — shared Prisma database package

      ## Setup

      1. Update \`BETTER_AUTH_SECRET\` and \`SEED_ADMIN_PASSWORD\` in the generated root \`.env\`.
      2. Run \`pnpm install\`.
      3. Keep the root \`.env\` as the single local environment source of truth.
      4. Run \`pnpm db:reset\` and type \`yes\` when you are ready to drop and recreate the local database.
      5. Run \`pnpm db:push\`.
      6. Run \`pnpm db:seed\`.
      ${ctx.includeDesktop ? "7. Run `pnpm desktop:setup` to install Go and the Wails CLI if needed." : ""}
      ${ctx.includeDesktop ? "8. Run `pnpm dev`." : "7. Run `pnpm dev`."}

      \`pnpm db:reset\` reads the root \`package.json\` name, converts it to snake_case, creates that PostgreSQL database, updates \`.env\` \`DATABASE_URL\`, and links \`packages/db/.env\` to the root \`.env\`.
      ${ctx.includeDesktop ? "`pnpm desktop:setup` checks for Go and Wails, installs them when possible, and prepares the desktop toolchain." : ""}

      ## Development Scripts

      - \`pnpm dev\` starts selected apps with Turbo's TUI, matching the main project.
      - \`pnpm dev:stream\` starts the same apps with plain streamed logs.
      ${ctx.includeWeb ? "- `pnpm dev:web` starts only the web/admin app." : ""}
      ${ctx.includeMobile ? "- `pnpm dev:mobile` starts only the Expo app." : ""}
      ${ctx.backend === "express" ? "- `pnpm dev:server` starts only the Express API server." : ""}
      ${ctx.includeDesktop ? "- `pnpm desktop:setup` checks for Go/Wails and installs them if missing." : ""}
      ${ctx.includeDesktop ? "- `pnpm dev:desktop` starts only the Wails desktop app." : ""}
      ${ctx.includeDesktop ? "- `pnpm dev:desktop:all` starts the API server and desktop app together." : ""}

      ${ctx.includeDesktop ? `The desktop app reuses UI from \`apps/web\` and talks to the Express API at root \`VITE_API_URL\` (default \`http://localhost:${ctx.apiPort}\`). Set that URL to the deployed API before producing a release build.` : ""}

      After \`pnpm db:seed\`, sign in at \`/login\` with the admin user defined in \`packages/db/prisma/seed.mjs\`, or create a new account via sign-up.
    `,
  );
}

function addCursorRules(files, ctx) {
  add(
    files,
    ".cursor/rules/architecture/core.mdc",
    text`
      ---
      alwaysApply: true
      ---

      # Ranger Architecture Contract

      - Keep domain and data-access logic in \`packages/api\`, \`packages/auth\`, and \`packages/db\`; apps are delivery layers.
      - Consume server capabilities through the typed tRPC router instead of duplicating fetch contracts in each app.
      - Never import app code into shared packages.
      - Keep route entry files thin and move stateful orchestration into feature view-model hooks.
      - Treat authentication, authorization, uploads, and environment changes as cross-client changes; verify every enabled client.
      - Run \`pnpm typecheck\` after architectural changes and build the affected app before finishing.
    `,
  );

  add(
    files,
    ".cursor/rules/api/api.mdc",
    text`
      ---
      alwaysApply: true
      ---

      # tRPC Route Rules

      - Every procedure must explicitly use \`publicProcedure\`, \`protectedProcedure\`, or \`adminProcedure\`.
      - Mutations that create, update, delete, upload, or expose private data must not be public.
      - Validate every input with Zod.
      - Check ownership before changing user-owned records.
      - Check role authorization for admin records.
      - Use Prisma transactions when multiple writes must succeed together.
      - Return predictable errors with \`TRPCError\` for unauthorized, forbidden, not found, and bad request cases.
      - Keep routers small and register them in \`packages/api/src/root.ts\`.
    `,
  );

  add(
    files,
    ".cursor/rules/database/database-rule.mdc",
    text`
      ---
      alwaysApply: true
      ---

      # Prisma Schema Rules

      - Preserve existing fields, relations, indexes, \`@map\`, and \`@@map\` unless the change is required.
      - Prefer nullable fields for existing data unless a default is business-correct.
      - Add indexes for foreign keys and common filters.
      - Use \`Cascade\` only for dependent records such as sessions and posts owned by a user.
      - Use \`SetNull\` or \`Restrict\` for business records that must survive parent deletion.
      - Never edit generated Prisma client files.
    `,
  );

  if (ctx.includeWeb) {
    add(
      files,
      `.cursor/rules/web-arch/${ctx.frontend === "react" ? "react-vite" : "nextjs"}.mdc`,
    text`
      ---
      alwaysApply: true
      ---

      # ${ctx.frontend === "react" ? "React + Vite Web Architecture" : "Next.js Web Architecture"}

      - Route definitions live in \`${ctx.frontend === "react" ? "apps/web/src/router.tsx" : "apps/web/src/app/**"}\` and stay thin.
      - Feature code lives under \`apps/web/src/modules/<domain>\`.
      - Admin feature code lives under \`apps/web/src/modules/admin/<domain>\`.
      - Shared UI primitives live under \`apps/web/src/components/ui\`.
      - Business logic belongs in hooks/view-models, routers, schemas, utils, or server libs.
      - Components should render data and call actions returned by hooks.
      ${ctx.frontend === "react" ? "- Use TanStack Router for routes and navigation; do not add React Router or Next.js imports." : "- Keep reusable feature modules client-compatible because the Wails desktop may consume them through Vite aliases."}
      - Import navigation through \`@/lib/navigation\` so feature modules remain desktop-compatible.
      - Use TanStack Query through the typed tRPC React client for server state.
      - Use shadcn-style primitives and keep the visual system black and white.
    `,
    );
  }

  if (ctx.includeMobile) {
    add(
      files,
      ".cursor/rules/mobile-arch/mobile-arch.mdc",
    text`
      ---
      alwaysApply: true
      ---

      # Expo Mobile Architecture

      - Route files live in \`apps/mobile/app/**\` and stay thin.
      - Feature code lives under \`apps/mobile/src/features/<feature>\`.
      - Use MVVM-style hooks in \`hooks/\` for tRPC calls, form orchestration, uploads, and navigation side effects.
      - Screens and components should stay presentational.
      - Use React Native \`StyleSheet\` only for UI styling in this scaffold.
      - Do not add mobile UI libraries unless the project deliberately changes that rule.
    `,
    );
  }

  if (ctx.backend === "express") {
    add(
      files,
      ".cursor/rules/server-arch/server-arch.mdc",
      text`
        ---
        alwaysApply: true
        ---

        # Express Server Architecture

        - Keep Express focused on transport concerns: CORS, auth handlers, tRPC middleware, uploads, and health checks.
        - Add business operations to \`packages/api\` routers, not directly to Express routes.
        - Read runtime configuration from the root \`.env\`; do not create divergent app-local secrets.
        - Protect uploads with an authenticated session, validate MIME type and size, and use randomized server-side filenames.
        - The production server is bundled with tsup; keep \`@repo/api\`, \`@repo/auth\`, and \`@repo/db\` inside the bundle.
      `,
    );
  }

  if (ctx.includeDesktop) {
    add(
      files,
      ".cursor/rules/desktop-arch/desktop-arch.mdc",
      text`
        ---
        alwaysApply: true
        ---

        # Wails Desktop Architecture

        - Reuse \`apps/web/src/modules\` and shared UI through Vite aliases; do not fork product behavior.
        - Web feature modules must import navigation from \`@/lib/navigation\` and data access from \`@/trpc/client\`.
        - Do not introduce browser-only cookie assumptions; desktop auth uses the Better Auth bearer plugin and Go-backed storage.
        - Keep Wails bindings OS-facing. Product logic belongs in shared TypeScript packages or feature view-models.
        - After changing shared web modules, run web typecheck and \`pnpm --filter @repo/desktop-frontend build\`.
        - Use an OS credential vault before shipping sensitive desktop sessions; generated file storage is a development baseline.
      `,
    );
  }
}

function addToolingFiles(files) {
  add(
    files,
    "tooling/typescript-config/package.json",
    json({
      name: "@repo/typescript-config",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        "./base.json": "./base.json",
        "./library.json": "./library.json",
        "./nextjs.json": "./nextjs.json",
        "./expo.json": "./expo.json",
      },
    }),
  );

  add(
    files,
    "tooling/typescript-config/base.json",
    json({
      $schema: "https://json.schemastore.org/tsconfig",
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        resolveJsonModule: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        isolatedModules: true,
      },
    }),
  );

  add(
    files,
    "tooling/typescript-config/library.json",
    json({
      extends: "./base.json",
      compilerOptions: {
        declaration: true,
        declarationMap: true,
        noEmit: true,
      },
    }),
  );

  add(
    files,
    "tooling/typescript-config/nextjs.json",
    json({
      extends: "./base.json",
      compilerOptions: {
        jsx: "preserve",
        allowJs: true,
        noEmit: true,
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "tooling/typescript-config/expo.json",
    json({
      extends: "./base.json",
      compilerOptions: {
        jsx: "react-jsx",
        noEmit: true,
      },
    }),
  );
}

function addDbPackage(files, ctx) {
  add(
    files,
    "packages/db/package.json",
    json({
      name: "@repo/db",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        ".": {
          types: "./src/index.ts",
          default: "./src/index.ts",
        },
      },
      scripts: {
        "db:generate": "prisma generate",
        "db:push": "prisma db push",
        "db:migrate": "prisma migrate dev",
        "db:seed": "prisma db seed",
        "db:studio": "prisma studio",
        lint: "echo \"No db lint configured\"",
        typecheck: "tsc --noEmit",
        clean: "rm -rf .turbo node_modules",
      },
      dependencies: {
        "@prisma/client": "^6.1.0",
      },
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@types/node": "^22.0.0",
        "better-auth": "^1.6.11",
        prisma: "^6.1.0",
        typescript: "^5.6.0",
      },
      prisma: {
        seed: "node prisma/seed.mjs",
      },
    }),
  );

  add(
    files,
    "packages/db/tsconfig.json",
    json({
      extends: "@repo/typescript-config/library.json",
      compilerOptions: {
        outDir: "dist",
      },
      include: ["src/**/*.ts", "prisma/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "packages/db/.env.example",
    dbEnv(ctx),
  );

  add(
    files,
    "packages/db/src/index.ts",
    text`
      import { PrismaClient } from "@prisma/client";

      const fallbackUrl = "postgresql://postgres:postgres@localhost:5432/${ctx.dbName}?schema=public";

      const globalForPrisma = globalThis as unknown as {
        prisma: PrismaClient | undefined;
      };

      export const db =
        globalForPrisma.prisma ??
        new PrismaClient({
          datasourceUrl: process.env.DATABASE_URL ?? fallbackUrl,
          log:
            process.env.NODE_ENV === "development"
              ? ["query", "error", "warn"]
              : ["error"],
        });

      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = db;
      }

      export * from "@prisma/client";
      export type { PrismaClient } from "@prisma/client";
    `,
  );

  add(
    files,
    "packages/db/prisma/schema.prisma",
    text`
      generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

      model User {
        id            String    @id @default(cuid())
        name          String?
        email         String    @unique
        emailVerified Boolean   @default(false)
        image         String?
        role          String?   @default("user")
        banned        Boolean?  @default(false)
        banReason     String?
        banExpires    DateTime?
        createdAt     DateTime  @default(now())
        updatedAt     DateTime  @updatedAt

        accounts Account[]
        sessions Session[]
        posts    Post[]

        @@index([role])
        @@index([banned])
        @@map("user")
      }

      model Session {
        id             String   @id @default(cuid())
        expiresAt      DateTime
        token          String   @unique
        createdAt      DateTime @default(now())
        updatedAt      DateTime @updatedAt
        ipAddress      String?
        userAgent      String?
        impersonatedBy String?
        userId         String
        user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

        @@index([userId])
        @@map("session")
      }

      model Account {
        id                    String    @id @default(cuid())
        accountId             String
        providerId            String
        userId                String
        user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
        accessToken           String?
        refreshToken          String?
        idToken               String?
        accessTokenExpiresAt  DateTime?
        refreshTokenExpiresAt DateTime?
        scope                 String?
        password              String?
        createdAt             DateTime  @default(now())
        updatedAt             DateTime  @updatedAt

        @@unique([providerId, accountId])
        @@index([userId])
        @@map("account")
      }

      model Verification {
        id         String   @id @default(cuid())
        identifier String
        value      String
        expiresAt  DateTime
        createdAt  DateTime @default(now())
        updatedAt  DateTime @updatedAt

        @@map("verification")
      }

      model Post {
        id        String   @id @default(cuid())
        title     String
        content   String?
        imageUrl  String?  @map("image_url")
        published Boolean  @default(false)
        createdAt DateTime @default(now()) @map("created_at")
        updatedAt DateTime @updatedAt @map("updated_at")

        authorId String @map("author_id")
        author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)

        @@index([authorId])
        @@index([published, createdAt])
        @@map("posts")
      }
    `,
  );

  add(
    files,
    "packages/db/prisma/seed.mjs",
    text`
      import { PrismaClient } from "@prisma/client";
      import { hashPassword } from "better-auth/crypto";

      const prisma = new PrismaClient();

      async function main() {
        const email = process.env.SEED_ADMIN_EMAIL || "admin@localhost";
        const password = process.env.SEED_ADMIN_PASSWORD;

        if (!password) {
          throw new Error(
            "Set SEED_ADMIN_PASSWORD in the root .env before running db:seed.",
          );
        }

        const passwordHash = await hashPassword(password);

        const admin = await prisma.user.upsert({
          where: { email },
          update: {
            name: "Super Admin",
            emailVerified: true,
            role: "admin",
            banned: false,
            banReason: null,
            banExpires: null,
          },
          create: {
            email,
            name: "Super Admin",
            emailVerified: true,
            role: "admin",
            banned: false,
            banReason: null,
            banExpires: null,
          },
        });

        await prisma.account.upsert({
          where: {
            providerId_accountId: {
              providerId: "credential",
              accountId: admin.id,
            },
          },
          update: {
            userId: admin.id,
            password: passwordHash,
          },
          create: {
            userId: admin.id,
            providerId: "credential",
            accountId: admin.id,
            password: passwordHash,
          },
        });

        await prisma.post.upsert({
          where: { id: "seed-welcome-post" },
          update: {},
          create: {
            id: "seed-welcome-post",
            title: "Welcome to ${ctx.appTitle}",
            content: "This post was created by the seed script.",
            published: true,
            authorId: admin.id,
          },
        });
      }

      main()
        .then(async () => {
          await prisma.$disconnect();
        })
        .catch(async (error) => {
          console.error("Prisma seed failed", error);
          await prisma.$disconnect();
          process.exit(1);
        });
    `,
  );
}

function addAuthPackage(files, ctx) {
  const nextCookiesImport =
    ctx.backend === "next" ? 'import { nextCookies } from "better-auth/next-js";\n' : "";
  const plugins =
    ctx.backend === "next"
      ? "[admin(), bearer(), nextCookies(), expo()]"
      : "[admin(), bearer(), expo()]";

  add(
    files,
    "packages/auth/package.json",
    json({
      name: "@repo/auth",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        ".": {
          types: "./src/index.ts",
          default: "./src/index.ts",
        },
      },
      scripts: {
        lint: "echo \"No auth lint configured\"",
        typecheck: "tsc --noEmit",
        clean: "rm -rf dist .turbo node_modules",
      },
      dependencies: {
        "@better-auth/expo": "^1.6.11",
        "@better-auth/prisma-adapter": "^1.6.11",
        "@repo/db": "workspace:*",
        "better-auth": "^1.6.11",
      },
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@types/node": "^22.0.0",
        typescript: "^5.6.0",
        ...(ctx.backend === "next" ? { next: "^15.1.0" } : {}),
      },
    }),
  );

  add(
    files,
    "packages/auth/tsconfig.json",
    json({
      extends: "@repo/typescript-config/library.json",
      compilerOptions: {
        outDir: "dist",
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "packages/auth/src/auth.ts",
    text`
      import { betterAuth } from "better-auth";
      import { prismaAdapter } from "@better-auth/prisma-adapter";
      import { admin, bearer } from "better-auth/plugins";
      import { expo } from "@better-auth/expo";
      ${nextCookiesImport}
      import { db } from "@repo/db";

      const baseURL =
        process.env.BETTER_AUTH_URL ??
        process.env.NEXTAUTH_URL ??
        "http://localhost:${ctx.apiPort}";

      const secret =
        process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";

      const appScheme = process.env.EXPO_APP_SCHEME ?? "${ctx.appScheme}";
      const apiPort = process.env.PORT ?? "${ctx.apiPort}";
      const isDev = process.env.NODE_ENV !== "production";
      const trustedOrigins = [
        baseURL.replace(/\\/$/, ""),
        process.env.CORS_ORIGIN,
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4000",
        "http://127.0.0.1:8081",
        ...(process.env.EXPO_APP_SCHEME || isDev
          ? [
              appScheme + "://",
              appScheme + "://*",
              "exp://",
              "exp://**",
              "exp://192.168.*.*:*/*",
              "exp://10.0.2.2:*/*",
              "exp://127.0.0.1:*/*",
              "exp://localhost:*/*",
              "http://10.0.2.2:" + apiPort,
            ]
          : []),
        ...(isDev
          ? [
              "http://localhost:5173",
              "http://localhost:5174",
              "http://localhost:34115",
              "http://127.0.0.1:5173",
              "http://127.0.0.1:5174",
              "http://127.0.0.1:34115",
              "http://localhost:*",
              "http://127.0.0.1:*",
              "http://wails.localhost",
              "http://wails.localhost:*",
              "wails://",
              "wails://*",
            ]
          : []),
      ].filter((origin): origin is string => Boolean(origin));

      export const auth = betterAuth({
        database: prismaAdapter(db, {
          provider: "postgresql",
        }),
        secret,
        baseURL,
        trustedOrigins,
        emailAndPassword: {
          enabled: true,
          autoSignIn: true,
          requireEmailVerification: false,
        },
        user: {
          additionalFields: {
            role: {
              type: "string",
              required: false,
              input: false,
            },
            banned: {
              type: "boolean",
              required: false,
              input: false,
            },
          },
        },
        plugins: ${plugins},
      }) as unknown as ReturnType<typeof betterAuth>;
    `,
  );

  add(
    files,
    "packages/auth/src/session.ts",
    text`
      import { auth } from "./auth";

      export type Session = {
        user: {
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
          role: string | null;
        };
      };

      export async function getSession(headers: Headers): Promise<Session | null> {
        const result = await auth.api.getSession({ headers });

        if (!result) {
          return null;
        }

        const user = result.user as typeof result.user & {
          role?: string | null;
        };

        return {
          user: {
            id: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
            image: user.image ?? null,
            role: user.role ?? null,
          },
        };
      }
    `,
  );

  add(
    files,
    "packages/auth/src/index.ts",
    text`
      export { auth } from "./auth";
      export { getSession } from "./session";
      export type { Session } from "./session";
      export { hashPassword, verifyPassword } from "better-auth/crypto";
    `,
  );
}

function addApiPackage(files) {
  add(
    files,
    "packages/api/package.json",
    json({
      name: "@repo/api",
      version: "0.0.0",
      private: true,
      type: "module",
      exports: {
        ".": {
          types: "./src/index.ts",
          default: "./src/index.ts",
        },
      },
      scripts: {
        lint: "echo \"No api lint configured\"",
        typecheck: "tsc --noEmit",
        clean: "rm -rf dist .turbo node_modules",
      },
      dependencies: {
        "@repo/auth": "workspace:*",
        "@repo/db": "workspace:*",
        "@trpc/server": "^11.0.0",
        superjson: "^2.2.1",
        zod: "^3.23.0",
      },
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@types/node": "^22.0.0",
        typescript: "^5.6.0",
      },
    }),
  );

  add(
    files,
    "packages/api/tsconfig.json",
    json({
      extends: "@repo/typescript-config/library.json",
      compilerOptions: {
        outDir: "dist",
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "packages/api/src/index.ts",
    text`
      export { appRouter } from "./root";
      export type { AppRouter } from "./root";
      export type { RouterInputs, RouterOutputs } from "./types";
      export {
        adminProcedure,
        createCallerFactory,
        createTRPCRouter,
        protectedProcedure,
        publicProcedure,
      } from "./trpc";
      export type { CreateContextOptions } from "./trpc";
    `,
  );

  add(
    files,
    "packages/api/src/types.ts",
    text`
      import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

      import type { AppRouter } from "./root";

      export type RouterInputs = inferRouterInputs<AppRouter>;
      export type RouterOutputs = inferRouterOutputs<AppRouter>;
    `,
  );

  add(
    files,
    "packages/api/src/root.ts",
    text`
      import { createTRPCRouter } from "./trpc";
      import { authRouter } from "./routers/auth";
      import { dashboardRouter } from "./routers/dashboard";
      import { postRouter } from "./routers/post";
      import { userRouter } from "./routers/user";

      export const appRouter = createTRPCRouter({
        auth: authRouter,
        dashboard: dashboardRouter,
        post: postRouter,
        user: userRouter,
      });

      export type AppRouter = typeof appRouter;
    `,
  );

  add(
    files,
    "packages/api/src/trpc.ts",
    text`
      import { initTRPC, TRPCError } from "@trpc/server";
      import superjson from "superjson";
      import { ZodError } from "zod";

      import type { Session } from "@repo/auth";
      import type { db as dbClient } from "@repo/db";

      export interface CreateContextOptions {
        session: Session | null;
        db: typeof dbClient;
      }

      const t = initTRPC.context<CreateContextOptions>().create({
        transformer: superjson,
        errorFormatter({ shape, error }) {
          return {
            ...shape,
            data: {
              ...shape.data,
              zodError:
                error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
          };
        },
      });

      export const createCallerFactory = t.createCallerFactory;
      export const createTRPCRouter = t.router;

      const timingMiddleware = t.middleware(async ({ next, path }) => {
        const start = Date.now();
        const result = await next();
        const end = Date.now();

        if (process.env.NODE_ENV === "development") {
          console.log("[tRPC] " + path + " took " + (end - start) + "ms");
        }

        return result;
      });

      export const publicProcedure = t.procedure.use(timingMiddleware);

      const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
        if (!ctx.session?.user) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return next({
          ctx: {
            session: { ...ctx.session, user: ctx.session.user },
          },
        });
      });

      export const protectedProcedure = t.procedure
        .use(timingMiddleware)
        .use(enforceUserIsAuthed);

      const STAFF_ROLES = ["admin", "owner", "manager", "staff"] as const;

      export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
        const userRole = ctx.session.user.role;

        if (!userRole || !STAFF_ROLES.includes(userRole as (typeof STAFF_ROLES)[number])) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to perform this action.",
          });
        }

        return next();
      });
    `,
  );

  add(
    files,
    "packages/api/src/routers/auth.ts",
    text`
      import { TRPCError } from "@trpc/server";
      import { z } from "zod";

      import { auth } from "@repo/auth";

      import { createTRPCRouter, publicProcedure } from "../trpc";

      const registerInput = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).optional(),
      });

      const loginInput = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      export const authRouter = createTRPCRouter({
        register: publicProcedure.input(registerInput).mutation(async ({ input }) => {
          try {
            const name = input.name ?? input.email.split("@")[0] ?? "User";
            const result = await auth.api.signUpEmail({
              body: {
                email: input.email,
                password: input.password,
                name,
              },
            });

            return {
              token: result.token,
              user: result.user,
            };
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                error instanceof Error ? error.message : "Registration failed",
            });
          }
        }),

        login: publicProcedure.input(loginInput).mutation(async ({ input }) => {
          try {
            const result = await auth.api.signInEmail({
              body: {
                email: input.email,
                password: input.password,
              },
            });

            return {
              token: result.token,
              user: result.user,
            };
          } catch {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Invalid email or password",
            });
          }
        }),
      });
    `,
  );

  add(
    files,
    "packages/api/src/routers/post.ts",
    text`
      import { TRPCError } from "@trpc/server";
      import { z } from "zod";

      import {
        adminProcedure,
        createTRPCRouter,
        protectedProcedure,
        publicProcedure,
      } from "../trpc";

      const listInput = z
        .object({
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().nullish(),
        })
        .optional();

      export const postRouter = createTRPCRouter({
        getAll: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
          const limit = input?.limit ?? 50;
          const cursor = input?.cursor;

          const posts = await ctx.db.post.findMany({
            take: limit + 1,
            where: { published: true },
            orderBy: { createdAt: "desc" },
            include: {
              author: {
                select: { id: true, name: true, image: true },
              },
            },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          });

          let nextCursor: string | undefined;
          if (posts.length > limit) {
            const nextItem = posts.pop();
            nextCursor = nextItem?.id;
          }

          return { posts, nextCursor };
        }),

        getMyPosts: protectedProcedure.query(({ ctx }) => {
          return ctx.db.post.findMany({
            where: { authorId: ctx.session.user.id },
            orderBy: { createdAt: "desc" },
          });
        }),

        create: protectedProcedure
          .input(
            z.object({
              title: z.string().trim().min(1).max(200),
              content: z.string().trim().max(10000).optional(),
              imageUrl: z.string().url().optional(),
              published: z.boolean().default(true),
            }),
          )
          .mutation(({ ctx, input }) => {
            return ctx.db.post.create({
              data: {
                title: input.title,
                content: input.content || null,
                imageUrl: input.imageUrl ?? null,
                published: input.published,
                author: {
                  connect: { id: ctx.session.user.id },
                },
              },
            });
          }),

        deleteMine: protectedProcedure
          .input(z.object({ id: z.string().min(1) }))
          .mutation(async ({ ctx, input }) => {
            const post = await ctx.db.post.findUnique({
              where: { id: input.id },
              select: { id: true, authorId: true },
            });

            if (!post) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
            }

            if (post.authorId !== ctx.session.user.id) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You cannot delete this post.",
              });
            }

            return ctx.db.post.delete({ where: { id: input.id } });
          }),

        adminList: adminProcedure
          .input(
            z
              .object({
                limit: z.number().min(1).max(100).default(100),
              })
              .optional(),
          )
          .query(({ ctx, input }) => {
            return ctx.db.post.findMany({
              take: input?.limit ?? 100,
              orderBy: { createdAt: "desc" },
              include: {
                author: {
                  select: { id: true, name: true, email: true },
                },
              },
            });
          }),

        adminDelete: adminProcedure
          .input(z.object({ id: z.string().min(1) }))
          .mutation(({ ctx, input }) => {
            return ctx.db.post.delete({ where: { id: input.id } });
          }),
      });
    `,
  );

  add(
    files,
    "packages/api/src/routers/user.ts",
    text`
      import { z } from "zod";

      import {
        adminProcedure,
        createTRPCRouter,
        protectedProcedure,
        publicProcedure,
      } from "../trpc";

      const publicUserSelect = {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      } as const;

      const privateUserSelect = {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
      } as const;

      export const userRouter = createTRPCRouter({
        me: publicProcedure.query(async ({ ctx }) => {
          if (!ctx.session?.user) {
            return null;
          }

          return ctx.db.user.findUnique({
            where: { id: ctx.session.user.id },
            select: privateUserSelect,
          });
        }),

        getById: publicProcedure
          .input(z.object({ id: z.string().min(1) }))
          .query(({ ctx, input }) => {
            return ctx.db.user.findUnique({
              where: { id: input.id },
              select: publicUserSelect,
            });
          }),

        adminList: adminProcedure
          .input(
            z
              .object({
                limit: z.number().min(1).max(100).default(100),
              })
              .optional(),
          )
          .query(({ ctx, input }) => {
            return ctx.db.user.findMany({
              take: input?.limit ?? 100,
              orderBy: { createdAt: "desc" },
              select: privateUserSelect,
            });
          }),
      });
    `,
  );

  add(
    files,
    "packages/api/src/routers/dashboard.ts",
    text`
      import { createTRPCRouter, adminProcedure } from "../trpc";

      export const dashboardRouter = createTRPCRouter({
        summary: adminProcedure.query(async ({ ctx }) => {
          const [postCount, userCount, publishedPostCount] = await ctx.db.$transaction([
            ctx.db.post.count(),
            ctx.db.user.count(),
            ctx.db.post.count({ where: { published: true } }),
          ]);

          const latestPosts = await ctx.db.post.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              author: {
                select: { id: true, name: true, email: true },
              },
            },
          });

          return {
            postCount,
            userCount,
            publishedPostCount,
            latestPosts,
          };
        }),
      });
    `,
  );
}

function addWebApp(files, ctx) {
  if (ctx.frontend === "react") {
    addReactWebApp(files, ctx);
    return;
  }

  addNextWebApp(files, ctx);
}

function addNextWebApp(files, ctx) {
  const deps = {
    "@repo/api": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "better-auth": "^1.6.11",
    "class-variance-authority": "^0.7.0",
    clsx: "^2.1.1",
    "lucide-react": "^0.546.0",
    next: "^15.1.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    superjson: "^2.2.1",
    "tailwind-merge": "^2.5.4",
    zod: "^3.23.0",
  };

  if (ctx.backend === "next") {
    deps["@repo/auth"] = "workspace:*";
    deps["@repo/db"] = "workspace:*";
  }

  add(
    files,
    "apps/web/package.json",
    json({
      name: "@repo/web",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "next dev --port 3000 --hostname 0.0.0.0",
        build: "next build",
        start: "next start",
        lint: "next lint",
        typecheck: "tsc --noEmit",
        clean: "rm -rf .next .turbo node_modules",
      },
      dependencies: deps,
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@tailwindcss/postcss": "^4.0.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        postcss: "^8.4.49",
        tailwindcss: "^4.0.0",
        typescript: "^5.6.0",
      },
    }),
  );

  add(
    files,
    "apps/web/next.config.mjs",
    text`
      /** @type {import("next").NextConfig} */
      const nextConfig = {
        transpilePackages: ["@repo/api", "@repo/auth", "@repo/db"],
      };

      export default nextConfig;
    `,
  );

  add(
    files,
    "apps/web/.env.example",
    webEnv(ctx),
  );

  add(
    files,
    "apps/web/postcss.config.mjs",
    text`
      const config = {
        plugins: {
          "@tailwindcss/postcss": {},
        },
      };

      export default config;
    `,
  );

  add(
    files,
    "apps/web/tsconfig.json",
    json({
      extends: "@repo/typescript-config/nextjs.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "~/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules", ".next"],
    }),
  );

  add(
    files,
    "apps/web/src/styles/theme.css",
    text`
      :root {
        color-scheme: light;
        --background: #ffffff;
        --foreground: #0a0a0a;
        --muted: #f5f5f5;
        --border: #d4d4d4;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
        background: var(--background);
        color: var(--foreground);
      }

      body {
        margin: 0;
        font-family:
          Arial,
          Helvetica,
          sans-serif;
      }

      a {
        text-decoration: none;
      }

      @layer components {
        .ui-btn {
          display: inline-flex;
          height: 2.5rem;
          min-width: 5rem;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          padding-inline: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: 1;
          transition:
            background-color 150ms ease,
            color 150ms ease,
            border-color 150ms ease;
        }

        .ui-btn:disabled {
          pointer-events: none;
          opacity: 0.5;
        }

        .ui-btn-primary {
          background-color: #000000;
          color: #ffffff;
        }

        .ui-btn-primary:hover {
          background-color: #262626;
          color: #ffffff;
        }

        .ui-btn-outline {
          border: 1px solid #d4d4d4;
          background-color: #ffffff;
          color: #000000;
        }

        .ui-btn-outline:hover {
          background-color: #f5f5f5;
          color: #000000;
        }

        .ui-btn-ghost {
          background-color: transparent;
          color: #000000;
        }

        .ui-btn-ghost:hover {
          background-color: #f5f5f5;
          color: #000000;
        }
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/globals.css",
    text`
      @import "tailwindcss";
      @source "../**/*.{js,ts,jsx,tsx}";

      @import "../styles/theme.css";
    `,
  );

  add(
    files,
    "apps/web/src/app/layout.tsx",
    text`
      import "./globals.css";
      import type { Metadata } from "next";

      import { Providers } from "@/components/providers";

      export const metadata: Metadata = {
        title: "${ctx.appTitle}",
        description: "${ctx.appTitle} admin and post app",
      };

      export default function RootLayout({
        children,
      }: Readonly<{
        children: React.ReactNode;
      }>) {
        return (
          <html lang="en">
            <body>
              <Providers>{children}</Providers>
            </body>
          </html>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/components/providers.tsx",
    text`
      "use client";

      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { type ReactNode, useState } from "react";

      import { createTRPCClient, trpc } from "@/trpc/client";

      export function Providers({ children }: { children: ReactNode }) {
        const [queryClient] = useState(
          () =>
            new QueryClient({
              defaultOptions: {
                queries: {
                  staleTime: 30_000,
                  refetchOnWindowFocus: false,
                  retry: 1,
                },
              },
            }),
        );
        const [trpcClient] = useState(() => createTRPCClient());

        return (
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </trpc.Provider>
        );
      }
    `,
  );

  addWebShared(files, ctx);
  addNextWebRoutes(files);
  addWebModules(files);

  if (ctx.backend === "next") {
    addNextBackend(files);
  }
}

function addReactWebApp(files, ctx) {
  add(
    files,
    "apps/web/package.json",
    json({
      name: "@repo/web",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite --host 0.0.0.0 --port 3000",
        build: "tsc --noEmit && vite build",
        preview: "vite preview --host 0.0.0.0 --port 3000",
        lint: "echo \"No web lint configured\"",
        typecheck: "tsc --noEmit",
        clean: "rm -rf dist .turbo node_modules",
      },
      dependencies: {
        "@repo/api": "workspace:*",
        "@tanstack/react-query": "^5.60.0",
        "@tanstack/react-router": "^1.120.5",
        "@trpc/client": "^11.0.0",
        "@trpc/react-query": "^11.0.0",
        "@trpc/server": "^11.0.0",
        "better-auth": "^1.6.11",
        "class-variance-authority": "^0.7.0",
        clsx: "^2.1.1",
        "lucide-react": "^0.546.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        superjson: "^2.2.1",
        "tailwind-merge": "^2.5.4",
        zod: "^3.23.0",
      },
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@tailwindcss/vite": "^4.0.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "@vitejs/plugin-react": "^4.5.2",
        tailwindcss: "^4.0.0",
        typescript: "^5.6.0",
        vite: "^6.3.5",
      },
    }),
  );

  add(files, "apps/web/.env.example", webEnv(ctx));

  add(
    files,
    "apps/web/index.html",
    text`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="description" content="${ctx.appTitle} admin and post app" />
          <title>${ctx.appTitle}</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="/src/main.tsx"></script>
        </body>
      </html>
    `,
  );

  add(
    files,
    "apps/web/tsconfig.json",
    json({
      extends: "@repo/typescript-config/base.json",
      compilerOptions: {
        target: "ESNext",
        lib: ["DOM", "DOM.Iterable", "ESNext"],
        jsx: "react-jsx",
        noEmit: true,
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "~/*": ["./src/*"],
        },
        types: ["vite/client"],
      },
      include: ["src", "vite.config.ts"],
      exclude: ["node_modules", "dist"],
    }),
  );

  add(
    files,
    "apps/web/vite.config.ts",
    text`
      import path from "node:path";
      import { fileURLToPath } from "node:url";

      import tailwindcss from "@tailwindcss/vite";
      import react from "@vitejs/plugin-react";
      import { defineConfig } from "vite";

      const __dirname = path.dirname(fileURLToPath(import.meta.url));

      export default defineConfig({
        envDir: path.resolve(__dirname, "../.."),
        plugins: [react(), tailwindcss()],
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
        server: {
          host: "0.0.0.0",
          port: 3000,
          strictPort: true,
        },
      });
    `,
  );

  add(
    files,
    "apps/web/src/styles/theme.css",
    text`
      :root {
        color-scheme: light;
        --background: #ffffff;
        --foreground: #0a0a0a;
        --muted: #f5f5f5;
        --border: #d4d4d4;
      }

      * { box-sizing: border-box; }
      html, body, #root { min-height: 100%; }
      html, body { background: var(--background); color: var(--foreground); }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
      a { text-decoration: none; color: inherit; }

      @layer components {
        .ui-btn {
          display: inline-flex;
          height: 2.5rem;
          min-width: 5rem;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          padding-inline: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: 1;
          transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
        }
        .ui-btn:disabled { pointer-events: none; opacity: 0.5; }
        .ui-btn-primary { background-color: #000000; color: #ffffff; }
        .ui-btn-primary:hover { background-color: #262626; color: #ffffff; }
        .ui-btn-outline { border: 1px solid #d4d4d4; background-color: #ffffff; color: #000000; }
        .ui-btn-outline:hover { background-color: #f5f5f5; color: #000000; }
        .ui-btn-ghost { background-color: transparent; color: #000000; }
        .ui-btn-ghost:hover { background-color: #f5f5f5; color: #000000; }
      }
    `,
  );

  add(
    files,
    "apps/web/src/styles/globals.css",
    text`
      @import "tailwindcss";
      @source "../**/*.{js,ts,jsx,tsx}";
      @import "./theme.css";
    `,
  );

  add(
    files,
    "apps/web/src/components/providers.tsx",
    text`
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { type ReactNode, useState } from "react";

      import { createTRPCClient, trpc } from "@/trpc/client";

      export function Providers({ children }: { children: ReactNode }) {
        const [queryClient] = useState(
          () => new QueryClient({
            defaultOptions: {
              queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
            },
          }),
        );
        const [trpcClient] = useState(() => createTRPCClient());

        return (
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </trpc.Provider>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/router.tsx",
    text`
      import {
        Outlet,
        createRootRoute,
        createRoute,
        createRouter,
      } from "@tanstack/react-router";

      import { AdminDashboard } from "@/modules/admin/dashboard/components/admin-dashboard";
      import { AdminPostsPage } from "@/modules/admin/posts/components/admin-posts-page";
      import { AdminShell } from "@/modules/admin/shared/components/admin-shell";
      import { AdminUsersPage } from "@/modules/admin/users/components/admin-users-page";
      import { LoginPage } from "@/modules/auth/components/login-page";
      import { PostsPage } from "@/modules/posts/components/posts-page";

      const rootRoute = createRootRoute({ component: Outlet });
      const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: PostsPage });
      const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
      const adminRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/admin",
        component: () => <AdminShell><Outlet /></AdminShell>,
      });
      const adminIndexRoute = createRoute({ getParentRoute: () => adminRoute, path: "/", component: AdminDashboard });
      const adminPostsRoute = createRoute({ getParentRoute: () => adminRoute, path: "/posts", component: AdminPostsPage });
      const adminUsersRoute = createRoute({ getParentRoute: () => adminRoute, path: "/users", component: AdminUsersPage });

      const routeTree = rootRoute.addChildren([
        homeRoute,
        loginRoute,
        adminRoute.addChildren([adminIndexRoute, adminPostsRoute, adminUsersRoute]),
      ]);

      export const router = createRouter({ routeTree });

      declare module "@tanstack/react-router" {
        interface Register {
          router: typeof router;
        }
      }
    `,
  );

  add(
    files,
    "apps/web/src/main.tsx",
    text`
      import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import { RouterProvider } from "@tanstack/react-router";

      import { Providers } from "@/components/providers";
      import { router } from "@/router";
      import "@/styles/globals.css";

      const root = document.getElementById("root");
      if (!root) throw new Error("Root element not found.");

      createRoot(root).render(
        <StrictMode>
          <Providers>
            <RouterProvider router={router} />
          </Providers>
        </StrictMode>,
      );
    `,
  );

  add(files, "apps/web/src/vite-env.d.ts", '/// <reference types="vite/client" />\n');

  addWebShared(files, ctx);
  addWebModules(files);
}

function addWebShared(files, ctx) {
  add(
    files,
    "apps/web/src/lib/api-url.ts",
    text`
      export function getApiBaseUrl() {
        return (${ctx.frontend === "react" ? "import.meta.env.VITE_API_URL" : "process.env.NEXT_PUBLIC_API_URL"} ?? "").replace(/\\/$/, "");
      }
    `,
  );

  add(
    files,
    "apps/web/src/lib/navigation.tsx",
    text`
      ${ctx.frontend === "react" ? 'import { Link, useNavigate } from "@tanstack/react-router";' : 'import Link from "next/link";\nimport { useRouter } from "next/navigation";'}
      import type { ReactNode } from "react";

      export function AppLink({
        to,
        className,
        children,
      }: {
        to: string;
        className?: string;
        children: ReactNode;
      }) {
        return (
          <Link ${ctx.frontend === "react" ? "to={to as never}" : "href={to}"} className={className}>
            {children}
          </Link>
        );
      }

      export function useAppNavigation() {
        ${ctx.frontend === "react" ? "const navigate = useNavigate();" : "const router = useRouter();"}

        return {
          navigate(to: string) {
            ${ctx.frontend === "react" ? "void navigate({ to: to as never });" : "router.push(to);"}
          },
          refresh() {
            ${ctx.frontend === "react" ? "// TanStack Query refetches route data after navigation." : "router.refresh();"}
          },
          getSearchParam(name: string) {
            return new URLSearchParams(window.location.search).get(name);
          },
        };
      }
    `,
  );

  add(
    files,
    "apps/web/src/lib/utils.ts",
    text`
      import { type ClassValue, clsx } from "clsx";
      import { twMerge } from "tailwind-merge";

      export function cn(...inputs: ClassValue[]) {
        return twMerge(clsx(inputs));
      }
    `,
  );

  add(
    files,
    "apps/web/src/lib/auth-client.ts",
    text`
      "use client";

      import { adminClient } from "better-auth/client/plugins";
      import { createAuthClient } from "better-auth/react";

      import { getApiBaseUrl } from "@/lib/api-url";

      export const authClient = createAuthClient({
        baseURL: getApiBaseUrl() || undefined,
        plugins: [adminClient()],
      });
    `,
  );

  add(
    files,
    "apps/web/src/trpc/client.tsx",
    text`
      "use client";

      import type { AppRouter } from "@repo/api";
      import { httpBatchLink } from "@trpc/client";
      import { createTRPCReact } from "@trpc/react-query";
      import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
      import superjson from "superjson";

      import { getApiBaseUrl } from "@/lib/api-url";

      export const trpc = createTRPCReact<AppRouter>();
      export type RouterInputs = inferRouterInputs<AppRouter>;
      export type RouterOutputs = inferRouterOutputs<AppRouter>;

      export function createTRPCClient() {
        return trpc.createClient({
          links: [
            httpBatchLink({
              transformer: superjson,
              url: getApiBaseUrl() + "/api/trpc",
              fetch(url, options) {
                return fetch(url, {
                  ...options,
                  credentials: "include",
                });
              },
              headers: () => ({
                "x-trpc-source": "${ctx.frontend === "react" ? "vite-react" : "nextjs-react"}",
              }),
            }),
          ],
        });
      }
    `,
  );

  add(
    files,
    "apps/web/src/components/ui/button.tsx",
    text`
      import * as React from "react";

      import { cn } from "@/lib/utils";

      type ButtonVariant = "default" | "outline" | "ghost";

      const variantClassName: Record<ButtonVariant, string> = {
        default: "ui-btn ui-btn-primary",
        outline: "ui-btn ui-btn-outline",
        ghost: "ui-btn ui-btn-ghost",
      };

      export function buttonClassName(
        variant: ButtonVariant = "default",
        className?: string,
      ) {
        return cn(variantClassName[variant], className);
      }

      type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
      };

      export function Button({
        className,
        variant = "default",
        type = "button",
        ...props
      }: ButtonProps) {
        return (
          <button
            type={type}
            className={buttonClassName(variant, className)}
            {...props}
          />
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/components/ui/input.tsx",
    text`
      import * as React from "react";

      import { cn } from "@/lib/utils";

      export function Input({
        className,
        ...props
      }: React.InputHTMLAttributes<HTMLInputElement>) {
        return (
          <input
            className={cn(
              "flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          />
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/components/ui/textarea.tsx",
    text`
      import * as React from "react";

      import { cn } from "@/lib/utils";

      export function Textarea({
        className,
        ...props
      }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
        return (
          <textarea
            className={cn(
              "min-h-28 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          />
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/components/ui/card.tsx",
    text`
      import * as React from "react";

      import { cn } from "@/lib/utils";

      export function Card({
        className,
        ...props
      }: React.HTMLAttributes<HTMLDivElement>) {
        return (
          <div
            className={cn("rounded-lg border border-neutral-200 bg-white", className)}
            {...props}
          />
        );
      }
    `,
  );
}

function addNextWebRoutes(files) {
  add(
    files,
    "apps/web/src/app/page.tsx",
    text`
      import { PostsPage } from "@/modules/posts/components/posts-page";

      export default function HomeRoute() {
        return <PostsPage />;
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/login/page.tsx",
    text`
      import { LoginPage } from "@/modules/auth/components/login-page";

      export default function LoginRoute() {
        return <LoginPage />;
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/admin/layout.tsx",
    text`
      import { AdminShell } from "@/modules/admin/shared/components/admin-shell";

      export default function AdminLayout({
        children,
      }: {
        children: React.ReactNode;
      }) {
        return <AdminShell>{children}</AdminShell>;
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/admin/page.tsx",
    text`
      import { AdminDashboard } from "@/modules/admin/dashboard/components/admin-dashboard";

      export default function AdminRoute() {
        return <AdminDashboard />;
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/admin/posts/page.tsx",
    text`
      import { AdminPostsPage } from "@/modules/admin/posts/components/admin-posts-page";

      export default function AdminPostsRoute() {
        return <AdminPostsPage />;
      }
    `,
  );

  add(
    files,
    "apps/web/src/app/admin/users/page.tsx",
    text`
      import { AdminUsersPage } from "@/modules/admin/users/components/admin-users-page";

      export default function AdminUsersRoute() {
        return <AdminUsersPage />;
      }
    `,
  );
}

function addWebModules(files) {
  add(
    files,
    "apps/web/src/modules/auth/hooks/use-auth-view-model.ts",
    text`
      "use client";

      import { useState } from "react";

      import { authClient } from "@/lib/auth-client";
      import { useAppNavigation } from "@/lib/navigation";

      export function useAuthViewModel() {
        const navigation = useAppNavigation();
        const [mode, setMode] = useState<"login" | "register">("login");
        const [name, setName] = useState("");
        const [email, setEmail] = useState("");
        const [password, setPassword] = useState("");
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const [isPending, setIsPending] = useState(false);

        async function submit() {
          setErrorMessage(null);
          setIsPending(true);

          try {
            const result = mode === "login"
              ? await authClient.signIn.email({ email, password })
              : await authClient.signUp.email({
                  email,
                  password,
                  name: name.trim() || email.split("@")[0] || "User",
                });

            if (result.error) {
              setErrorMessage(result.error.message || "Authentication failed.");
              return;
            }

            navigation.navigate(navigation.getSearchParam("callbackUrl") || "/");
            navigation.refresh();
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Authentication failed.",
            );
          } finally {
            setIsPending(false);
          }
        }

        return {
          mode,
          setMode,
          name,
          setName,
          email,
          setEmail,
          password,
          setPassword,
          errorMessage,
          isPending,
          submit,
        };
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/auth/components/login-page.tsx",
    text`
      "use client";

      import { Button } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { Input } from "@/components/ui/input";
      import { useAuthViewModel } from "../hooks/use-auth-view-model";

      export function LoginPage() {
        const vm = useAuthViewModel();

        return (
          <main className="flex min-h-screen items-center justify-center bg-white p-6 text-black">
            <Card className="w-full max-w-md p-6">
              <div className="mb-6 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {vm.mode === "login" ? "Welcome back" : "Create account"}
                </p>
                <h1 className="text-2xl font-semibold">Sign in to your workspace</h1>
              </div>

              <form onSubmit={(event) => { event.preventDefault(); void vm.submit(); }} className="space-y-4">
                {vm.mode === "register" ? (
                  <Input
                    value={vm.name}
                    onChange={(event) => vm.setName(event.target.value)}
                    placeholder="Name"
                  />
                ) : null}
                <Input
                  value={vm.email}
                  onChange={(event) => vm.setEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                />
                <Input
                  value={vm.password}
                  onChange={(event) => vm.setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                />
                {vm.errorMessage ? (
                  <p className="rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-800">
                    {vm.errorMessage}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={vm.isPending}>
                  {vm.isPending ? "Please wait..." : vm.mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => vm.setMode(vm.mode === "login" ? "register" : "login")}
              >
                {vm.mode === "login" ? "Create a new account" : "Use an existing account"}
              </Button>
            </Card>
          </main>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/posts/hooks/use-posts-view-model.ts",
    text`
      "use client";

      import { useState } from "react";

      import { authClient } from "@/lib/auth-client";
      import { getApiBaseUrl } from "@/lib/api-url";
      import { trpc } from "@/trpc/client";

      async function uploadImage(file: File) {
        const formData = new FormData();
        formData.append("folder", "posts");
        formData.append("file", file);

        const response = await fetch(getApiBaseUrl() + "/api/uploads", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || "Image upload failed.");
        }

        const payload = (await response.json()) as { url: string };
        return payload.url;
      }

      export function usePostsViewModel() {
        const utils = trpc.useUtils();
        const [title, setTitle] = useState("");
        const [content, setContent] = useState("");
        const [imageFile, setImageFile] = useState<File | null>(null);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);

        const postsQuery = trpc.post.getAll.useQuery({ limit: 50 });
        const meQuery = trpc.user.me.useQuery(undefined, {
          retry: false,
          refetchOnWindowFocus: false,
        });

        const createMutation = trpc.post.create.useMutation({
          onSuccess() {
            setTitle("");
            setContent("");
            setImageFile(null);
            void utils.post.getAll.invalidate();
            void utils.post.getMyPosts.invalidate();
          },
        });

        async function createPost() {
          setErrorMessage(null);

          try {
            const imageUrl = imageFile ? await uploadImage(imageFile) : undefined;
            await createMutation.mutateAsync({
              title,
              content,
              imageUrl,
              published: true,
            });
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Failed to create post.",
            );
          }
        }

        async function signOut() {
          await authClient.signOut();
          await utils.user.me.invalidate();
          await meQuery.refetch();
        }

        return {
          posts: postsQuery.data?.posts ?? [],
          isLoading: postsQuery.isLoading,
          isAuthed: Boolean(meQuery.data),
          title,
          setTitle,
          content,
          setContent,
          setImageFile,
          errorMessage,
          isCreating: createMutation.isPending,
          createPost,
          signOut,
        };
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/posts/components/posts-page.tsx",
    text`
      "use client";

      import { Button, buttonClassName } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { Input } from "@/components/ui/input";
      import { Textarea } from "@/components/ui/textarea";
      import { AppLink } from "@/lib/navigation";

      import { usePostsViewModel } from "../hooks/use-posts-view-model";

      export function PostsPage() {
        const vm = usePostsViewModel();

        return (
          <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-8 text-black">
            <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  Ranger App
                </p>
                <h1 className="text-3xl font-semibold">Posts</h1>
              </div>
              <nav className="flex gap-2">
                <AppLink to="/admin" className={buttonClassName("outline")}>
                  Admin
                </AppLink>
                {vm.isAuthed ? (
                  <Button variant="ghost" onClick={vm.signOut}>
                    Sign out
                  </Button>
                ) : (
                  <AppLink to="/login" className={buttonClassName()}>
                    Sign in
                  </AppLink>
                )}
              </nav>
            </header>

            <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="p-5">
                <h2 className="mb-4 text-lg font-semibold">Create post</h2>
                {vm.isAuthed ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void vm.createPost();
                    }}
                  >
                    <Input
                      value={vm.title}
                      onChange={(event) => vm.setTitle(event.target.value)}
                      placeholder="Post title"
                    />
                    <Textarea
                      value={vm.content}
                      onChange={(event) => vm.setContent(event.target.value)}
                      placeholder="Write something"
                    />
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) =>
                        vm.setImageFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {vm.errorMessage ? (
                      <p className="text-sm text-neutral-700">{vm.errorMessage}</p>
                    ) : null}
                    <Button type="submit" disabled={vm.isCreating || !vm.title.trim()}>
                      {vm.isCreating ? "Publishing..." : "Publish"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-600">
                      Sign in before creating a post or uploading an image.
                    </p>
                    <AppLink to="/login" className={buttonClassName()}>
                      Sign in
                    </AppLink>
                  </div>
                )}
              </Card>

              <div className="space-y-4">
                {vm.isLoading ? <p className="text-sm text-neutral-500">Loading posts...</p> : null}
                {vm.posts.map((post) => (
                  <Card key={post.id} className="overflow-hidden">
                    {post.imageUrl ? (
                      <div className="relative aspect-[16/9] w-full bg-neutral-100">
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2 p-5">
                      <h2 className="text-xl font-semibold">{post.title}</h2>
                      {post.content ? (
                        <p className="text-sm leading-6 text-neutral-700">{post.content}</p>
                      ) : null}
                      <p className="text-xs text-neutral-500">
                        By {post.author?.name || "Unknown"}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </main>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/admin/shared/components/admin-shell.tsx",
    text`
      "use client";

      import { Button, buttonClassName } from "@/components/ui/button";
      import { authClient } from "@/lib/auth-client";
      import { AppLink } from "@/lib/navigation";
      import { trpc } from "@/trpc/client";

      function isDashboardRole(role: string | null | undefined) {
        return ["admin", "owner", "manager", "staff"].includes(role ?? "");
      }

      export function AdminShell({ children }: { children: React.ReactNode }) {
        const meQuery = trpc.user.me.useQuery(undefined, {
          retry: false,
          refetchOnWindowFocus: false,
        });

        async function signOut() {
          await authClient.signOut();
          window.location.href = "/login";
        }

        if (meQuery.isLoading) {
          return <main className="p-8 text-sm text-neutral-500">Loading admin...</main>;
        }

        const adminUser = meQuery.data;

        if (!adminUser || !isDashboardRole(adminUser.role)) {
          return (
            <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6 text-black">
              <h1 className="text-2xl font-semibold">Admin access required</h1>
              <p className="text-sm text-neutral-600">
                Sign in with an admin, owner, manager, or staff account.
              </p>
              <AppLink to="/login?callbackUrl=/admin" className={buttonClassName()}>
                Sign in
              </AppLink>
            </main>
          );
        }

        return (
          <div className="min-h-screen bg-white text-black">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 p-5 md:block">
              <AppLink to="/" className="text-lg font-semibold">
                Ranger
              </AppLink>
              <nav className="mt-8 grid gap-2 text-sm">
                <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin">
                  Dashboard
                </AppLink>
                <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin/posts">
                  Posts
                </AppLink>
                <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin/users">
                  Users
                </AppLink>
              </nav>
            </aside>
            <div className="md:pl-64">
              <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-6">
                <div className="flex gap-3 text-sm md:hidden">
                  <AppLink to="/admin">Dashboard</AppLink>
                  <AppLink to="/admin/posts">Posts</AppLink>
                  <AppLink to="/admin/users">Users</AppLink>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-sm text-neutral-600">{adminUser.email}</span>
                  <Button variant="outline" onClick={signOut}>
                    Sign out
                  </Button>
                </div>
              </header>
              <main className="p-6">{children}</main>
            </div>
          </div>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/admin/dashboard/components/admin-dashboard.tsx",
    text`
      "use client";

      import { Card } from "@/components/ui/card";
      import { trpc } from "@/trpc/client";

      export function AdminDashboard() {
        const summaryQuery = trpc.dashboard.summary.useQuery();
        const summary = summaryQuery.data;

        return (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Admin
              </p>
              <h1 className="text-2xl font-semibold">Dashboard</h1>
            </div>

            <section className="grid gap-4 md:grid-cols-3">
              <Card className="p-5">
                <p className="text-sm text-neutral-500">Posts</p>
                <p className="mt-2 text-3xl font-semibold">{summary?.postCount ?? 0}</p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-neutral-500">Published</p>
                <p className="mt-2 text-3xl font-semibold">
                  {summary?.publishedPostCount ?? 0}
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-sm text-neutral-500">Users</p>
                <p className="mt-2 text-3xl font-semibold">{summary?.userCount ?? 0}</p>
              </Card>
            </section>

            <Card className="p-5">
              <h2 className="mb-4 text-lg font-semibold">Latest posts</h2>
              <div className="divide-y divide-neutral-200">
                {(summary?.latestPosts ?? []).map((post) => (
                  <div key={post.id} className="flex items-center justify-between py-3 text-sm">
                    <span>{post.title}</span>
                    <span className="text-neutral-500">
                      {post.author?.email || post.author?.name || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/admin/posts/components/admin-posts-page.tsx",
    text`
      "use client";

      import { Button } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { trpc } from "@/trpc/client";

      export function AdminPostsPage() {
        const utils = trpc.useUtils();
        const postsQuery = trpc.post.adminList.useQuery({ limit: 100 });
        const deleteMutation = trpc.post.adminDelete.useMutation({
          onSuccess() {
            void utils.post.adminList.invalidate();
            void utils.dashboard.summary.invalidate();
          },
        });

        return (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Admin
              </p>
              <h1 className="text-2xl font-semibold">Post list</h1>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="border-b border-neutral-200 p-3">Title</th>
                    <th className="border-b border-neutral-200 p-3">Author</th>
                    <th className="border-b border-neutral-200 p-3">Status</th>
                    <th className="border-b border-neutral-200 p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(postsQuery.data ?? []).map((post) => (
                    <tr key={post.id}>
                      <td className="border-b border-neutral-100 p-3">{post.title}</td>
                      <td className="border-b border-neutral-100 p-3">
                        {post.author?.email || post.author?.name || "Unknown"}
                      </td>
                      <td className="border-b border-neutral-100 p-3">
                        {post.published ? "Published" : "Draft"}
                      </td>
                      <td className="border-b border-neutral-100 p-3 text-right">
                        <Button
                          variant="outline"
                          onClick={() => deleteMutation.mutate({ id: post.id })}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/admin/users/components/admin-users-page.tsx",
    text`
      "use client";

      import { Card } from "@/components/ui/card";
      import { trpc } from "@/trpc/client";

      export function AdminUsersPage() {
        const usersQuery = trpc.user.adminList.useQuery({ limit: 100 });

        return (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Admin
              </p>
              <h1 className="text-2xl font-semibold">User list</h1>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="border-b border-neutral-200 p-3">Name</th>
                    <th className="border-b border-neutral-200 p-3">Email</th>
                    <th className="border-b border-neutral-200 p-3">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersQuery.data ?? []).map((user) => (
                    <tr key={user.id}>
                      <td className="border-b border-neutral-100 p-3">
                        {user.name || "Unnamed"}
                      </td>
                      <td className="border-b border-neutral-100 p-3">{user.email}</td>
                      <td className="border-b border-neutral-100 p-3">
                        {user.role || "user"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        );
      }
    `,
  );
}

function addNextBackend(files) {
  add(
    files,
    "apps/web/src/server/auth.ts",
    text`
      export { auth, getSession } from "@repo/auth";
    `,
  );

  add(
    files,
    "apps/web/src/trpc/server.ts",
    text`
      import "server-only";

      import { headers } from "next/headers";

      import { appRouter, createCallerFactory } from "@repo/api";
      import type { CreateContextOptions } from "@repo/api";
      import { db } from "@repo/db";

      import { getSession } from "@/server/auth";

      export const createTRPCContext = async (): Promise<CreateContextOptions> => {
        const session = await getSession(await headers());

        return {
          session,
          db,
        };
      };

      export const createCaller = createCallerFactory(appRouter);
    `,
  );

  add(
    files,
    "apps/web/src/app/api/auth/[...all]/route.ts",
    text`
      import { auth } from "@repo/auth";
      import { toNextJsHandler } from "better-auth/next-js";

      export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
    `,
  );

  add(
    files,
    "apps/web/src/app/api/trpc/[trpc]/route.ts",
    text`
      import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

      import { appRouter } from "@repo/api";

      import { createTRPCContext } from "@/trpc/server";

      const handler = (request: Request) =>
        fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: createTRPCContext,
        });

      export { handler as GET, handler as POST };
    `,
  );

  add(
    files,
    "apps/web/src/app/api/uploads/route.ts",
    text`
      import fs from "node:fs/promises";
      import path from "node:path";

      import { NextResponse } from "next/server";
      import type { NextRequest } from "next/server";

      import { auth } from "@/server/auth";

      export const runtime = "nodejs";

      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      const MAX_SIZE_BYTES = 5 * 1024 * 1024;

      export async function POST(req: NextRequest) {
        const session = await auth.api.getSession({ headers: req.headers });

        if (!session?.user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData().catch(() => null);
        if (!formData) {
          return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
        }

        const folder = formData.get("folder");
        if (folder !== "posts" && folder !== "avatars") {
          return NextResponse.json({ error: "Invalid upload folder" }, { status: 400 });
        }

        const file = formData.get("file");
        if (!(file instanceof File)) {
          return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json(
            { error: "Unsupported file type. Use JPEG, PNG, WebP, or GIF." },
            { status: 415 },
          );
        }

        if (file.size > MAX_SIZE_BYTES) {
          return NextResponse.json(
            { error: "File too large. Maximum size is 5 MB." },
            { status: 413 },
          );
        }

        const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = crypto.randomUUID() + "." + ext;
        const diskPath = path.join(uploadDir, fileName);
        await fs.writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

        const url = new URL("/uploads/" + folder + "/" + fileName, req.url);

        return NextResponse.json({ url: url.toString() });
      }
    `,
  );

  add(
    files,
    "apps/web/src/middleware.ts",
    text`
      import { getSessionCookie } from "better-auth/cookies";
      import { NextRequest, NextResponse } from "next/server";

      export function middleware(request: NextRequest): NextResponse {
        const hasSession = Boolean(getSessionCookie(request));

        if (!hasSession) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
          return NextResponse.redirect(loginUrl);
        }

        return NextResponse.next();
      }

      export const config = {
        matcher: ["/admin/:path*"],
      };
    `,
  );
}

function addMobileApp(files, ctx) {
  add(
    files,
    "apps/mobile/package.json",
    json({
      name: "@repo/mobile",
      version: "0.0.0",
      private: true,
      main: "expo-router/entry",
      scripts: {
        dev: "expo start",
        start: "expo start",
        android: "expo run:android",
        ios: "expo run:ios",
        web: "expo start --web",
        lint: "expo lint",
        typecheck: "tsc --noEmit",
        clean: "rm -rf .expo .turbo node_modules",
      },
      dependencies: {
        "@better-auth/expo": "^1.6.11",
        "@repo/api": "workspace:*",
        "@tanstack/react-query": "^5.60.0",
        "@trpc/client": "^11.0.0",
        "@trpc/react-query": "^11.0.0",
        "better-auth": "^1.6.11",
        expo: "~54.0.33",
        "expo-constants": "~18.0.13",
        "expo-image": "~3.0.11",
        "expo-image-picker": "~17.0.11",
        "expo-linking": "~8.0.11",
        "expo-network": "~8.0.7",
        "expo-router": "~6.0.23",
        "expo-secure-store": "~15.0.8",
        "expo-status-bar": "~3.0.9",
        react: "19.1.0",
        "react-dom": "19.1.0",
        "react-native": "0.81.5",
        "react-native-safe-area-context": "~5.6.0",
        "react-native-screens": "~4.16.0",
        "react-native-web": "~0.21.0",
        superjson: "^2.2.1",
        zod: "^3.23.0",
      },
      devDependencies: {
        "@types/react": "~19.1.10",
        "babel-preset-expo": "~54.0.0",
        eslint: "^9.25.0",
        "eslint-config-expo": "~10.0.0",
        typescript: "~5.9.2",
      },
    }),
  );

  add(
    files,
    "apps/mobile/app.json",
    json({
      expo: {
        name: ctx.appTitle,
        slug: ctx.packageName,
        scheme: ctx.appScheme,
        version: "1.0.0",
        orientation: "portrait",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        ios: {
          supportsTablet: true,
        },
        android: {
          adaptiveIcon: {
            backgroundColor: "#ffffff",
          },
        },
        plugins: ["expo-router", "expo-secure-store"],
        experiments: {
          typedRoutes: true,
        },
      },
    }),
  );

  add(
    files,
    "apps/mobile/.env.example",
    mobileEnv(ctx),
  );

  add(
    files,
    "apps/mobile/babel.config.js",
    text`
      module.exports = function (api) {
        api.cache(true);
        return {
          presets: ["babel-preset-expo"],
        };
      };
    `,
  );

  add(
    files,
    "apps/mobile/metro.config.js",
    text`
      const { getDefaultConfig } = require("expo/metro-config");

      module.exports = getDefaultConfig(__dirname);
    `,
  );

  add(
    files,
    "apps/mobile/tsconfig.json",
    json({
      extends: "expo/tsconfig.base",
      compilerOptions: {
        strict: true,
        jsx: "react-jsx",
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
    }),
  );

  add(
    files,
    "apps/mobile/app/_layout.tsx",
    text`
      import { Stack } from "expo-router";
      import { StatusBar } from "expo-status-bar";

      import { TRPCProviderWrapper } from "../src/lib/trpc";

      export default function RootLayout() {
        return (
          <TRPCProviderWrapper>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: "#ffffff" },
                headerTintColor: "#000000",
                contentStyle: { backgroundColor: "#ffffff" },
              }}
            >
              <Stack.Screen name="index" options={{ title: "Posts" }} />
              <Stack.Screen name="auth" options={{ title: "Auth", presentation: "modal" }} />
            </Stack>
            <StatusBar style="dark" />
          </TRPCProviderWrapper>
        );
      }
    `,
  );

  add(
    files,
    "apps/mobile/app/index.tsx",
    text`
      import { PostsScreen } from "../src/features/posts/screens/posts-screen";

      export default function IndexRoute() {
        return <PostsScreen />;
      }
    `,
  );

  add(
    files,
    "apps/mobile/app/auth.tsx",
    text`
      import { AuthScreen } from "../src/features/auth/screens/auth-screen";

      export default function AuthRoute() {
        return <AuthScreen />;
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/get-api-base-url.ts",
    text`
      import Constants from "expo-constants";
      import { Platform } from "react-native";

      const DEFAULT_PORT = "${ctx.apiPort}";
      export const API_BASE_URL_PLACEHOLDER = "http://__ranger_api_base__";

      function getConfiguredPort(): string {
        const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/$/, "");

        return (
          configured?.match(/:(\\d+)/)?.[1] ??
          process.env.EXPO_PUBLIC_API_PORT ??
          DEFAULT_PORT
        );
      }

      function getExpoDevHost(): string | undefined {
        const hostUri = Constants.expoConfig?.hostUri;
        if (hostUri) {
          return hostUri.replace(/^https?:\\/\\//, "").split(":")[0];
        }

        const debuggerHost = Constants.expoGoConfig?.debuggerHost;
        if (typeof debuggerHost === "string") {
          return debuggerHost.split(":")[0];
        }

        return undefined;
      }

      function isIosSimulator(): boolean {
        return Platform.OS === "ios" && Constants.isDevice === false;
      }

      function isAndroidEmulator(): boolean {
        return Platform.OS === "android" && Constants.isDevice === false;
      }

      function isLoopbackHost(host: string): boolean {
        return host === "localhost" || host === "127.0.0.1" || host === "::1";
      }

      export function getApiBaseUrl(): string {
        const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/$/, "");
        const port = getConfiguredPort();

        if (
          configured &&
          !configured.includes("localhost") &&
          !configured.includes("127.0.0.1")
        ) {
          return configured;
        }

        if (isIosSimulator()) {
          return "http://127.0.0.1:" + port;
        }

        if (isAndroidEmulator()) {
          return "http://10.0.2.2:" + port;
        }

        const devHost = getExpoDevHost();
        if (devHost && !isLoopbackHost(devHost)) {
          return "http://" + devHost + ":" + port;
        }

        return "http://127.0.0.1:" + port;
      }

      export function resolveTrpcFetchUrl(input: RequestInfo | URL): string {
        const baseUrl = getApiBaseUrl();
        const raw =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        return raw.replace(API_BASE_URL_PLACEHOLDER, baseUrl);
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/auth-client.ts",
    text`
      import { expoClient } from "@better-auth/expo/client";
      import { createAuthClient } from "better-auth/react";
      import * as SecureStore from "expo-secure-store";

      import { getApiBaseUrl } from "./get-api-base-url";

      const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? "${ctx.appScheme}";

      export const authClient = createAuthClient({
        baseURL: getApiBaseUrl(),
        plugins: [
          expoClient({
            scheme: appScheme,
            storagePrefix: appScheme,
            storage: SecureStore,
          }),
        ],
      });
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/auth-headers.ts",
    text`
      import { authClient } from "./auth-client";

      export function getAuthRequestHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        const cookie = authClient.getCookie();

        if (cookie) {
          headers.Cookie = cookie;
        }

        return headers;
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/trpc.tsx",
    text`
      import { useState } from "react";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { httpBatchLink } from "@trpc/client";
      import { createTRPCReact } from "@trpc/react-query";
      import superjson from "superjson";

      import type { AppRouter } from "@repo/api";

      import { getAuthRequestHeaders } from "./auth-headers";
      import {
        API_BASE_URL_PLACEHOLDER,
        resolveTrpcFetchUrl,
      } from "./get-api-base-url";

      export const trpc = createTRPCReact<AppRouter>();

      export function TRPCProviderWrapper({
        children,
      }: {
        children: React.ReactNode;
      }): React.ReactNode {
        const [queryClient] = useState(
          () =>
            new QueryClient({
              defaultOptions: {
                queries: {
                  staleTime: 30 * 1000,
                  retry: 2,
                },
              },
            }),
        );

        const [trpcClient] = useState(() =>
          trpc.createClient({
            links: [
              httpBatchLink({
                transformer: superjson,
                url: API_BASE_URL_PLACEHOLDER + "/api/trpc",
                fetch(input, init) {
                  return fetch(resolveTrpcFetchUrl(input), {
                    ...init,
                    credentials: "omit",
                  });
                },
                async headers() {
                  return {
                    "x-trpc-source": "expo-react-native",
                    ...getAuthRequestHeaders(),
                  };
                },
              }),
            ],
          }),
        );

        return (
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </trpc.Provider>
        );
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/upload-image.ts",
    text`
      import { getAuthRequestHeaders } from "./auth-headers";
      import { getApiBaseUrl } from "./get-api-base-url";

      type UploadImageParams = {
        folder: "posts" | "avatars";
        uri: string;
        mimeType?: string;
        fileName?: string;
      };

      function getExtension(mimeType?: string, fileName?: string) {
        if (fileName?.includes(".")) {
          return fileName.split(".").pop()?.toLowerCase() ?? "jpg";
        }

        switch (mimeType) {
          case "image/png":
            return "png";
          case "image/webp":
            return "webp";
          case "image/gif":
            return "gif";
          default:
            return "jpg";
        }
      }

      export async function uploadImage({
        folder,
        uri,
        mimeType = "image/jpeg",
        fileName,
      }: UploadImageParams): Promise<string> {
        const extension = getExtension(mimeType, fileName);
        const formData = new FormData();

        formData.append("folder", folder);
        formData.append(
          "file",
          {
            uri,
            name: fileName ?? "upload." + extension,
            type: mimeType,
          } as unknown as Blob,
        );

        const response = await fetch(getApiBaseUrl() + "/api/uploads", {
          method: "POST",
          credentials: "omit",
          headers: getAuthRequestHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || "Image upload failed.");
        }

        const payload = (await response.json()) as { url?: string };
        if (!payload.url) {
          throw new Error("Upload did not return a URL.");
        }

        return payload.url;
      }
    `,
  );

  addMobileFeatures(files);
}

function addMobileFeatures(files) {
  add(
    files,
    "apps/mobile/src/features/auth/hooks/use-auth-view-model.ts",
    text`
      import { router } from "expo-router";
      import { useState } from "react";

      import { authClient } from "../../../lib/auth-client";
      import { trpc } from "../../../lib/trpc";

      export function useAuthViewModel() {
        const utils = trpc.useUtils();
        const [mode, setMode] = useState<"login" | "register">("login");
        const [name, setName] = useState("");
        const [email, setEmail] = useState("");
        const [password, setPassword] = useState("");
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const [isPending, setIsPending] = useState(false);

        async function submit() {
          setErrorMessage(null);
          setIsPending(true);

          const result =
            mode === "login"
              ? await authClient.signIn.email({ email, password })
              : await authClient.signUp.email({
                  email,
                  password,
                  name: name.trim() || email.split("@")[0] || "User",
                });

          setIsPending(false);

          if (result.error) {
            setErrorMessage(result.error.message || "Authentication failed.");
            return;
          }

          await utils.user.me.invalidate();
          router.back();
        }

        return {
          mode,
          setMode,
          name,
          setName,
          email,
          setEmail,
          password,
          setPassword,
          errorMessage,
          isPending,
          submit,
        };
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/features/auth/screens/auth-screen.tsx",
    text`
      import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

      import { useAuthViewModel } from "../hooks/use-auth-view-model";

      export function AuthScreen() {
        const vm = useAuthViewModel();

        return (
          <View style={styles.container}>
            <Text style={styles.eyebrow}>
              {vm.mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}
            </Text>
            <Text style={styles.title}>Sign in to continue</Text>

            {vm.mode === "register" ? (
              <TextInput
                value={vm.name}
                onChangeText={vm.setName}
                placeholder="Name"
                placeholderTextColor="#737373"
                style={styles.input}
              />
            ) : null}
            <TextInput
              value={vm.email}
              onChangeText={vm.setEmail}
              placeholder="Email"
              placeholderTextColor="#737373"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              value={vm.password}
              onChangeText={vm.setPassword}
              placeholder="Password"
              placeholderTextColor="#737373"
              secureTextEntry
              style={styles.input}
            />

            {vm.errorMessage ? <Text style={styles.error}>{vm.errorMessage}</Text> : null}

            <Pressable
              onPress={vm.submit}
              disabled={vm.isPending}
              style={({ pressed }) => [
                styles.button,
                (pressed || vm.isPending) && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>
                {vm.isPending ? "Please wait..." : vm.mode === "login" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => vm.setMode(vm.mode === "login" ? "register" : "login")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {vm.mode === "login" ? "Create a new account" : "Use an existing account"}
              </Text>
            </Pressable>
          </View>
        );
      }

      const styles = StyleSheet.create({
        container: {
          flex: 1,
          gap: 14,
          padding: 24,
          justifyContent: "center",
          backgroundColor: "#ffffff",
        },
        eyebrow: {
          color: "#525252",
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0,
        },
        title: {
          color: "#000000",
          fontSize: 28,
          fontWeight: "700",
          marginBottom: 12,
        },
        input: {
          minHeight: 48,
          borderWidth: 1,
          borderColor: "#d4d4d4",
          borderRadius: 8,
          paddingHorizontal: 14,
          color: "#000000",
          backgroundColor: "#ffffff",
        },
        error: {
          color: "#262626",
          backgroundColor: "#f5f5f5",
          borderColor: "#d4d4d4",
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
        },
        button: {
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          backgroundColor: "#000000",
        },
        buttonPressed: {
          opacity: 0.72,
        },
        buttonText: {
          color: "#ffffff",
          fontWeight: "700",
        },
        secondaryButton: {
          alignItems: "center",
          paddingVertical: 12,
        },
        secondaryButtonText: {
          color: "#000000",
          fontWeight: "600",
        },
      });
    `,
  );

  add(
    files,
    "apps/mobile/src/features/posts/hooks/use-posts-view-model.ts",
    text`
      import * as ImagePicker from "expo-image-picker";
      import { router, useFocusEffect } from "expo-router";
      import { useCallback, useState } from "react";

      import { authClient } from "../../../lib/auth-client";
      import { trpc } from "../../../lib/trpc";
      import { uploadImage } from "../../../lib/upload-image";

      export function usePostsViewModel() {
        const utils = trpc.useUtils();
        const { data: session } = authClient.useSession();
        const [title, setTitle] = useState("");
        const [content, setContent] = useState("");
        const [localImageUri, setLocalImageUri] = useState<string | null>(null);
        const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);

        const postsQuery = trpc.post.getAll.useQuery({ limit: 50 });
        const meQuery = trpc.user.me.useQuery(undefined, {
          retry: false,
          refetchOnWindowFocus: false,
        });

        useFocusEffect(
          useCallback(() => {
            void meQuery.refetch();
          }, [meQuery]),
        );

        const isAuthed = Boolean(meQuery.data ?? session?.user);

        const createMutation = trpc.post.create.useMutation({
          onSuccess() {
            setTitle("");
            setContent("");
            setLocalImageUri(null);
            setImageAsset(null);
            void utils.post.getAll.invalidate();
            void utils.post.getMyPosts.invalidate();
          },
        });

        async function pickImage() {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

          if (!permission.granted) {
            setErrorMessage("Photo library permission is required.");
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.85,
          });

          if (result.canceled || !result.assets[0]) {
            return;
          }

          setImageAsset(result.assets[0]);
          setLocalImageUri(result.assets[0].uri);
        }

        async function createPost() {
          if (!isAuthed) {
            router.push("/auth");
            return;
          }

          setErrorMessage(null);

          try {
            const imageUrl = imageAsset
              ? await uploadImage({
                  folder: "posts",
                  uri: imageAsset.uri,
                  mimeType: imageAsset.mimeType ?? "image/jpeg",
                  fileName: imageAsset.fileName ?? undefined,
                })
              : undefined;

            await createMutation.mutateAsync({
              title,
              content,
              imageUrl,
              published: true,
            });
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Failed to create post.",
            );
          }
        }

        async function signOut() {
          await authClient.signOut();
          await utils.user.me.invalidate();
        }

        return {
          posts: postsQuery.data?.posts ?? [],
          isLoading: postsQuery.isLoading,
          isAuthed,
          title,
          setTitle,
          content,
          setContent,
          localImageUri,
          errorMessage,
          isCreating: createMutation.isPending,
          pickImage,
          createPost,
          signOut,
        };
      }
    `,
  );

  add(
    files,
    "apps/mobile/src/features/posts/components/post-card.tsx",
    text`
      import { Image } from "expo-image";
      import { StyleSheet, Text, View } from "react-native";

      type PostCardProps = {
        title: string;
        content?: string | null;
        imageUrl?: string | null;
        authorName?: string | null;
      };

      export function PostCard({
        title,
        content,
        imageUrl,
        authorName,
      }: PostCardProps) {
        return (
          <View style={styles.card}>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
            <View style={styles.body}>
              <Text style={styles.title}>{title}</Text>
              {content ? <Text style={styles.content}>{content}</Text> : null}
              <Text style={styles.meta}>By {authorName || "Unknown"}</Text>
            </View>
          </View>
        );
      }

      const styles = StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: "#d4d4d4",
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#ffffff",
        },
        image: {
          width: "100%",
          aspectRatio: 16 / 9,
          backgroundColor: "#f5f5f5",
        },
        body: {
          padding: 14,
          gap: 8,
        },
        title: {
          color: "#000000",
          fontSize: 18,
          fontWeight: "700",
        },
        content: {
          color: "#404040",
          lineHeight: 20,
        },
        meta: {
          color: "#737373",
          fontSize: 12,
        },
      });
    `,
  );

  add(
    files,
    "apps/mobile/src/features/posts/screens/posts-screen.tsx",
    text`
      import { Image } from "expo-image";
      import { router } from "expo-router";
      import {
        FlatList,
        Pressable,
        StyleSheet,
        Text,
        TextInput,
        View,
      } from "react-native";

      import { PostCard } from "../components/post-card";
      import { usePostsViewModel } from "../hooks/use-posts-view-model";

      export function PostsScreen() {
        const vm = usePostsViewModel();

        return (
          <FlatList
            style={styles.container}
            contentContainerStyle={styles.content}
            data={vm.posts}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.headerRow}>
                  <View>
                    <Text style={styles.eyebrow}>RANGER APP</Text>
                    <Text style={styles.screenTitle}>Posts</Text>
                  </View>
                  {vm.isAuthed ? (
                    <Pressable style={styles.outlineButton} onPress={vm.signOut}>
                      <Text style={styles.outlineButtonText}>Sign out</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.outlineButton}
                      onPress={() => router.push("/auth")}
                    >
                      <Text style={styles.outlineButtonText}>Sign in</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.form}>
                  <Text style={styles.formTitle}>Create post</Text>
                  <TextInput
                    value={vm.title}
                    onChangeText={vm.setTitle}
                    placeholder="Post title"
                    placeholderTextColor="#737373"
                    style={styles.input}
                  />
                  <TextInput
                    value={vm.content}
                    onChangeText={vm.setContent}
                    placeholder="Write something"
                    placeholderTextColor="#737373"
                    multiline
                    style={[styles.input, styles.textarea]}
                  />
                  {vm.localImageUri ? (
                    <Image source={{ uri: vm.localImageUri }} style={styles.preview} />
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable style={styles.outlineButton} onPress={vm.pickImage}>
                      <Text style={styles.outlineButtonText}>Image</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, (!vm.title.trim() || vm.isCreating) && styles.disabled]}
                      disabled={!vm.title.trim() || vm.isCreating}
                      onPress={vm.createPost}
                    >
                      <Text style={styles.buttonText}>
                        {vm.isCreating ? "Publishing..." : "Publish"}
                      </Text>
                    </Pressable>
                  </View>
                  {vm.errorMessage ? <Text style={styles.error}>{vm.errorMessage}</Text> : null}
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                title={item.title}
                content={item.content}
                imageUrl={item.imageUrl}
                authorName={item.author?.name}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              vm.isLoading ? (
                <Text style={styles.muted}>Loading posts...</Text>
              ) : (
                <Text style={styles.muted}>No posts yet.</Text>
              )
            }
          />
        );
      }

      const styles = StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: "#ffffff",
        },
        content: {
          padding: 18,
          gap: 14,
        },
        header: {
          gap: 18,
          marginBottom: 4,
        },
        headerRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        },
        eyebrow: {
          color: "#525252",
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0,
        },
        screenTitle: {
          color: "#000000",
          fontSize: 30,
          fontWeight: "700",
        },
        form: {
          borderWidth: 1,
          borderColor: "#d4d4d4",
          borderRadius: 8,
          padding: 14,
          gap: 12,
        },
        formTitle: {
          color: "#000000",
          fontSize: 18,
          fontWeight: "700",
        },
        input: {
          minHeight: 46,
          borderWidth: 1,
          borderColor: "#d4d4d4",
          borderRadius: 8,
          paddingHorizontal: 12,
          color: "#000000",
          backgroundColor: "#ffffff",
        },
        textarea: {
          minHeight: 96,
          paddingTop: 12,
          textAlignVertical: "top",
        },
        preview: {
          width: "100%",
          aspectRatio: 16 / 9,
          borderRadius: 8,
          backgroundColor: "#f5f5f5",
        },
        actions: {
          flexDirection: "row",
          gap: 10,
        },
        button: {
          flex: 1,
          minHeight: 46,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          backgroundColor: "#000000",
        },
        buttonText: {
          color: "#ffffff",
          fontWeight: "700",
        },
        outlineButton: {
          minHeight: 42,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#d4d4d4",
          paddingHorizontal: 14,
          backgroundColor: "#ffffff",
        },
        outlineButtonText: {
          color: "#000000",
          fontWeight: "700",
        },
        disabled: {
          opacity: 0.5,
        },
        error: {
          color: "#262626",
          backgroundColor: "#f5f5f5",
          borderColor: "#d4d4d4",
          borderWidth: 1,
          borderRadius: 8,
          padding: 10,
        },
        separator: {
          height: 14,
        },
        muted: {
          color: "#737373",
          textAlign: "center",
          paddingVertical: 24,
        },
      });
    `,
  );
}

function addExpressServer(files, ctx) {
  add(
    files,
    "apps/server/package.json",
    json({
      name: "@repo/server",
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsup",
        start: "node dist/index.js",
        lint: "echo \"No server lint configured\"",
        typecheck: "tsc --noEmit",
        clean: "rm -rf dist .turbo node_modules public/uploads",
      },
      dependencies: {
        "@repo/api": "workspace:*",
        "@repo/auth": "workspace:*",
        "@repo/db": "workspace:*",
        "@trpc/server": "^11.0.0",
        "better-auth": "^1.6.11",
        cors: "^2.8.5",
        dotenv: "^16.4.7",
        express: "^4.18.3",
        multer: "^1.4.5-lts.1",
      },
      devDependencies: {
        "@repo/typescript-config": "workspace:*",
        "@types/cors": "^2.8.17",
        "@types/express": "^4.17.21",
        "@types/multer": "^1.4.12",
        "@types/node": "^22.0.0",
        tsx: "^4.19.2",
        tsup: "^8.3.5",
        typescript: "^5.6.0",
      },
    }),
  );

  add(
    files,
    "apps/server/tsconfig.json",
    json({
      extends: "@repo/typescript-config/base.json",
      compilerOptions: {
        noEmit: true,
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "apps/server/tsup.config.ts",
    text`
      import { defineConfig } from "tsup";

      export default defineConfig({
        entry: ["src/index.ts"],
        format: ["esm"],
        platform: "node",
        target: "node20",
        bundle: true,
        clean: true,
        sourcemap: true,
        splitting: false,
        noExternal: ["@repo/api", "@repo/auth", "@repo/db"],
      });
    `,
  );

  add(
    files,
    "apps/server/.env.example",
    serverEnv(ctx),
  );

  add(
    files,
    "apps/server/src/index.ts",
    text`
      import "dotenv/config";

      import fs from "node:fs/promises";
      import path from "node:path";

      import { createExpressMiddleware } from "@trpc/server/adapters/express";
      import cors from "cors";
      import express from "express";
      import multer from "multer";
      import { fromNodeHeaders, toNodeHandler } from "better-auth/node";

      import { appRouter } from "@repo/api";
      import { auth, getSession } from "@repo/auth";
      import { db } from "@repo/db";

      const app = express();
      const port = Number(process.env.PORT ?? ${ctx.apiPort});
      const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
      const appScheme = process.env.EXPO_APP_SCHEME ?? "${ctx.appScheme}";
      const publicDir = path.resolve(process.cwd(), "public");
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      });

      app.use(
        cors({
          origin(origin, callback) {
            if (!origin) {
              callback(null, true);
              return;
            }

            const allowed = new Set([
              corsOrigin,
              "http://localhost:3000",
              "http://localhost:4000",
              "http://localhost:8081",
              "http://127.0.0.1:3000",
              "http://127.0.0.1:4000",
              "http://127.0.0.1:8081",
              "http://10.0.2.2:" + port,
              appScheme + "://",
            ]);

            if (
              allowed.has(origin) ||
              origin.startsWith(appScheme + "://") ||
              origin.startsWith("wails://") ||
              (process.env.NODE_ENV !== "production" && origin.startsWith("exp://")) ||
              (process.env.NODE_ENV !== "production" &&
                /^https?:\\/\\/(localhost|127\\.0\\.0\\.1|wails\\.localhost)(:\\d+)?$/.test(origin))
            ) {
              callback(null, true);
              return;
            }

            callback(null, false);
          },
          credentials: true,
          exposedHeaders: ["set-auth-token"],
        }),
      );

      app.use("/uploads", express.static(path.join(publicDir, "uploads")));

      app.all("/api/auth/*", async (req, res) => {
        const expoOrigin = req.headers["expo-origin"];
        if (typeof expoOrigin === "string" && expoOrigin.length > 0) {
          delete req.headers.origin;
          delete req.headers.referer;
          req.headers.origin = expoOrigin;
        } else if (!req.headers.origin && process.env.NODE_ENV !== "production") {
          req.headers.origin = appScheme + "://";
        }

        await toNodeHandler(auth)(req, res);
      });

      app.use(
        "/api/trpc",
        createExpressMiddleware({
          router: appRouter,
          createContext: async ({ req }) => {
            const session = await getSession(fromNodeHeaders(req.headers));
            return {
              session,
              db,
            };
          },
        }),
      );

      app.post("/api/uploads", upload.single("file"), async (req, res) => {
        const session = await getSession(fromNodeHeaders(req.headers));

        if (!session?.user) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const folder = req.body.folder;
        if (folder !== "posts" && folder !== "avatars") {
          res.status(400).json({ error: "Invalid upload folder" });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.mimetype)) {
          res.status(415).json({
            error: "Unsupported file type. Use JPEG, PNG, WebP, or GIF.",
          });
          return;
        }

        const ext = file.mimetype.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const uploadDir = path.join(publicDir, "uploads", folder);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = crypto.randomUUID() + "." + ext;
        await fs.writeFile(path.join(uploadDir, fileName), file.buffer);

        const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:" + port;
        res.json({ url: baseUrl + "/uploads/" + folder + "/" + fileName });
      });

      app.get("/health", (_req, res) => {
        res.json({ ok: true });
      });

      app.listen(port, "0.0.0.0", () => {
        console.log("API server running on http://localhost:" + port);
      });
    `,
  );
}

function addDesktopApp(files, ctx) {
  add(
    files,
    "apps/desktop/.env.example",
    text`
VITE_API_URL="http://localhost:${ctx.apiPort}"

`,
  );
  add(
    files,
    "apps/desktop/.gitignore",
    text`
build/bin
node_modules
frontend/dist
frontend/node_modules
frontend/.env

`,
  );
  add(
    files,
    "apps/desktop/app.go",
    text`
package main

import (
	"context"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

`,
  );
  add(
    files,
    "apps/desktop/auth_storage.go",
    text`
package main

import (
	"os"
	"path/filepath"
)

func (a *App) authStoragePath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}

	return filepath.Join(configDir, "${ctx.packageName}", "auth-session.json")
}

// GetAuthStorage returns persisted auth cookie JSON for the frontend.
func (a *App) GetAuthStorage() string {
	data, err := os.ReadFile(a.authStoragePath())
	if err != nil {
		return "{}"
	}

	return string(data)
}

// SetAuthStorage persists auth cookie JSON for the frontend.
func (a *App) SetAuthStorage(value string) error {
	path := a.authStoragePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}

	return os.WriteFile(path, []byte(value), 0o600)
}

// ClearAuthStorage removes persisted auth state.
func (a *App) ClearAuthStorage() error {
	err := os.Remove(a.authStoragePath())
	if os.IsNotExist(err) {
		return nil
	}

	return err
}

`,
  );
  addBinary(files, "apps/desktop/build/appicon.png", "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");
  add(
    files,
    "apps/desktop/build/darwin/Info.dev.plist",
    text`
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>CFBundlePackageType</key>
        <string>APPL</string>
        <key>CFBundleName</key>
        <string>{{.Info.ProductName}}</string>
        <key>CFBundleExecutable</key>
        <string>{{.OutputFilename}}</string>
        <key>CFBundleIdentifier</key>
        <string>com.wails.{{.Name}}</string>
        <key>CFBundleVersion</key>
        <string>{{.Info.ProductVersion}}</string>
        <key>CFBundleGetInfoString</key>
        <string>{{.Info.Comments}}</string>
        <key>CFBundleShortVersionString</key>
        <string>{{.Info.ProductVersion}}</string>
        <key>CFBundleIconFile</key>
        <string>iconfile</string>
        <key>LSMinimumSystemVersion</key>
        <string>10.13.0</string>
        <key>NSHighResolutionCapable</key>
        <string>true</string>
        <key>NSHumanReadableCopyright</key>
        <string>{{.Info.Copyright}}</string>
        {{if .Info.FileAssociations}}
        <key>CFBundleDocumentTypes</key>
        <array>
          {{range .Info.FileAssociations}}
          <dict>
            <key>CFBundleTypeExtensions</key>
            <array>
              <string>{{.Ext}}</string>
            </array>
            <key>CFBundleTypeName</key>
            <string>{{.Name}}</string>
            <key>CFBundleTypeRole</key>
            <string>{{.Role}}</string>
            <key>CFBundleTypeIconFile</key>
            <string>{{.IconName}}</string>
          </dict>
          {{end}}
        </array>
        {{end}}
        {{if .Info.Protocols}}
        <key>CFBundleURLTypes</key>
        <array>
          {{range .Info.Protocols}}
            <dict>
                <key>CFBundleURLName</key>
                <string>com.wails.{{.Scheme}}</string>
                <key>CFBundleURLSchemes</key>
                <array>
                    <string>{{.Scheme}}</string>
                </array>
                <key>CFBundleTypeRole</key>
                <string>{{.Role}}</string>
            </dict>
          {{end}}
        </array>
        {{end}}
        <key>NSAppTransportSecurity</key>
        <dict>
            <key>NSAllowsLocalNetworking</key>
            <true/>
            <key>NSAllowsArbitraryLoadsInWebContent</key>
            <true/>
        </dict>
    </dict>
</plist>

`,
  );
  add(
    files,
    "apps/desktop/build/darwin/Info.plist",
    text`
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>CFBundlePackageType</key>
        <string>APPL</string>
        <key>CFBundleName</key>
        <string>{{.Info.ProductName}}</string>
        <key>CFBundleExecutable</key>
        <string>{{.OutputFilename}}</string>
        <key>CFBundleIdentifier</key>
        <string>com.wails.{{.Name}}</string>
        <key>CFBundleVersion</key>
        <string>{{.Info.ProductVersion}}</string>
        <key>CFBundleGetInfoString</key>
        <string>{{.Info.Comments}}</string>
        <key>CFBundleShortVersionString</key>
        <string>{{.Info.ProductVersion}}</string>
        <key>CFBundleIconFile</key>
        <string>iconfile</string>
        <key>LSMinimumSystemVersion</key>
        <string>10.13.0</string>
        <key>NSHighResolutionCapable</key>
        <string>true</string>
        <key>NSHumanReadableCopyright</key>
        <string>{{.Info.Copyright}}</string>
        {{if .Info.FileAssociations}}
        <key>CFBundleDocumentTypes</key>
        <array>
          {{range .Info.FileAssociations}}
          <dict>
            <key>CFBundleTypeExtensions</key>
            <array>
              <string>{{.Ext}}</string>
            </array>
            <key>CFBundleTypeName</key>
            <string>{{.Name}}</string>
            <key>CFBundleTypeRole</key>
            <string>{{.Role}}</string>
            <key>CFBundleTypeIconFile</key>
            <string>{{.IconName}}</string>
          </dict>
          {{end}}
        </array>
        {{end}}
        {{if .Info.Protocols}}
        <key>CFBundleURLTypes</key>
        <array>
          {{range .Info.Protocols}}
            <dict>
                <key>CFBundleURLName</key>
                <string>com.wails.{{.Scheme}}</string>
                <key>CFBundleURLSchemes</key>
                <array>
                    <string>{{.Scheme}}</string>
                </array>
                <key>CFBundleTypeRole</key>
                <string>{{.Role}}</string>
            </dict>
          {{end}}
        </array>
        {{end}}
    </dict>
</plist>

`,
  );
  add(
    files,
    "apps/desktop/build/README.md",
    text`
# Build Directory

The build directory is used to house all the build files and assets for your application. 

The structure is:

* bin - Output directory
* darwin - macOS specific files
* windows - Windows specific files

## Mac

The \`darwin\` directory holds files specific to Mac builds.
These may be customised and used as part of the build. To return these files to the default state, simply delete them
and
build with \`wails build\`.

The directory contains the following files:

- \`Info.plist\` - the main plist file used for Mac builds. It is used when building using \`wails build\`.
- \`Info.dev.plist\` - same as the main plist file but used when building using \`wails dev\`.

## Windows

The \`windows\` directory contains the manifest and rc files used when building with \`wails build\`.
These may be customised for your application. To return these files to the default state, simply delete them and
build with \`wails build\`.

- \`icon.ico\` - The icon used for the application. This is used when building using \`wails build\`. If you wish to
  use a different icon, simply replace this file with your own. If it is missing, a new \`icon.ico\` file
  will be created using the \`appicon.png\` file in the build directory.
- \`installer/*\` - The files used to create the Windows installer. These are used when building using \`wails build\`.
- \`info.json\` - Application details used for Windows builds. The data here will be used by the Windows installer,
  as well as the application itself (right click the exe -> properties -> details)
- \`wails.exe.manifest\` - The main application manifest file.
`,
  );
  addBinary(files, "apps/desktop/build/windows/icon.ico", "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");
  add(
    files,
    "apps/desktop/build/windows/info.json",
    text`
{
	"fixed": {
		"file_version": "{{.Info.ProductVersion}}"
	},
	"info": {
		"0000": {
			"ProductVersion": "{{.Info.ProductVersion}}",
			"CompanyName": "{{.Info.CompanyName}}",
			"FileDescription": "{{.Info.ProductName}}",
			"LegalCopyright": "{{.Info.Copyright}}",
			"ProductName": "{{.Info.ProductName}}",
			"Comments": "{{.Info.Comments}}"
		}
	}
}
`,
  );
  add(
    files,
    "apps/desktop/build/windows/installer/project.nsi",
    text`
Unicode true

####
## Please note: Template replacements don't work in this file. They are provided with default defines like
## mentioned underneath.
## If the keyword is not defined, "wails_tools.nsh" will populate them with the values from ProjectInfo.
## If they are defined here, "wails_tools.nsh" will not touch them. This allows to use this project.nsi manually
## from outside of Wails for debugging and development of the installer.
##
## For development first make a wails nsis build to populate the "wails_tools.nsh":
## > wails build --target windows/amd64 --nsis
## Then you can call makensis on this file with specifying the path to your binary:
## For a AMD64 only installer:
## > makensis -DARG_WAILS_AMD64_BINARY=..\\..\\bin\\app.exe
## For a ARM64 only installer:
## > makensis -DARG_WAILS_ARM64_BINARY=..\\..\\bin\\app.exe
## For a installer with both architectures:
## > makensis -DARG_WAILS_AMD64_BINARY=..\\..\\bin\\app-amd64.exe -DARG_WAILS_ARM64_BINARY=..\\..\\bin\\app-arm64.exe
####
## The following information is taken from the ProjectInfo file, but they can be overwritten here.
####
## !define INFO_PROJECTNAME    "MyProject" # Default "{{.Name}}"
## !define INFO_COMPANYNAME    "MyCompany" # Default "{{.Info.CompanyName}}"
## !define INFO_PRODUCTNAME    "MyProduct" # Default "{{.Info.ProductName}}"
## !define INFO_PRODUCTVERSION "1.0.0"     # Default "{{.Info.ProductVersion}}"
## !define INFO_COPYRIGHT      "Copyright" # Default "{{.Info.Copyright}}"
###
## !define PRODUCT_EXECUTABLE  "Application.exe"      # Default "\${INFO_PROJECTNAME}.exe"
## !define UNINST_KEY_NAME     "UninstKeyInRegistry"  # Default "\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}"
####
## !define REQUEST_EXECUTION_LEVEL "admin"            # Default "admin"  see also https://nsis.sourceforge.io/Docs/Chapter4.html
####
## Include the wails tools
####
!include "wails_tools.nsh"

# The version information for this two must consist of 4 parts
VIProductVersion "\${INFO_PRODUCTVERSION}.0"
VIFileVersion    "\${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"     "\${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "\${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion"  "\${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"     "\${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"  "\${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"     "\${INFO_PRODUCTNAME}"

# Enable HiDPI support. https://nsis.sourceforge.io/Reference/ManifestDPIAware
ManifestDPIAware true

!include "MUI.nsh"

!define MUI_ICON "..\\icon.ico"
!define MUI_UNICON "..\\icon.ico"
# !define MUI_WELCOMEFINISHPAGE_BITMAP "resources\\leftimage.bmp" #Include this to add a bitmap on the left side of the Welcome Page. Must be a size of 164x314
!define MUI_FINISHPAGE_NOAUTOCLOSE # Wait on the INSTFILES page so the user can take a look into the details of the installation steps
!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
# !insertmacro MUI_PAGE_LICENSE "resources\\eula.txt" # Adds a EULA page to the installer
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_INSTFILES # Uinstalling page

!insertmacro MUI_LANGUAGE "English" # Set the Language of the installer

## The following two statements can be used to sign the installer and the uninstaller. The path to the binaries are provided in %1
#!uninstfinalize 'signtool --file "%1"'
#!finalize 'signtool --file "%1"'

Name "\${INFO_PRODUCTNAME}"
OutFile "..\\..\\bin\\\${INFO_PROJECTNAME}-\${ARCH}-installer.exe" # Name of the installer's file.
InstallDir "$PROGRAMFILES64\\\${INFO_COMPANYNAME}\\\${INFO_PRODUCTNAME}" # Default installing folder ($PROGRAMFILES is Program Files folder).
ShowInstDetails show # This will always show the installation details.

Function .onInit
   !insertmacro wails.checkArchitecture
FunctionEnd

Section
    !insertmacro wails.setShellContext

    !insertmacro wails.webview2runtime

    SetOutPath $INSTDIR

    !insertmacro wails.files

    CreateShortcut "$SMPROGRAMS\\\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\\\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\\\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\\\${PRODUCT_EXECUTABLE}"

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols

    !insertmacro wails.writeUninstaller
SectionEnd

Section "uninstall"
    !insertmacro wails.setShellContext

    RMDir /r "$AppData\\\${PRODUCT_EXECUTABLE}" # Remove the WebView2 DataPath

    RMDir /r $INSTDIR

    Delete "$SMPROGRAMS\\\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\\\${INFO_PRODUCTNAME}.lnk"

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols

    !insertmacro wails.deleteUninstaller
SectionEnd

`,
  );
  add(
    files,
    "apps/desktop/build/windows/installer/wails_tools.nsh",
    text`
# DO NOT EDIT - Generated automatically by \`wails build\`

!include "x64.nsh"
!include "WinVer.nsh"
!include "FileFunc.nsh"

!ifndef INFO_PROJECTNAME
    !define INFO_PROJECTNAME "{{.Name}}"
!endif
!ifndef INFO_COMPANYNAME
    !define INFO_COMPANYNAME "{{.Info.CompanyName}}"
!endif
!ifndef INFO_PRODUCTNAME
    !define INFO_PRODUCTNAME "{{.Info.ProductName}}"
!endif
!ifndef INFO_PRODUCTVERSION
    !define INFO_PRODUCTVERSION "{{.Info.ProductVersion}}"
!endif
!ifndef INFO_COPYRIGHT
    !define INFO_COPYRIGHT "{{.Info.Copyright}}"
!endif
!ifndef PRODUCT_EXECUTABLE
    !define PRODUCT_EXECUTABLE "\${INFO_PROJECTNAME}.exe"
!endif
!ifndef UNINST_KEY_NAME
    !define UNINST_KEY_NAME "\${INFO_COMPANYNAME}\${INFO_PRODUCTNAME}"
!endif
!define UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${UNINST_KEY_NAME}"

!ifndef REQUEST_EXECUTION_LEVEL
    !define REQUEST_EXECUTION_LEVEL "admin"
!endif

RequestExecutionLevel "\${REQUEST_EXECUTION_LEVEL}"

!ifdef ARG_WAILS_AMD64_BINARY
    !define SUPPORTS_AMD64
!endif

!ifdef ARG_WAILS_ARM64_BINARY
    !define SUPPORTS_ARM64
!endif

!ifdef SUPPORTS_AMD64
    !ifdef SUPPORTS_ARM64
        !define ARCH "amd64_arm64"
    !else
        !define ARCH "amd64"
    !endif
!else
    !ifdef SUPPORTS_ARM64
        !define ARCH "arm64"
    !else
        !error "Wails: Undefined ARCH, please provide at least one of ARG_WAILS_AMD64_BINARY or ARG_WAILS_ARM64_BINARY"
    !endif
!endif

!macro wails.checkArchitecture
    !ifndef WAILS_WIN10_REQUIRED
        !define WAILS_WIN10_REQUIRED "This product is only supported on Windows 10 (Server 2016) and later."
    !endif

    !ifndef WAILS_ARCHITECTURE_NOT_SUPPORTED
        !define WAILS_ARCHITECTURE_NOT_SUPPORTED "This product can't be installed on the current Windows architecture. Supports: \${ARCH}"
    !endif

    \${If} \${AtLeastWin10}
        !ifdef SUPPORTS_AMD64
            \${if} \${IsNativeAMD64}
                Goto ok
            \${EndIf}
        !endif

        !ifdef SUPPORTS_ARM64
            \${if} \${IsNativeARM64}
                Goto ok
            \${EndIf}
        !endif

        IfSilent silentArch notSilentArch
        silentArch:
            SetErrorLevel 65
            Abort
        notSilentArch:
            MessageBox MB_OK "\${WAILS_ARCHITECTURE_NOT_SUPPORTED}"
            Quit
    \${else}
        IfSilent silentWin notSilentWin
        silentWin:
            SetErrorLevel 64
            Abort
        notSilentWin:
            MessageBox MB_OK "\${WAILS_WIN10_REQUIRED}"
            Quit
    \${EndIf}

    ok:
!macroend

!macro wails.files
    !ifdef SUPPORTS_AMD64
        \${if} \${IsNativeAMD64}
            File "/oname=\${PRODUCT_EXECUTABLE}" "\${ARG_WAILS_AMD64_BINARY}"
        \${EndIf}
    !endif

    !ifdef SUPPORTS_ARM64
        \${if} \${IsNativeARM64}
            File "/oname=\${PRODUCT_EXECUTABLE}" "\${ARG_WAILS_ARM64_BINARY}"
        \${EndIf}
    !endif
!macroend

!macro wails.writeUninstaller
    WriteUninstaller "$INSTDIR\\uninstall.exe"

    SetRegView 64
    WriteRegStr HKLM "\${UNINST_KEY}" "Publisher" "\${INFO_COMPANYNAME}"
    WriteRegStr HKLM "\${UNINST_KEY}" "DisplayName" "\${INFO_PRODUCTNAME}"
    WriteRegStr HKLM "\${UNINST_KEY}" "DisplayVersion" "\${INFO_PRODUCTVERSION}"
    WriteRegStr HKLM "\${UNINST_KEY}" "DisplayIcon" "$INSTDIR\\\${PRODUCT_EXECUTABLE}"
    WriteRegStr HKLM "\${UNINST_KEY}" "UninstallString" "$\\"$INSTDIR\\uninstall.exe$\\""
    WriteRegStr HKLM "\${UNINST_KEY}" "QuietUninstallString" "$\\"$INSTDIR\\uninstall.exe$\\" /S"

    \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "\${UNINST_KEY}" "EstimatedSize" "$0"
!macroend

!macro wails.deleteUninstaller
    Delete "$INSTDIR\\uninstall.exe"

    SetRegView 64
    DeleteRegKey HKLM "\${UNINST_KEY}"
!macroend

!macro wails.setShellContext
    \${If} \${REQUEST_EXECUTION_LEVEL} == "admin"
        SetShellVarContext all
    \${else}
        SetShellVarContext current
    \${EndIf}
!macroend

# Install webview2 by launching the bootstrapper
# See https://docs.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#online-only-deployment
!macro wails.webview2runtime
    !ifndef WAILS_INSTALL_WEBVIEW_DETAILPRINT
        !define WAILS_INSTALL_WEBVIEW_DETAILPRINT "Installing: WebView2 Runtime"
    !endif

    SetRegView 64
	# If the admin key exists and is not empty then webview2 is already installed
	ReadRegStr $0 HKLM "SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    \${If} $0 != ""
        Goto ok
    \${EndIf}

    \${If} \${REQUEST_EXECUTION_LEVEL} == "user"
        # If the installer is run in user level, check the user specific key exists and is not empty then webview2 is already installed
	    ReadRegStr $0 HKCU "Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
        \${If} $0 != ""
            Goto ok
        \${EndIf}
     \${EndIf}

	SetDetailsPrint both
    DetailPrint "\${WAILS_INSTALL_WEBVIEW_DETAILPRINT}"
    SetDetailsPrint listonly

    InitPluginsDir
    CreateDirectory "$pluginsdir\\webview2bootstrapper"
    SetOutPath "$pluginsdir\\webview2bootstrapper"
    File "tmp\\MicrosoftEdgeWebview2Setup.exe"
    ExecWait '"$pluginsdir\\webview2bootstrapper\\MicrosoftEdgeWebview2Setup.exe" /silent /install'

    SetDetailsPrint both
    ok:
!macroend

# Copy of APP_ASSOCIATE and APP_UNASSOCIATE macros from here https://gist.github.com/nikku/281d0ef126dbc215dd58bfd5b3a5cd5b
!macro APP_ASSOCIATE EXT FILECLASS DESCRIPTION ICON COMMANDTEXT COMMAND
  ; Backup the previously associated file class
  ReadRegStr $R0 SHELL_CONTEXT "Software\\Classes\\.\${EXT}" ""
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\.\${EXT}" "\${FILECLASS}_backup" "$R0"

  WriteRegStr SHELL_CONTEXT "Software\\Classes\\.\${EXT}" "" "\${FILECLASS}"

  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${FILECLASS}" "" \`\${DESCRIPTION}\`
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${FILECLASS}\\DefaultIcon" "" \`\${ICON}\`
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${FILECLASS}\\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${FILECLASS}\\shell\\open" "" \`\${COMMANDTEXT}\`
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${FILECLASS}\\shell\\open\\command" "" \`\${COMMAND}\`
!macroend

!macro APP_UNASSOCIATE EXT FILECLASS
  ; Backup the previously associated file class
  ReadRegStr $R0 SHELL_CONTEXT "Software\\Classes\\.\${EXT}" \`\${FILECLASS}_backup\`
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\.\${EXT}" "" "$R0"

  DeleteRegKey SHELL_CONTEXT \`Software\\Classes\\\${FILECLASS}\`
!macroend

!macro wails.associateFiles
    ; Create file associations
    {{range .Info.FileAssociations}}
      !insertmacro APP_ASSOCIATE "{{.Ext}}" "{{.Name}}" "{{.Description}}" "$INSTDIR\\{{.IconName}}.ico" "Open with \${INFO_PRODUCTNAME}" "$INSTDIR\\\${PRODUCT_EXECUTABLE} $\\"%1$\\""

      File "..\\{{.IconName}}.ico"
    {{end}}
!macroend

!macro wails.unassociateFiles
    ; Delete app associations
    {{range .Info.FileAssociations}}
      !insertmacro APP_UNASSOCIATE "{{.Ext}}" "{{.Name}}"

      Delete "$INSTDIR\\{{.IconName}}.ico"
    {{end}}
!macroend

!macro CUSTOM_PROTOCOL_ASSOCIATE PROTOCOL DESCRIPTION ICON COMMAND
  DeleteRegKey SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}"
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}" "" "\${DESCRIPTION}"
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}\\DefaultIcon" "" "\${ICON}"
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}\\shell" "" ""
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}\\shell\\open" "" ""
  WriteRegStr SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}\\shell\\open\\command" "" "\${COMMAND}"
!macroend

!macro CUSTOM_PROTOCOL_UNASSOCIATE PROTOCOL
  DeleteRegKey SHELL_CONTEXT "Software\\Classes\\\${PROTOCOL}"
!macroend

!macro wails.associateCustomProtocols
    ; Create custom protocols associations
    {{range .Info.Protocols}}
      !insertmacro CUSTOM_PROTOCOL_ASSOCIATE "{{.Scheme}}" "{{.Description}}" "$INSTDIR\\\${PRODUCT_EXECUTABLE},0" "$INSTDIR\\\${PRODUCT_EXECUTABLE} $\\"%1$\\""

    {{end}}
!macroend

!macro wails.unassociateCustomProtocols
    ; Delete app custom protocol associations
    {{range .Info.Protocols}}
      !insertmacro CUSTOM_PROTOCOL_UNASSOCIATE "{{.Scheme}}"
    {{end}}
!macroend

`,
  );
  add(
    files,
    "apps/desktop/build/windows/wails.exe.manifest",
    text`
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1" xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
    <assemblyIdentity type="win32" name="com.wails.{{.Name}}" version="{{.Info.ProductVersion}}.0" processorArchitecture="*"/>
    <dependency>
        <dependentAssembly>
            <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
        </dependentAssembly>
    </dependency>
    <asmv3:application>
        <asmv3:windowsSettings>
            <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware> <!-- fallback for Windows 7 and 8 -->
            <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">permonitorv2,permonitor</dpiAwareness> <!-- falls back to per-monitor if per-monitor v2 is not supported -->
        </asmv3:windowsSettings>
    </asmv3:application>
</assembly>
`,
  );
  add(
    files,
    "apps/desktop/frontend/.env.example",
    text`
VITE_API_URL="http://localhost:${ctx.apiPort}"

`,
  );
  add(
    files,
    "apps/desktop/frontend/index.html",
    text`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>${ctx.appTitle}</title>
</head>
<body>
<div id="root"></div>
<script src="./src/main.tsx" type="module"></script>
</body>
</html>


`,
  );
  add(
    files,
    "apps/desktop/frontend/package.json",
    text`
{
  "name": "@repo/desktop-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@repo/api": "workspace:*",
    "@tanstack/react-query": "^5.60.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "better-auth": "^1.6.11",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.546.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.6.2",
    "superjson": "^2.2.1",
    "tailwind-merge": "^2.5.4",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.5.2",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.3.5"
  }
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/App.css",
    text`
#app {
    height: 100vh;
    text-align: center;
}

#logo {
    display: block;
    width: 50%;
    height: 50%;
    margin: auto;
    padding: 10% 0 0;
    background-position: center;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    background-origin: content-box;
}

.result {
    height: 20px;
    line-height: 20px;
    margin: 1.5rem auto;
}

.input-box .btn {
    width: 60px;
    height: 30px;
    line-height: 30px;
    border-radius: 3px;
    border: none;
    margin: 0 0 0 20px;
    padding: 0 8px;
    cursor: pointer;
}

.input-box .btn:hover {
    background-image: linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%);
    color: #333333;
}

.input-box .input {
    border: none;
    border-radius: 3px;
    outline: none;
    height: 30px;
    line-height: 30px;
    padding: 0 10px;
    background-color: rgba(240, 240, 240, 1);
    -webkit-font-smoothing: antialiased;
}

.input-box .input:hover {
    border: none;
    background-color: rgba(255, 255, 255, 1);
}

.input-box .input:focus {
    border: none;
    background-color: rgba(255, 255, 255, 1);
}
`,
  );
  add(
    files,
    "apps/desktop/frontend/src/App.tsx",
    text`
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import { Providers } from "./components/providers";
import { AdminDashboard } from "@/modules/admin/dashboard/components/admin-dashboard";
import { AdminPostsPage } from "@/modules/admin/posts/components/admin-posts-page";
import { AdminShell } from "@/modules/admin/shared/components/admin-shell";
import { AdminUsersPage } from "@/modules/admin/users/components/admin-users-page";
import { LoginPage } from "@/modules/auth/components/login-page";
import { PostsPage } from "@/modules/posts/components/posts-page";

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Routes>
          <Route path="/" element={<PostsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="posts" element={<AdminPostsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
          </Route>
        </Routes>
      </Providers>
    </BrowserRouter>
  );
}

`,
  );
  addBinary(files, "apps/desktop/frontend/src/assets/fonts/nunito-v16-latin-regular.woff2", "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");
  add(
    files,
    "apps/desktop/frontend/src/assets/fonts/OFL.txt",
    text`
Copyright 2016 The Nunito Project Authors (contact@sansoxygen.com),

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

`,
  );
  addBinary(files, "apps/desktop/frontend/src/assets/images/logo-universal.png", "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");
  add(
    files,
    "apps/desktop/frontend/src/components/providers.tsx",
    text`
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { createTRPCClient, trpc } from "../trpc/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/lib/auth-client.ts",
    text`
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getApiBaseUrl } from "@/lib/api-url";

import { wailsClient } from "./wails-auth-client";

export const authClient = createAuthClient({
  baseURL: getApiBaseUrl() || undefined,
  fetchOptions: {
    credentials: "omit",
  },
  plugins: [adminClient(), wailsClient() as never],
});

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/lib/auth-headers.ts",
    text`
import {
  clearAuthStorage,
  readAuthStorage,
  waitForWailsRuntime,
} from "./wails-storage";

function safeJSONParse(value: string) {
  try {
    return JSON.parse(value) as Record<
      string,
      { value?: string; expires?: string | null }
    >;
  } catch {
    return null;
  }
}

function buildCookieHeader(raw: string) {
  const parsed = safeJSONParse(raw);
  if (!parsed) {
    return "";
  }

  return Object.entries(parsed).reduce((acc, [key, value]) => {
    if (value.expires && new Date(value.expires) < new Date()) {
      return acc;
    }

    return acc ? \`\${acc}; \${key}=\${value.value ?? ""}\` : \`\${key}=\${value.value ?? ""}\`;
  }, "");
}

function buildBearerToken(raw: string) {
  const parsed = safeJSONParse(raw);
  if (!parsed) {
    return "";
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key.includes("session_token") && value.value) {
      return value.value;
    }
  }

  return "";
}

export async function getAuthRequestHeaders(): Promise<Record<string, string>> {
  await waitForWailsRuntime();

  const headers: Record<string, string> = {};
  const raw = await readAuthStorage();
  const stored = raw ?? "";

  const cookie = buildCookieHeader(stored);
  if (cookie) {
    headers.cookie = cookie;
  }

  const bearerToken = buildBearerToken(stored);
  if (bearerToken) {
    headers.authorization = \`Bearer \${bearerToken}\`;
  }

  return headers;
}

export async function clearDesktopAuthStorage() {
  await clearAuthStorage();
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/lib/wails-auth-client.ts",
    text`
import {
  clearAuthStorage,
  readAuthStorage,
  waitForWailsRuntime,
  writeAuthStorage,
} from "./wails-storage";

const cookieName = "better-auth_cookie";

const storage = {
  async getItem(key: string) {
    if (key !== cookieName) {
      return null;
    }

    await waitForWailsRuntime();
    return readAuthStorage();
  },
  async setItem(key: string, value: string) {
    if (key !== cookieName) {
      return;
    }

    await waitForWailsRuntime();
    await writeAuthStorage(value);
  },
  async removeItem(key: string) {
    if (key !== cookieName) {
      return;
    }

    await waitForWailsRuntime();
    await clearAuthStorage();
  },
};

function safeJSONParse(value: string) {
  try {
    return JSON.parse(value) as Record<
      string,
      { value?: string; expires?: string | null }
    >;
  } catch {
    return null;
  }
}

function getCookie(raw: string) {
  const parsed = safeJSONParse(raw);
  if (!parsed) {
    return "";
  }

  return Object.entries(parsed).reduce((acc, [key, value]) => {
    if (value.expires && new Date(value.expires) < new Date()) {
      return acc;
    }

    return acc ? \`\${acc}; \${key}=\${value.value ?? ""}\` : \`\${key}=\${value.value ?? ""}\`;
  }, "");
}

function parseSetCookieHeader(setCookie: string, prevCookie?: string) {
  const parsed = safeJSONParse(prevCookie ?? "{}") ?? {};
  const parts = setCookie.split(/,(?=\\s*[^;]+=)/);

  for (const part of parts) {
    const pair = part.split(";")[0];
    if (!pair) {
      continue;
    }

    const separator = pair.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!name) {
      continue;
    }

    parsed[name] = { value, expires: null };
  }

  return JSON.stringify(parsed);
}

function hasSessionCookieChanged(prevCookie: string | null, nextCookie: string) {
  if (!prevCookie) {
    return true;
  }

  try {
    const prev = JSON.parse(prevCookie) as Record<string, { value?: string }>;
    const next = JSON.parse(nextCookie) as Record<string, { value?: string }>;
    const keys = new Set([
      ...Object.keys(prev).filter((key) => key.includes("session_token")),
      ...Object.keys(next).filter((key) => key.includes("session_token")),
    ]);

    for (const key of keys) {
      if (prev[key]?.value !== next[key]?.value) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

function hasBetterAuthCookies(setCookie: string, prefix = "better-auth") {
  return setCookie.includes(\`\${prefix}.\`) || setCookie.includes(\`\${prefix}-\`);
}

function getBearerToken(raw: string) {
  const parsed = safeJSONParse(raw);
  if (!parsed) {
    return "";
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key.includes("session_token") && value.value) {
      return value.value;
    }
  }

  return "";
}

async function persistToken(token: string) {
  const prevCookie = await storage.getItem(cookieName);
  const nextCookie = JSON.stringify({
    ...(safeJSONParse(prevCookie ?? "{}") ?? {}),
    "better-auth.session_token": {
      value: token,
      expires: null,
    },
  });

  await storage.setItem(cookieName, nextCookie);
  return nextCookie;
}

export function wailsClient() {
  let notifySession: (() => void) | undefined;

  return {
    id: "wails",
    getActions(_: unknown, store: { notify: (signal: string) => void }) {
      notifySession = () => store.notify("$sessionSignal");
      return {};
    },
    fetchPlugins: [
      {
        id: "wails",
        name: "Wails",
        hooks: {
          async onSuccess(context: {
            response: Response;
            request: { url: string | URL };
            data?: { token?: string };
          }) {
            const authToken = context.response.headers.get("set-auth-token");
            if (authToken) {
              await persistToken(authToken);
              notifySession?.();
              return;
            }

            const rawSetCookie = context.response.headers.get("set-cookie");
            if (rawSetCookie && hasBetterAuthCookies(rawSetCookie)) {
              const prevCookie = await storage.getItem(cookieName);
              const nextCookie = parseSetCookieHeader(
                rawSetCookie,
                prevCookie ?? undefined,
              );

              if (hasSessionCookieChanged(prevCookie, nextCookie)) {
                await storage.setItem(cookieName, nextCookie);
                notifySession?.();
              } else {
                await storage.setItem(cookieName, nextCookie);
              }
            }

            if (context.request.url.toString().includes("/sign-out")) {
              await storage.removeItem(cookieName);
              notifySession?.();
              return;
            }

            const token =
              typeof context.data?.token === "string" ? context.data.token : "";
            if (token) {
              await persistToken(token);
              notifySession?.();
            }
          },
        },
        async init(url: string, options: RequestInit = {}) {
          await waitForWailsRuntime();
          const stored = (await storage.getItem(cookieName)) ?? "{}";
          const cookie = getCookie(stored);
          const bearerToken = getBearerToken(stored);

          return {
            url,
            options: {
              ...options,
              credentials: "omit" as RequestCredentials,
              headers: {
                ...options.headers,
                ...(cookie ? { cookie } : {}),
                ...(bearerToken ? { authorization: \`Bearer \${bearerToken}\` } : {}),
              },
            },
          };
        },
      },
    ],
  } as const;
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/lib/wails-storage.ts",
    text`
const cookieName = "better-auth_cookie";

type WailsAppBindings = {
  GetAuthStorage?: () => Promise<string> | string;
  SetAuthStorage?: (value: string) => Promise<void> | void;
  ClearAuthStorage?: () => Promise<void> | void;
};

function getWailsApp(): WailsAppBindings | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { go?: { main?: { App?: WailsAppBindings } } }).go
    ?.main?.App;
}

export async function waitForWailsRuntime(timeoutMs = 5000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (getWailsApp()?.GetAuthStorage) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return Boolean(getWailsApp()?.GetAuthStorage);
}

export async function readAuthStorage() {
  const app = getWailsApp();

  if (app?.GetAuthStorage) {
    const raw = await app.GetAuthStorage();
    return raw && raw !== "{}" ? raw : null;
  }

  const fallback = localStorage.getItem(cookieName);
  return fallback && fallback !== "{}" ? fallback : null;
}

export async function writeAuthStorage(value: string) {
  const app = getWailsApp();

  if (app?.SetAuthStorage) {
    await app.SetAuthStorage(value);
    return;
  }

  localStorage.setItem(cookieName, value);
}

export async function clearAuthStorage() {
  const app = getWailsApp();

  if (app?.ClearAuthStorage) {
    await app.ClearAuthStorage();
    return;
  }

  localStorage.removeItem(cookieName);
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/main.tsx",
    text`
import React from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import App from "./App";

const container = document.getElementById("root");

createRoot(container!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/lib/navigation.tsx",
    text`
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

export function AppLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return <Link to={to} className={className}>{children}</Link>;
}

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return {
    navigate(to: string) {
      navigate(to);
    },
    refresh() {
      // Route queries refresh when the destination mounts.
    },
    getSearchParam(name: string) {
      return new URLSearchParams(location.search).get(name);
    },
  };
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/style.css",
    text`
html {
    background-color: rgba(27, 38, 54, 1);
    text-align: center;
    color: white;
}

body {
    margin: 0;
    color: white;
    font-family: "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
    "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
    sans-serif;
}

@font-face {
    font-family: "Nunito";
    font-style: normal;
    font-weight: 400;
    src: local(""),
    url("assets/fonts/nunito-v16-latin-regular.woff2") format("woff2");
}

#app {
    height: 100vh;
    text-align: center;
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/styles.css",
    text`
@import "tailwindcss";
@source "../../../web/src";
@source "./";

@import "../../../web/src/styles/theme.css";

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/trpc/client.tsx",
    text`
"use client";

import type { AppRouter } from "@repo/api";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { getApiBaseUrl } from "@/lib/api-url";

import { getAuthRequestHeaders } from "../lib/auth-headers";

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: getApiBaseUrl() + "/api/trpc",
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "omit",
          });
        },
        async headers() {
          return {
            "x-trpc-source": "wails-desktop",
            ...(await getAuthRequestHeaders()),
          };
        },
      }),
    ],
  });
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/src/vite-env.d.ts",
    text`
/// <reference types="vite/client" />

`,
  );
  add(
    files,
    "apps/desktop/frontend/tsconfig.json",
    text`
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["node", "vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["../../web/src/*"],
      "@/lib/navigation": ["./src/lib/navigation.tsx"]
    }
  },
  "include": ["src", "../../web/src"]
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/tsconfig.node.json",
    text`
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "vite.config.ts"
  ]
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/vite.config.ts",
    text`
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(__dirname, "../../web/src");
const desktopSrc = path.resolve(__dirname, "src");
const rootEnvDir = path.resolve(__dirname, "../../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, "");

  return {
    envDir: rootEnvDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@/lib/auth-client",
          replacement: path.resolve(desktopSrc, "lib/auth-client.ts"),
        },
        {
          find: "@/lib/auth-headers",
          replacement: path.resolve(desktopSrc, "lib/auth-headers.ts"),
        },
        {
          find: "@/lib/navigation",
          replacement: path.resolve(desktopSrc, "lib/navigation.tsx"),
        },
        {
          find: "@/trpc/client",
          replacement: path.resolve(desktopSrc, "trpc/client.tsx"),
        },
        {
          find: "@",
          replacement: webSrc,
        },
      ],
    },
    define: {
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
        process.env.VITE_API_URL ?? env.VITE_API_URL ?? "http://localhost:4000",
      ),
    },
    server: {
      port: 5174,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, "../.."), webSrc],
      },
    },
  };
});

`,
  );
  add(
    files,
    "apps/desktop/frontend/wailsjs/go/main/App.d.ts",
    text`
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

export function ClearAuthStorage():Promise<void>;

export function GetAuthStorage():Promise<string>;

export function SetAuthStorage(arg1:string):Promise<void>;

`,
  );
  add(
    files,
    "apps/desktop/frontend/wailsjs/go/main/App.js",
    text`
// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

export function ClearAuthStorage() {
  return window['go']['main']['App']['ClearAuthStorage']();
}

export function GetAuthStorage() {
  return window['go']['main']['App']['GetAuthStorage']();
}

export function SetAuthStorage(arg1) {
  return window['go']['main']['App']['SetAuthStorage'](arg1);
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/wailsjs/runtime/package.json",
    text`
{
  "name": "@wailsapp/runtime",
  "version": "2.0.0",
  "description": "Wails Javascript runtime library",
  "main": "runtime.js",
  "types": "runtime.d.ts",
  "scripts": {
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/wailsapp/wails.git"
  },
  "keywords": [
    "Wails",
    "Javascript",
    "Go"
  ],
  "author": "Lea Anthony <lea.anthony@gmail.com>",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/wailsapp/wails/issues"
  },
  "homepage": "https://github.com/wailsapp/wails#readme"
}

`,
  );
  add(
    files,
    "apps/desktop/frontend/wailsjs/runtime/runtime.d.ts",
    text`
/*
 _       __      _ __
| |     / /___ _(_) /____
| | /| / / __ \`/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/

export interface Position {
    x: number;
    y: number;
}

export interface Size {
    w: number;
    h: number;
}

export interface Screen {
    isCurrent: boolean;
    isPrimary: boolean;
    width : number
    height : number
}

// Environment information such as platform, buildtype, ...
export interface EnvironmentInfo {
    buildType: string;
    platform: string;
    arch: string;
}

// [EventsEmit](https://wails.io/docs/reference/runtime/events#eventsemit)
// emits the given event. Optional data may be passed with the event.
// This will trigger any event listeners.
export function EventsEmit(eventName: string, ...data: any): void;

// [EventsOn](https://wails.io/docs/reference/runtime/events#eventson) sets up a listener for the given event name.
export function EventsOn(eventName: string, callback: (...data: any) => void): () => void;

// [EventsOnMultiple](https://wails.io/docs/reference/runtime/events#eventsonmultiple)
// sets up a listener for the given event name, but will only trigger a given number times.
export function EventsOnMultiple(eventName: string, callback: (...data: any) => void, maxCallbacks: number): () => void;

// [EventsOnce](https://wails.io/docs/reference/runtime/events#eventsonce)
// sets up a listener for the given event name, but will only trigger once.
export function EventsOnce(eventName: string, callback: (...data: any) => void): () => void;

// [EventsOff](https://wails.io/docs/reference/runtime/events#eventsoff)
// unregisters the listener for the given event name.
export function EventsOff(eventName: string, ...additionalEventNames: string[]): void;

// [EventsOffAll](https://wails.io/docs/reference/runtime/events#eventsoffall)
// unregisters all listeners.
export function EventsOffAll(): void;

// [LogPrint](https://wails.io/docs/reference/runtime/log#logprint)
// logs the given message as a raw message
export function LogPrint(message: string): void;

// [LogTrace](https://wails.io/docs/reference/runtime/log#logtrace)
// logs the given message at the \`trace\` log level.
export function LogTrace(message: string): void;

// [LogDebug](https://wails.io/docs/reference/runtime/log#logdebug)
// logs the given message at the \`debug\` log level.
export function LogDebug(message: string): void;

// [LogError](https://wails.io/docs/reference/runtime/log#logerror)
// logs the given message at the \`error\` log level.
export function LogError(message: string): void;

// [LogFatal](https://wails.io/docs/reference/runtime/log#logfatal)
// logs the given message at the \`fatal\` log level.
// The application will quit after calling this method.
export function LogFatal(message: string): void;

// [LogInfo](https://wails.io/docs/reference/runtime/log#loginfo)
// logs the given message at the \`info\` log level.
export function LogInfo(message: string): void;

// [LogWarning](https://wails.io/docs/reference/runtime/log#logwarning)
// logs the given message at the \`warning\` log level.
export function LogWarning(message: string): void;

// [WindowReload](https://wails.io/docs/reference/runtime/window#windowreload)
// Forces a reload by the main application as well as connected browsers.
export function WindowReload(): void;

// [WindowReloadApp](https://wails.io/docs/reference/runtime/window#windowreloadapp)
// Reloads the application frontend.
export function WindowReloadApp(): void;

// [WindowSetAlwaysOnTop](https://wails.io/docs/reference/runtime/window#windowsetalwaysontop)
// Sets the window AlwaysOnTop or not on top.
export function WindowSetAlwaysOnTop(b: boolean): void;

// [WindowSetSystemDefaultTheme](https://wails.io/docs/next/reference/runtime/window#windowsetsystemdefaulttheme)
// *Windows only*
// Sets window theme to system default (dark/light).
export function WindowSetSystemDefaultTheme(): void;

// [WindowSetLightTheme](https://wails.io/docs/next/reference/runtime/window#windowsetlighttheme)
// *Windows only*
// Sets window to light theme.
export function WindowSetLightTheme(): void;

// [WindowSetDarkTheme](https://wails.io/docs/next/reference/runtime/window#windowsetdarktheme)
// *Windows only*
// Sets window to dark theme.
export function WindowSetDarkTheme(): void;

// [WindowCenter](https://wails.io/docs/reference/runtime/window#windowcenter)
// Centers the window on the monitor the window is currently on.
export function WindowCenter(): void;

// [WindowSetTitle](https://wails.io/docs/reference/runtime/window#windowsettitle)
// Sets the text in the window title bar.
export function WindowSetTitle(title: string): void;

// [WindowFullscreen](https://wails.io/docs/reference/runtime/window#windowfullscreen)
// Makes the window full screen.
export function WindowFullscreen(): void;

// [WindowUnfullscreen](https://wails.io/docs/reference/runtime/window#windowunfullscreen)
// Restores the previous window dimensions and position prior to full screen.
export function WindowUnfullscreen(): void;

// [WindowIsFullscreen](https://wails.io/docs/reference/runtime/window#windowisfullscreen)
// Returns the state of the window, i.e. whether the window is in full screen mode or not.
export function WindowIsFullscreen(): Promise<boolean>;

// [WindowSetSize](https://wails.io/docs/reference/runtime/window#windowsetsize)
// Sets the width and height of the window.
export function WindowSetSize(width: number, height: number): void;

// [WindowGetSize](https://wails.io/docs/reference/runtime/window#windowgetsize)
// Gets the width and height of the window.
export function WindowGetSize(): Promise<Size>;

// [WindowSetMaxSize](https://wails.io/docs/reference/runtime/window#windowsetmaxsize)
// Sets the maximum window size. Will resize the window if the window is currently larger than the given dimensions.
// Setting a size of 0,0 will disable this constraint.
export function WindowSetMaxSize(width: number, height: number): void;

// [WindowSetMinSize](https://wails.io/docs/reference/runtime/window#windowsetminsize)
// Sets the minimum window size. Will resize the window if the window is currently smaller than the given dimensions.
// Setting a size of 0,0 will disable this constraint.
export function WindowSetMinSize(width: number, height: number): void;

// [WindowSetPosition](https://wails.io/docs/reference/runtime/window#windowsetposition)
// Sets the window position relative to the monitor the window is currently on.
export function WindowSetPosition(x: number, y: number): void;

// [WindowGetPosition](https://wails.io/docs/reference/runtime/window#windowgetposition)
// Gets the window position relative to the monitor the window is currently on.
export function WindowGetPosition(): Promise<Position>;

// [WindowHide](https://wails.io/docs/reference/runtime/window#windowhide)
// Hides the window.
export function WindowHide(): void;

// [WindowShow](https://wails.io/docs/reference/runtime/window#windowshow)
// Shows the window, if it is currently hidden.
export function WindowShow(): void;

// [WindowMaximise](https://wails.io/docs/reference/runtime/window#windowmaximise)
// Maximises the window to fill the screen.
export function WindowMaximise(): void;

// [WindowToggleMaximise](https://wails.io/docs/reference/runtime/window#windowtogglemaximise)
// Toggles between Maximised and UnMaximised.
export function WindowToggleMaximise(): void;

// [WindowUnmaximise](https://wails.io/docs/reference/runtime/window#windowunmaximise)
// Restores the window to the dimensions and position prior to maximising.
export function WindowUnmaximise(): void;

// [WindowIsMaximised](https://wails.io/docs/reference/runtime/window#windowismaximised)
// Returns the state of the window, i.e. whether the window is maximised or not.
export function WindowIsMaximised(): Promise<boolean>;

// [WindowMinimise](https://wails.io/docs/reference/runtime/window#windowminimise)
// Minimises the window.
export function WindowMinimise(): void;

// [WindowUnminimise](https://wails.io/docs/reference/runtime/window#windowunminimise)
// Restores the window to the dimensions and position prior to minimising.
export function WindowUnminimise(): void;

// [WindowIsMinimised](https://wails.io/docs/reference/runtime/window#windowisminimised)
// Returns the state of the window, i.e. whether the window is minimised or not.
export function WindowIsMinimised(): Promise<boolean>;

// [WindowIsNormal](https://wails.io/docs/reference/runtime/window#windowisnormal)
// Returns the state of the window, i.e. whether the window is normal or not.
export function WindowIsNormal(): Promise<boolean>;

// [WindowSetBackgroundColour](https://wails.io/docs/reference/runtime/window#windowsetbackgroundcolour)
// Sets the background colour of the window to the given RGBA colour definition. This colour will show through for all transparent pixels.
export function WindowSetBackgroundColour(R: number, G: number, B: number, A: number): void;

// [ScreenGetAll](https://wails.io/docs/reference/runtime/window#screengetall)
// Gets the all screens. Call this anew each time you want to refresh data from the underlying windowing system.
export function ScreenGetAll(): Promise<Screen[]>;

// [BrowserOpenURL](https://wails.io/docs/reference/runtime/browser#browseropenurl)
// Opens the given URL in the system browser.
export function BrowserOpenURL(url: string): void;

// [Environment](https://wails.io/docs/reference/runtime/intro#environment)
// Returns information about the environment
export function Environment(): Promise<EnvironmentInfo>;

// [Quit](https://wails.io/docs/reference/runtime/intro#quit)
// Quits the application.
export function Quit(): void;

// [Hide](https://wails.io/docs/reference/runtime/intro#hide)
// Hides the application.
export function Hide(): void;

// [Show](https://wails.io/docs/reference/runtime/intro#show)
// Shows the application.
export function Show(): void;

// [ClipboardGetText](https://wails.io/docs/reference/runtime/clipboard#clipboardgettext)
// Returns the current text stored on clipboard
export function ClipboardGetText(): Promise<string>;

// [ClipboardSetText](https://wails.io/docs/reference/runtime/clipboard#clipboardsettext)
// Sets a text on the clipboard
export function ClipboardSetText(text: string): Promise<boolean>;

// [OnFileDrop](https://wails.io/docs/reference/runtime/draganddrop#onfiledrop)
// OnFileDrop listens to drag and drop events and calls the callback with the coordinates of the drop and an array of path strings.
export function OnFileDrop(callback: (x: number, y: number ,paths: string[]) => void, useDropTarget: boolean) :void

// [OnFileDropOff](https://wails.io/docs/reference/runtime/draganddrop#dragandddropoff)
// OnFileDropOff removes the drag and drop listeners and handlers.
export function OnFileDropOff() :void

// Check if the file path resolver is available
export function CanResolveFilePaths(): boolean;

// Resolves file paths for an array of files
export function ResolveFilePaths(files: File[]): void
`,
  );
  add(
    files,
    "apps/desktop/frontend/wailsjs/runtime/runtime.js",
    text`
/*
 _       __      _ __
| |     / /___ _(_) /____
| | /| / / __ \`/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/

export function LogPrint(message) {
    window.runtime.LogPrint(message);
}

export function LogTrace(message) {
    window.runtime.LogTrace(message);
}

export function LogDebug(message) {
    window.runtime.LogDebug(message);
}

export function LogInfo(message) {
    window.runtime.LogInfo(message);
}

export function LogWarning(message) {
    window.runtime.LogWarning(message);
}

export function LogError(message) {
    window.runtime.LogError(message);
}

export function LogFatal(message) {
    window.runtime.LogFatal(message);
}

export function EventsOnMultiple(eventName, callback, maxCallbacks) {
    return window.runtime.EventsOnMultiple(eventName, callback, maxCallbacks);
}

export function EventsOn(eventName, callback) {
    return EventsOnMultiple(eventName, callback, -1);
}

export function EventsOff(eventName, ...additionalEventNames) {
    return window.runtime.EventsOff(eventName, ...additionalEventNames);
}

export function EventsOffAll() {
  return window.runtime.EventsOffAll();
}

export function EventsOnce(eventName, callback) {
    return EventsOnMultiple(eventName, callback, 1);
}

export function EventsEmit(eventName) {
    let args = [eventName].slice.call(arguments);
    return window.runtime.EventsEmit.apply(null, args);
}

export function WindowReload() {
    window.runtime.WindowReload();
}

export function WindowReloadApp() {
    window.runtime.WindowReloadApp();
}

export function WindowSetAlwaysOnTop(b) {
    window.runtime.WindowSetAlwaysOnTop(b);
}

export function WindowSetSystemDefaultTheme() {
    window.runtime.WindowSetSystemDefaultTheme();
}

export function WindowSetLightTheme() {
    window.runtime.WindowSetLightTheme();
}

export function WindowSetDarkTheme() {
    window.runtime.WindowSetDarkTheme();
}

export function WindowCenter() {
    window.runtime.WindowCenter();
}

export function WindowSetTitle(title) {
    window.runtime.WindowSetTitle(title);
}

export function WindowFullscreen() {
    window.runtime.WindowFullscreen();
}

export function WindowUnfullscreen() {
    window.runtime.WindowUnfullscreen();
}

export function WindowIsFullscreen() {
    return window.runtime.WindowIsFullscreen();
}

export function WindowGetSize() {
    return window.runtime.WindowGetSize();
}

export function WindowSetSize(width, height) {
    window.runtime.WindowSetSize(width, height);
}

export function WindowSetMaxSize(width, height) {
    window.runtime.WindowSetMaxSize(width, height);
}

export function WindowSetMinSize(width, height) {
    window.runtime.WindowSetMinSize(width, height);
}

export function WindowSetPosition(x, y) {
    window.runtime.WindowSetPosition(x, y);
}

export function WindowGetPosition() {
    return window.runtime.WindowGetPosition();
}

export function WindowHide() {
    window.runtime.WindowHide();
}

export function WindowShow() {
    window.runtime.WindowShow();
}

export function WindowMaximise() {
    window.runtime.WindowMaximise();
}

export function WindowToggleMaximise() {
    window.runtime.WindowToggleMaximise();
}

export function WindowUnmaximise() {
    window.runtime.WindowUnmaximise();
}

export function WindowIsMaximised() {
    return window.runtime.WindowIsMaximised();
}

export function WindowMinimise() {
    window.runtime.WindowMinimise();
}

export function WindowUnminimise() {
    window.runtime.WindowUnminimise();
}

export function WindowSetBackgroundColour(R, G, B, A) {
    window.runtime.WindowSetBackgroundColour(R, G, B, A);
}

export function ScreenGetAll() {
    return window.runtime.ScreenGetAll();
}

export function WindowIsMinimised() {
    return window.runtime.WindowIsMinimised();
}

export function WindowIsNormal() {
    return window.runtime.WindowIsNormal();
}

export function BrowserOpenURL(url) {
    window.runtime.BrowserOpenURL(url);
}

export function Environment() {
    return window.runtime.Environment();
}

export function Quit() {
    window.runtime.Quit();
}

export function Hide() {
    window.runtime.Hide();
}

export function Show() {
    window.runtime.Show();
}

export function ClipboardGetText() {
    return window.runtime.ClipboardGetText();
}

export function ClipboardSetText(text) {
    return window.runtime.ClipboardSetText(text);
}

/**
 * Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
 *
 * @export
 * @callback OnFileDropCallback
 * @param {number} x - x coordinate of the drop
 * @param {number} y - y coordinate of the drop
 * @param {string[]} paths - A list of file paths.
 */

/**
 * OnFileDrop listens to drag and drop events and calls the callback with the coordinates of the drop and an array of path strings.
 *
 * @export
 * @param {OnFileDropCallback} callback - Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
 * @param {boolean} [useDropTarget=true] - Only call the callback when the drop finished on an element that has the drop target style. (--wails-drop-target)
 */
export function OnFileDrop(callback, useDropTarget) {
    return window.runtime.OnFileDrop(callback, useDropTarget);
}

/**
 * OnFileDropOff removes the drag and drop listeners and handlers.
 */
export function OnFileDropOff() {
    return window.runtime.OnFileDropOff();
}

export function CanResolveFilePaths() {
    return window.runtime.CanResolveFilePaths();
}

export function ResolveFilePaths(files) {
    return window.runtime.ResolveFilePaths(files);
}
`,
  );
  add(
    files,
    "apps/desktop/go.mod",
    text`
module desktop

go 1.23

require github.com/wailsapp/wails/v2 v2.11.0

require (
	github.com/bep/debounce v1.2.1 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/godbus/dbus/v5 v5.1.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/jchv/go-winloader v0.0.0-20210711035445-715c2860da7e // indirect
	github.com/labstack/echo/v4 v4.13.3 // indirect
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/leaanthony/go-ansi-parser v1.6.1 // indirect
	github.com/leaanthony/gosod v1.0.4 // indirect
	github.com/leaanthony/slicer v1.6.0 // indirect
	github.com/leaanthony/u v1.1.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/samber/lo v1.49.1 // indirect
	github.com/tkrajina/go-reflector v0.5.8 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	github.com/wailsapp/go-webview2 v1.0.22 // indirect
	github.com/wailsapp/mimetype v1.4.1 // indirect
	golang.org/x/crypto v0.33.0 // indirect
	golang.org/x/net v0.35.0 // indirect
	golang.org/x/sys v0.30.0 // indirect
	golang.org/x/text v0.22.0 // indirect
)

// replace github.com/wailsapp/wails/v2 v2.11.0 => /Users/terry/go/pkg/mod

`,
  );
  add(
    files,
    "apps/desktop/go.sum",
    text`
github.com/bep/debounce v1.2.1 h1:v67fRdBA9UQu2NhLFXrSg0Brw7CexQekrBwDMM8bzeY=
github.com/bep/debounce v1.2.1/go.mod h1:H8yggRPQKLUhUoqrJC1bO2xNya7vanpDl7xR3ISbCJ0=
github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
github.com/go-ole/go-ole v1.3.0 h1:Dt6ye7+vXGIKZ7Xtk4s6/xVdGDQynvom7xCFEdWr6uE=
github.com/go-ole/go-ole v1.3.0/go.mod h1:5LS6F96DhAwUc7C+1HLexzMXY1xGRSryjyPPKW6zv78=
github.com/godbus/dbus/v5 v5.1.0 h1:4KLkAxT3aOY8Li4FRJe/KvhoNFFxo0m6fNuFUO8QJUk=
github.com/godbus/dbus/v5 v5.1.0/go.mod h1:xhWf0FNVPg57R7Z0UbKHbJfkEywrmjJnf7w5xrFpKfA=
github.com/google/uuid v1.6.0 h1:NIvaJDMOsjHA8n1jAhLSgzrAzy1Hgr+hNrb57e+94F0=
github.com/google/uuid v1.6.0/go.mod h1:TIyPZe4MgqvfeYDBFedMoGGpEw/LqOeaOT+nhxU+yHo=
github.com/gorilla/websocket v1.5.3 h1:saDtZ6Pbx/0u+bgYQ3q96pZgCzfhKXGPqt7kZ72aNNg=
github.com/gorilla/websocket v1.5.3/go.mod h1:YR8l580nyteQvAITg2hZ9XVh4b55+EU/adAjf1fMHhE=
github.com/jchv/go-winloader v0.0.0-20210711035445-715c2860da7e h1:Q3+PugElBCf4PFpxhErSzU3/PY5sFL5Z6rfv4AbGAck=
github.com/jchv/go-winloader v0.0.0-20210711035445-715c2860da7e/go.mod h1:alcuEEnZsY1WQsagKhZDsoPCRoOijYqhZvPwLG0kzVs=
github.com/labstack/echo/v4 v4.13.3 h1:pwhpCPrTl5qry5HRdM5FwdXnhXSLSY+WE+YQSeCaafY=
github.com/labstack/echo/v4 v4.13.3/go.mod h1:o90YNEeQWjDozo584l7AwhJMHN0bOC4tAfg+Xox9q5g=
github.com/labstack/gommon v0.4.2 h1:F8qTUNXgG1+6WQmqoUWnz8WiEU60mXVVw0P4ht1WRA0=
github.com/labstack/gommon v0.4.2/go.mod h1:QlUFxVM+SNXhDL/Z7YhocGIBYOiwB0mXm1+1bAPHPyU=
github.com/leaanthony/debme v1.2.1 h1:9Tgwf+kjcrbMQ4WnPcEIUcQuIZYqdWftzZkBr+i/oOc=
github.com/leaanthony/debme v1.2.1/go.mod h1:3V+sCm5tYAgQymvSOfYQ5Xx2JCr+OXiD9Jkw3otUjiA=
github.com/leaanthony/go-ansi-parser v1.6.1 h1:xd8bzARK3dErqkPFtoF9F3/HgN8UQk0ed1YDKpEz01A=
github.com/leaanthony/go-ansi-parser v1.6.1/go.mod h1:+vva/2y4alzVmmIEpk9QDhA7vLC5zKDTRwfZGOp3IWU=
github.com/leaanthony/gosod v1.0.4 h1:YLAbVyd591MRffDgxUOU1NwLhT9T1/YiwjKZpkNFeaI=
github.com/leaanthony/gosod v1.0.4/go.mod h1:GKuIL0zzPj3O1SdWQOdgURSuhkF+Urizzxh26t9f1cw=
github.com/leaanthony/slicer v1.6.0 h1:1RFP5uiPJvT93TAHi+ipd3NACobkW53yUiBqZheE/Js=
github.com/leaanthony/slicer v1.6.0/go.mod h1:o/Iz29g7LN0GqH3aMjWAe90381nyZlDNquK+mtH2Fj8=
github.com/leaanthony/u v1.1.1 h1:TUFjwDGlNX+WuwVEzDqQwC2lOv0P4uhTQw7CMFdiK7M=
github.com/leaanthony/u v1.1.1/go.mod h1:9+o6hejoRljvZ3BzdYlVL0JYCwtnAsVuN9pVTQcaRfI=
github.com/matryer/is v1.4.0/go.mod h1:8I/i5uYgLzgsgEloJE1U6xx5HkBQpAZvepWuujKwMRU=
github.com/matryer/is v1.4.1 h1:55ehd8zaGABKLXQUe2awZ99BD/PTc2ls+KV/dXphgEQ=
github.com/matryer/is v1.4.1/go.mod h1:8I/i5uYgLzgsgEloJE1U6xx5HkBQpAZvepWuujKwMRU=
github.com/mattn/go-colorable v0.1.13 h1:fFA4WZxdEF4tXPZVKMLwD8oUnCTTo08duU7wxecdEvA=
github.com/mattn/go-colorable v0.1.13/go.mod h1:7S9/ev0klgBDR4GtXTXX8a3vIGJpMovkB8vQcUbaXHg=
github.com/mattn/go-isatty v0.0.16/go.mod h1:kYGgaQfpe5nmfYZH+SKPsOc2e4SrIfOl2e/yFXSvRLM=
github.com/mattn/go-isatty v0.0.20 h1:xfD0iDuEKnDkl03q4limB+vH+GxLEtL/jb4xVJSWWEY=
github.com/mattn/go-isatty v0.0.20/go.mod h1:W+V8PltTTMOvKvAeJH7IuucS94S2C6jfK/D7dTCTo3Y=
github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c h1:+mdjkGKdHQG3305AYmdv1U2eRNDiU2ErMBj1gwrq8eQ=
github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c/go.mod h1:7rwL4CYBLnjLxUqIJNnCWiEdr3bn6IUYi15bNlnbCCU=
github.com/pkg/errors v0.9.1 h1:FEBLx1zS214owpjy7qsBeixbURkuhQAwrK5UwLGTwt4=
github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINEl0=
github.com/pmezard/go-difflib v1.0.0 h1:4DBwDE0NGyQoBHbLQYPwSUPoCMWR5BEzIk/f1lZbAQM=
github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
github.com/rivo/uniseg v0.2.0/go.mod h1:J6wj4VEh+S6ZtnVlnTBMWIodfgj8LQOQFoIToxlJtxc=
github.com/rivo/uniseg v0.4.7 h1:WUdvkW8uEhrYfLC4ZzdpI2ztxP1I582+49Oc5Mq64VQ=
github.com/rivo/uniseg v0.4.7/go.mod h1:FN3SvrM+Zdj16jyLfmOkMNblXMcoc8DfTHruCPUcx88=
github.com/samber/lo v1.49.1 h1:4BIFyVfuQSEpluc7Fua+j1NolZHiEHEpaSEKdsH0tew=
github.com/samber/lo v1.49.1/go.mod h1:dO6KHFzUKXgP8LDhU0oI8d2hekjXnGOu0DB8Jecxd6o=
github.com/stretchr/testify v1.10.0 h1:Xv5erBjTwe/5IxqUQTdXv5kgmIvbHo3QQyRwhJsOfJA=
github.com/stretchr/testify v1.10.0/go.mod h1:r2ic/lqez/lEtzL7wO/rwa5dbSLXVDPFyf8C91i36aY=
github.com/tkrajina/go-reflector v0.5.8 h1:yPADHrwmUbMq4RGEyaOUpz2H90sRsETNVpjzo3DLVQQ=
github.com/tkrajina/go-reflector v0.5.8/go.mod h1:ECbqLgccecY5kPmPmXg1MrHW585yMcDkVl6IvJe64T4=
github.com/valyala/bytebufferpool v1.0.0 h1:GqA5TC/0021Y/b9FG4Oi9Mr3q7XYx6KllzawFIhcdPw=
github.com/valyala/bytebufferpool v1.0.0/go.mod h1:6bBcMArwyJ5K/AmCkWv1jt77kVWyCJ6HpOuEn7z0Csc=
github.com/valyala/fasttemplate v1.2.2 h1:lxLXG0uE3Qnshl9QyaK6XJxMXlQZELvChBOCmQD0Loo=
github.com/valyala/fasttemplate v1.2.2/go.mod h1:KHLXt3tVN2HBp8eijSv/kGJopbvo7S+qRAEEKiv+SiQ=
github.com/wailsapp/go-webview2 v1.0.22 h1:YT61F5lj+GGaat5OB96Aa3b4QA+mybD0Ggq6NZijQ58=
github.com/wailsapp/go-webview2 v1.0.22/go.mod h1:qJmWAmAmaniuKGZPWwne+uor3AHMB5PFhqiK0Bbj8kc=
github.com/wailsapp/mimetype v1.4.1 h1:pQN9ycO7uo4vsUUuPeHEYoUkLVkaRntMnHJxVwYhwHs=
github.com/wailsapp/mimetype v1.4.1/go.mod h1:9aV5k31bBOv5z6u+QP8TltzvNGJPmNJD4XlAL3U+j3o=
github.com/wailsapp/wails/v2 v2.11.0 h1:seLacV8pqupq32IjS4Y7V8ucab0WZwtK6VvUVxSBtqQ=
github.com/wailsapp/wails/v2 v2.11.0/go.mod h1:jrf0ZaM6+GBc1wRmXsM8cIvzlg0karYin3erahI4+0k=
golang.org/x/crypto v0.33.0 h1:IOBPskki6Lysi0lo9qQvbxiQ+FvsCC/YWOecCHAixus=
golang.org/x/crypto v0.33.0/go.mod h1:bVdXmD7IV/4GdElGPozy6U7lWdRXA4qyRVGJV57uQ5M=
golang.org/x/net v0.0.0-20210505024714-0287a6fb4125/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
golang.org/x/net v0.35.0 h1:T5GQRQb2y08kTAByq9L4/bz8cipCdA8FbRTXewonqY8=
golang.org/x/net v0.35.0/go.mod h1:EglIi67kWsHKlRzzVMUD93VMSWGFOMSZgxFjparz1Qk=
golang.org/x/sys v0.0.0-20200810151505-1b9f1253b3ed/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
golang.org/x/sys v0.0.0-20201119102817-f84b799fce68/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
golang.org/x/sys v0.0.0-20210423082822-04245dca01da/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
golang.org/x/sys v0.0.0-20220811171246-fbc7d0a398ab/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
golang.org/x/sys v0.1.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
golang.org/x/sys v0.30.0 h1:QjkSwP/36a20jFYWkSue1YwXzLmsV5Gfq7Eiy72C1uc=
golang.org/x/sys v0.30.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
golang.org/x/text v0.3.6/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
golang.org/x/text v0.22.0 h1:bofq7m3/HAFvbF51jz3Q9wLg3jkvSPuiZu/pD1XwgtM=
golang.org/x/text v0.22.0/go.mod h1:YRoo4H8PVmsu+E3Ou7cqLVH8oXWIHVoX0jqUWALQhfY=
golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
gopkg.in/yaml.v3 v3.0.1 h1:fxVm/GzAzEWqLHuvctI91KS9hhNmmWOoWu0XTYJS7CA=
gopkg.in/yaml.v3 v3.0.1/go.mod h1:K4uyk7z7BCEPqu6E+C64Yfv1cQ7kz7rIZviUmN+EgEM=

`,
  );
  add(
    files,
    "apps/desktop/main.go",
    text`
package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "${ctx.appTitle}",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

`,
  );
  add(
    files,
    "apps/desktop/package.json",
    text`
{
  "name": "@repo/desktop",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "wails dev",
    "build": "wails build",
    "frontend:dev": "pnpm --dir frontend dev",
    "frontend:build": "pnpm --dir frontend build",
    "lint": "echo \\"No desktop lint configured\\"",
    "typecheck": "pnpm --dir frontend exec tsc --noEmit",
    "clean": "rm -rf frontend/dist build/bin .turbo frontend/node_modules node_modules"
  }
}

`,
  );
  add(
    files,
    "apps/desktop/README.md",
    text`
# ${ctx.appTitle} Desktop

Wails desktop app for the ${ctx.appTitle} monorepo. The UI is reused from \`apps/web\` through Vite path aliases and a framework-neutral navigation adapter.

## Prerequisites

- Go 1.23+
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation)
- pnpm workspace dependencies installed from the repo root

## Development

1. Start the API server from the repo root:

\`\`\`bash
pnpm dev:server
\`\`\`

2. Start the desktop app:

\`\`\`bash
pnpm dev:desktop
\`\`\`

Or run both together:

\`\`\`bash
pnpm dev:desktop:all
\`\`\`

If the API is not on \`http://localhost:${ctx.apiPort}\`, update \`VITE_API_URL\` in the monorepo root \`.env\`.

## Build

From the repo root:

\`\`\`bash
pnpm --filter @repo/desktop build
\`\`\`

Or from this directory:

\`\`\`bash
wails build
\`\`\`

The macOS app is written to \`build/bin/\`.

`,
  );
  add(
    files,
    "apps/desktop/wails.json",
    text`
{
  "$schema": "https://wails.io/schemas/config.v2.json",
  "name": "${ctx.appTitle}",
  "outputfilename": "${ctx.packageName}",
  "frontend:install": "pnpm -w install --filter @repo/desktop-frontend...",
  "frontend:build": "pnpm run build",
  "frontend:dev:watcher": "pnpm run dev",
  "frontend:dev:serverUrl": "auto",
  "author": {
    "name": "TerryMinn",
    "email": "shinnthantmindev.mm@gmail.com"
  }
}

`,
  );
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "add" || command === "remove") {
    await manageApps(command, args, {
      mobile: addMobileApp, web: addWebApp, desktop: addDesktopApp, write: writeFiles,
    });
    return;
  }
  const parsed = parseArgs(process.argv.slice(2));
  const prompted = await promptForOptions(parsed);
  const ctx = normalizeOptions(prompted);

  await ensureWritableTarget(ctx);
  const files = createFiles(ctx);
  await writeFiles(ctx, files);

  if (
    ctx.includeDesktop &&
    process.env.RANGER_SKIP_DESKTOP_SETUP !== "1"
  ) {
    console.log("");
    console.log("Setting up Go and Wails for the desktop app...");
    try {
      await runDesktopSetup(ctx.targetDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Desktop setup did not complete: " + message);
      console.warn("Run pnpm desktop:setup inside the project when you are ready.");
    }
  }

  console.log("");
  console.log("Created " + ctx.appTitle + " at " + ctx.targetDir);
  if (ctx.enabledNextForBackend) {
    console.log("Next.js backend was selected, so apps/web was enabled.");
  }
  if (ctx.enabledWebForDesktop) {
    console.log("Desktop app was selected, so apps/web was enabled.");
  }
  if (ctx.includeDesktop) {
    console.log("Desktop app uses Go + Wails. Setup runs automatically when possible.");
  }
  if (ctx.includeWeb) {
    console.log(
      "Web frontend: " +
        (ctx.frontend === "react"
          ? "React + Vite + TanStack Router"
          : "Next.js App Router"),
    );
  }
  console.log(
    "API server: " +
      backendLabel(ctx.backend) +
      (ctx.backend === "express" ? " (apps/server)" : " (apps/web)"),
  );
  console.log("");
  console.log("Next steps:");
  const relativeTarget = path.relative(process.cwd(), ctx.targetDir);
  const cdTarget =
    relativeTarget && !relativeTarget.startsWith("..")
      ? relativeTarget
      : ctx.targetDir;
  console.log("  cd " + cdTarget);
  console.log("  # update BETTER_AUTH_SECRET and SEED_ADMIN_PASSWORD in .env");
  console.log("  pnpm install");
  console.log("  pnpm db:reset   # type yes to drop/recreate the local database");
  console.log("  pnpm db:push");
  console.log("  pnpm db:seed");
  if (ctx.includeDesktop) {
    console.log("  pnpm desktop:setup   # if Go/Wails setup did not finish");
  }
  console.log("  pnpm dev");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
