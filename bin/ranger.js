#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const BACKENDS = new Set(["next", "express"]);

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

function parseArgs(argv) {
  const options = {
    appName: "",
    includeWeb: undefined,
    includeMobile: undefined,
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
      backend: options.backend ?? "next",
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
      (await confirm(rl, "Include Next.js web/admin app?", true));

    const backend =
      options.backend ??
      (await select(rl, "Backend server", [
        { value: "next", label: "Next.js API routes + tRPC" },
        { value: "express", label: "Express server + tRPC" },
      ]));

    return {
      ...options,
      appName,
      includeMobile,
      includeWeb,
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

  const includeWeb = options.backend === "next" ? true : Boolean(options.includeWeb);
  const includeMobile = Boolean(options.includeMobile);

  if (!includeWeb && !includeMobile) {
    throw new Error("Choose at least one app: web or mobile.");
  }

  return {
    targetDir,
    packageName,
    appTitle: toTitle(packageName),
    appScheme: packageName.replace(/-/g, ""),
    dbName: packageName.replace(/-/g, "_"),
    includeWeb,
    includeMobile,
    backend: options.backend,
    apiPort: options.backend === "express" ? 4000 : 3000,
    force: options.force,
    enabledNextForBackend: options.backend === "next" && options.includeWeb === false,
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
    await fs.writeFile(filePath, contents, "utf8");
  }
}

function add(files, filePath, contents) {
  files[filePath] = contents;
}

function createFiles(ctx) {
  const files = {};

  addRootFiles(files, ctx);
  addCursorRules(files);
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

  return files;
}

function rootScripts(ctx) {
  const filters = [];
  if (ctx.includeWeb) filters.push("--filter=@repo/web");
  if (ctx.includeMobile) filters.push("--filter=@repo/mobile");
  if (ctx.backend === "express") filters.push("--filter=@repo/server");

  const scripts = {
    postinstall: "turbo run db:generate --filter=@repo/db",
    build: "turbo run build",
    dev: `turbo run dev ${filters.join(" ")} --ui=tui`,
    "dev:stream": `turbo run dev ${filters.join(" ")} --ui=stream`,
    lint: "turbo run lint",
    format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,md,mdc}"',
    "format:check": 'prettier --check "**/*.{ts,tsx,js,jsx,json,md,mdc}"',
    "db:generate": "turbo run db:generate",
    "db:reset": "bash ./scripts/reset-database.sh",
    "db:push": "turbo run db:push --filter=@repo/db",
    "db:migrate": "turbo run db:migrate --filter=@repo/db",
    "db:seed": "turbo run db:seed --filter=@repo/db",
    "db:studio": "pnpm --filter @repo/db db:studio",
    typecheck: "turbo run typecheck",
  };

  if (ctx.includeWeb) scripts["dev:web"] = "turbo run dev --filter=@repo/web --ui=stream";
  if (ctx.includeMobile) scripts["dev:mobile"] = "turbo run dev --filter=@repo/mobile --ui=stream";
  if (ctx.backend === "express") scripts["dev:server"] = "turbo run dev --filter=@repo/server --ui=stream";

  return scripts;
}

function databaseUrl(ctx) {
  return `postgresql://postgres:postgres@localhost:5432/${ctx.dbName}?schema=public`;
}

function rootEnv(ctx) {
  return text`
    DATABASE_URL="${databaseUrl(ctx)}"
    BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
    BETTER_AUTH_URL="http://localhost:${ctx.apiPort}"
    CORS_ORIGIN="http://localhost:3000"
    NEXT_PUBLIC_API_URL="${ctx.backend === "express" ? "http://localhost:4000" : ""}"
    EXPO_PUBLIC_API_URL="http://127.0.0.1:${ctx.apiPort}"
    EXPO_PUBLIC_API_PORT="${ctx.apiPort}"
  `;
}

function dbEnv(ctx) {
  return text`
    # Prisma Database
    DATABASE_URL="${databaseUrl(ctx)}"
  `;
}

function webEnv(ctx) {
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
    `;
  }

  return text`
    # Express API server
    NEXT_PUBLIC_API_URL="http://localhost:4000"
    BETTER_AUTH_URL="http://localhost:4000"
  `;
}

function mobileEnv(ctx) {
  return text`
    # API URL for tRPC and Better Auth.
    # iOS simulator uses 127.0.0.1. Android emulator auto-falls back to 10.0.2.2 in code.
    # Physical devices should use your Mac LAN IP, for example http://192.168.1.10:${ctx.apiPort}.
    EXPO_PUBLIC_API_URL="http://localhost:${ctx.apiPort}"
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
  `;
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
        - "packages/*"
        - "tooling/*"
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
    "NEXT_PUBLIC_API_URL",
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
          outputs: [".next/**", "!.next/cache/**", "dist/**"],
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

      node - "$TARGET_DATABASE_URL" \
        "$ROOT_DIR/.env.example" \
        "$ROOT_DIR/packages/db/.env.example" \
        "$ROOT_DIR/apps/web/.env" \
        "$ROOT_DIR/apps/web/.env.local" \
        "$ROOT_DIR/apps/server/.env" \
        "$ROOT_DIR/apps/server/.env.example" <<'NODE'
      const fs = require("fs");
      const [databaseUrl, ...files] = process.argv.slice(2);
      const line = 'DATABASE_URL="' + databaseUrl + '"';

      for (const file of files) {
        if (!fs.existsSync(file)) continue;

        let text = fs.readFileSync(file, "utf8");
        if (/^DATABASE_URL=.*$/m.test(text)) {
          text = text.replace(/^DATABASE_URL=.*$/m, line);
        } else {
          text = text.replace(/\\s*$/u, "");
          text += (text ? "\\n" : "") + line + "\\n";
        }
        fs.writeFileSync(file, text.endsWith("\\n") ? text : text + "\\n");
      }
      NODE

      echo
      echo "Database '$DATABASE_NAME' is ready."
      echo "Updated DATABASE_URL in root, db, web, and server env files."
      echo "Next: pnpm db:push && pnpm db:seed"
    `,
  );

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
    rootEnv(ctx),
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
      ${ctx.includeWeb ? "- Next.js web/admin app with shadcn-style black and white UI" : ""}
      ${ctx.includeMobile ? "- Expo mobile app using React Native StyleSheet only" : ""}
      - ${ctx.backend === "next" ? "Next.js API routes for auth, tRPC, and uploads" : "Express API server for auth, tRPC, and uploads"}

      ## Setup

      1. Copy \`.env.example\` to \`.env\`.
      2. Update \`BETTER_AUTH_SECRET\`.
      3. Run \`pnpm install\`.
      4. Run \`pnpm db:reset\` and type \`yes\` when you are ready to drop and recreate the local database.
      5. Run \`pnpm db:push\`.
      6. Run \`pnpm db:seed\`.
      7. Run \`pnpm dev\`.

      \`pnpm db:reset\` reads the root \`package.json\` name, converts it to snake_case, creates that PostgreSQL database, updates \`.env\` \`DATABASE_URL\`, and links \`packages/db/.env\` to the root \`.env\`.

      ## Development Scripts

      - \`pnpm dev\` starts selected apps with Turbo's TUI, matching the main project.
      - \`pnpm dev:stream\` starts the same apps with plain streamed logs.
      ${ctx.includeWeb ? "- `pnpm dev:web` starts only the web/admin app." : ""}
      ${ctx.includeMobile ? "- `pnpm dev:mobile` starts only the Expo app." : ""}
      ${ctx.backend === "express" ? "- `pnpm dev:server` starts only the Express API server." : ""}

      Seeded admin:

      \`\`\`txt
      superadmin@example.com
      root64@Admin
      \`\`\`
    `,
  );
}

function addCursorRules(files) {
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

  add(
    files,
    ".cursor/rules/web-arch/web-arch.mdc",
    text`
      ---
      alwaysApply: true
      ---

      # Next.js Web Architecture

      - Route files live in \`apps/web/src/app/**\` and stay thin.
      - Feature code lives under \`apps/web/src/modules/<domain>\`.
      - Admin feature code lives under \`apps/web/src/modules/admin/<domain>\`.
      - Shared UI primitives live under \`apps/web/src/components/ui\`.
      - Business logic belongs in hooks/view-models, routers, schemas, utils, or server libs.
      - Components should render data and call actions returned by hooks.
      - Use shadcn-style primitives and keep the visual system black and white.
    `,
  );

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
    "packages/db/.env",
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
        const email = "superadmin@example.com";
        const password = "root64@Admin";
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

      const trustedOrigins = [
        baseURL,
        process.env.CORS_ORIGIN,
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:8081",
        "${ctx.appScheme}://",
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
        me: protectedProcedure.query(({ ctx }) => {
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
    "apps/web/.env",
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
    "apps/web/src/app/globals.css",
    text`
      @import "tailwindcss";

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
        color: inherit;
        text-decoration: none;
      }
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

  addWebShared(files);
  addWebRoutes(files);
  addWebModules(files);

  if (ctx.backend === "next") {
    addNextBackend(files);
  }
}

function addWebShared(files) {
  add(
    files,
    "apps/web/src/lib/api-url.ts",
    text`
      export function getApiBaseUrl() {
        return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\\/$/, "");
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
      import { httpBatchLink, loggerLink } from "@trpc/client";
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
            loggerLink({
              enabled: (op) =>
                process.env.NODE_ENV === "development" ||
                (op.direction === "down" && op.result instanceof Error),
            }),
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
                "x-trpc-source": "nextjs-react",
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

      export function buttonClassName(
        variant: ButtonVariant = "default",
        className?: string,
      ) {
        return cn(
          "inline-flex h-10 min-w-20 items-center justify-center rounded-md px-4 text-sm font-semibold leading-none transition-colors disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-black text-white visited:text-white hover:bg-neutral-800 [&_*]:text-white",
          variant === "outline" &&
            "border border-neutral-300 bg-white text-black visited:text-black hover:bg-neutral-100 [&_*]:text-black",
          variant === "ghost" &&
            "bg-transparent text-black visited:text-black hover:bg-neutral-100 [&_*]:text-black",
          className,
        );
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

function addWebRoutes(files) {
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
    "apps/web/src/modules/auth/components/login-page.tsx",
    text`
      "use client";

      import { useRouter, useSearchParams } from "next/navigation";
      import { useState } from "react";

      import { Button } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { Input } from "@/components/ui/input";
      import { authClient } from "@/lib/auth-client";

      export function LoginPage() {
        const router = useRouter();
        const searchParams = useSearchParams();
        const [mode, setMode] = useState<"login" | "register">("login");
        const [name, setName] = useState("");
        const [email, setEmail] = useState("superadmin@example.com");
        const [password, setPassword] = useState("root64@Admin");
        const [errorMessage, setErrorMessage] = useState<string | null>(null);
        const [isPending, setIsPending] = useState(false);

        async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
          event.preventDefault();
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

          router.push(searchParams.get("callbackUrl") || "/");
          router.refresh();
        }

        return (
          <main className="flex min-h-screen items-center justify-center bg-white p-6 text-black">
            <Card className="w-full max-w-md p-6">
              <div className="mb-6 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {mode === "login" ? "Welcome back" : "Create account"}
                </p>
                <h1 className="text-2xl font-semibold">Sign in to your workspace</h1>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "register" ? (
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Name"
                  />
                ) : null}
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                />
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                />
                {errorMessage ? (
                  <p className="rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-800">
                    {errorMessage}
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create a new account" : "Use an existing account"}
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
        };
      }
    `,
  );

  add(
    files,
    "apps/web/src/modules/posts/components/posts-page.tsx",
    text`
      "use client";

      import Link from "next/link";

      import { Button, buttonClassName } from "@/components/ui/button";
      import { Card } from "@/components/ui/card";
      import { Input } from "@/components/ui/input";
      import { Textarea } from "@/components/ui/textarea";
      import { authClient } from "@/lib/auth-client";

      import { usePostsViewModel } from "../hooks/use-posts-view-model";

      export function PostsPage() {
        const vm = usePostsViewModel();

        async function signOut() {
          await authClient.signOut();
          window.location.reload();
        }

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
                <Link href="/admin" className={buttonClassName("outline")}>
                  Admin
                </Link>
                {vm.isAuthed ? (
                  <Button variant="ghost" onClick={signOut}>
                    Sign out
                  </Button>
                ) : (
                  <Link href="/login" className={buttonClassName()}>
                    Sign in
                  </Link>
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
                    <Link href="/login" className={buttonClassName()}>
                      Sign in
                    </Link>
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

      import Link from "next/link";

      import { Button, buttonClassName } from "@/components/ui/button";
      import { authClient } from "@/lib/auth-client";
      import { trpc } from "@/trpc/client";

      function isDashboardRole(role: string | null | undefined) {
        return ["admin", "owner", "manager", "staff"].includes(role ?? "");
      }

      export function AdminShell({ children }: { children: React.ReactNode }) {
        const meQuery = trpc.user.me.useQuery(undefined, { retry: false });

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
              <Link href="/login?callbackUrl=/admin" className={buttonClassName()}>
                Sign in
              </Link>
            </main>
          );
        }

        return (
          <div className="min-h-screen bg-white text-black">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 p-5 md:block">
              <Link href="/" className="text-lg font-semibold">
                Ranger
              </Link>
              <nav className="mt-8 grid gap-2 text-sm">
                <Link className="rounded-md px-3 py-2 hover:bg-neutral-100" href="/admin">
                  Dashboard
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-neutral-100" href="/admin/posts">
                  Posts
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-neutral-100" href="/admin/users">
                  Users
                </Link>
              </nav>
            </aside>
            <div className="md:pl-64">
              <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-6">
                <div className="flex gap-3 text-sm md:hidden">
                  <Link href="/admin">Dashboard</Link>
                  <Link href="/admin/posts">Posts</Link>
                  <Link href="/admin/users">Users</Link>
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
    "apps/mobile/.env",
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

      export const authClient = createAuthClient({
        baseURL: getApiBaseUrl(),
        plugins: [
          expoClient({
            scheme: "${ctx.appScheme}",
            storagePrefix: "${ctx.appScheme}",
            storage: SecureStore,
          }),
        ],
      });
    `,
  );

  add(
    files,
    "apps/mobile/src/lib/trpc.tsx",
    text`
      import { useState } from "react";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { httpBatchLink, loggerLink } from "@trpc/client";
      import { createTRPCReact } from "@trpc/react-query";
      import superjson from "superjson";

      import type { AppRouter } from "@repo/api";

      import { authClient } from "./auth-client";
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
              loggerLink({
                enabled: () => __DEV__,
              }),
              httpBatchLink({
                transformer: superjson,
                url: API_BASE_URL_PLACEHOLDER + "/api/trpc",
                fetch(input, init) {
                  return fetch(resolveTrpcFetchUrl(input), init);
                },
                async headers() {
                  const headers: Record<string, string> = {
                    "x-trpc-source": "expo-react-native",
                  };
                  const cookie = authClient.getCookie();
                  if (cookie) {
                    headers.cookie = cookie;
                  }
                  return headers;
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
      import { authClient } from "./auth-client";
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

        const cookie = authClient.getCookie();
        const response = await fetch(getApiBaseUrl() + "/api/uploads", {
          method: "POST",
          headers: cookie ? { cookie } : undefined,
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

      export function useAuthViewModel() {
        const [mode, setMode] = useState<"login" | "register">("login");
        const [name, setName] = useState("");
        const [email, setEmail] = useState("superadmin@example.com");
        const [password, setPassword] = useState("root64@Admin");
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
      import { router } from "expo-router";
      import { useState } from "react";

      import { authClient } from "../../../lib/auth-client";
      import { trpc } from "../../../lib/trpc";
      import { uploadImage } from "../../../lib/upload-image";

      export function usePostsViewModel() {
        const utils = trpc.useUtils();
        const [title, setTitle] = useState("");
        const [content, setContent] = useState("");
        const [localImageUri, setLocalImageUri] = useState<string | null>(null);
        const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
        const [errorMessage, setErrorMessage] = useState<string | null>(null);

        const postsQuery = trpc.post.getAll.useQuery({ limit: 50 });
        const meQuery = trpc.user.me.useQuery(undefined, { retry: false });

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
          if (!meQuery.data) {
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
          void meQuery.refetch();
        }

        return {
          posts: postsQuery.data?.posts ?? [],
          isLoading: postsQuery.isLoading,
          isAuthed: Boolean(meQuery.data),
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
        build: "tsc",
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
        outDir: "dist",
        rootDir: "src",
        noEmit: false,
        declaration: false,
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );

  add(
    files,
    "apps/server/.env.example",
    serverEnv(ctx),
  );

  add(
    files,
    "apps/server/.env",
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
      const publicDir = path.resolve(process.cwd(), "public");
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      });

      app.use(
        cors({
          origin: corsOrigin,
          credentials: true,
        }),
      );

      app.use("/uploads", express.static(path.join(publicDir, "uploads")));

      app.all("/api/auth/*", async (req, res) => {
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

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const prompted = await promptForOptions(parsed);
  const ctx = normalizeOptions(prompted);

  await ensureWritableTarget(ctx);
  const files = createFiles(ctx);
  await writeFiles(ctx, files);

  console.log("");
  console.log("Created " + ctx.appTitle + " at " + ctx.targetDir);
  if (ctx.enabledNextForBackend) {
    console.log("Next.js backend was selected, so apps/web was enabled.");
  }
  console.log("");
  console.log("Next steps:");
  const relativeTarget = path.relative(process.cwd(), ctx.targetDir);
  const cdTarget =
    relativeTarget && !relativeTarget.startsWith("..")
      ? relativeTarget
      : ctx.targetDir;
  console.log("  cd " + cdTarget);
  console.log("  cp .env.example .env");
  console.log("  pnpm install");
  console.log("  pnpm db:reset   # type yes to drop/recreate the local database");
  console.log("  pnpm db:push");
  console.log("  pnpm db:seed");
  console.log("  pnpm dev");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
