<p align="center">
  <img src="./ranger.png" alt="Ranger" width="360" />
</p>

<h1 align="center">Ranger</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/create-ranger"><img src="https://img.shields.io/npm/v/create-ranger.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/create-ranger"><img src="https://img.shields.io/node/v/create-ranger.svg" alt="node version" /></a>
  <a href="https://github.com/rangorithm/ranger/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/create-ranger.svg" alt="license" /></a>
</p>

<p align="center">
  <strong>Generate a full-stack monorepo in one command.</strong><br />
  Next.js or React + Vite · Expo · Wails · tRPC · Better Auth · Prisma · Turbo
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.my.md">မြန်မာ</a>
</p>

**Ranger** is a zero-dependency Node.js CLI that scaffolds production-ready monorepos for full-stack apps with web, mobile, auth, API, and database already wired together.

It is the official project generator for the Dahlai-style stack — real source files you own, not a black-box framework.

**npm:** [`create-ranger`](https://www.npmjs.com/package/create-ranger)

---

## Usage

> **Ranger is a project generator (CLI), not a library you add to `dependencies`.**

The npm sidebar shows `npm i create-ranger` — that only **installs the CLI tool**. To **generate a new project**, use one of these:

```bash
# ✅ recommended — run once, no install
npx create-ranger my-app

# ✅ npm create shorthand (same package)
npm create ranger my-app

# ✅ after global install
npm install -g create-ranger
ranger my-app
```

| ✅ Generate a project | ❌ Wrong |
| --- | --- |
| `npx create-ranger my-app` | `npm i create-ranger` alone (installs CLI only, creates nothing) |
| `npm create ranger my-app` | Adding `create-ranger` to your app's `package.json` |
| `pnpm dlx create-ranger my-app` | Expecting a library import like `import {} from "create-ranger"` |

---

## Add or remove apps

Run these commands from an existing Ranger workspace (or any folder inside it). New apps go into `apps/<name>`, using the existing blog/auth templates and shared API packages.

```bash
ranger add             # ask mobile, web, or desktop, then ask the name
ranger add -m          # ask the name; add an Expo blog app
ranger add -w          # ask the name; add a web app
ranger add -d          # ask the name; add a Wails desktop app

# Names can also be supplied directly
ranger add -m reader
ranger add -w dashboard --frontend react
ranger add -d office

ranger remove          # checkbox list of existing app folder names
ranger remove -reader
ranger remove -dashboard -office
```

In the removal list, use **↑/↓** to move, **Space** to select multiple apps, **Enter** to delete the selected app folders, and **Esc** to cancel. Direct removal deletes the named app folders without another prompt, including local changes inside them.

App names use lowercase letters, numbers, and hyphens. Existing folders and package names are never overwritten. Web apps default to the existing web framework; `--frontend next` and `--frontend react` override it. Added apps receive separate development ports and a `pnpm dev:<name>` command, and join the root Turbo dev commands automatically. Expo apps reuse the workspace's auth scheme.

Wails retains the existing scaffold's requirements: an **Express backend**, an existing web app whose UI it reuses, Go, and the Wails v2 CLI. A Next.js API workspace needs to migrate to Express before adding Wails. Dependent apps must be removed together; Ranger stops removal of an API host or shared web UI while other apps still use it.

Removal also cleans root scripts, package-specific Turbo tasks and task dependencies, explicit workspace paths, and pnpm lockfile importers. Shared packages stay in place. Run `pnpm install` after adding or removing apps to install dependencies and refresh the lockfile.

Added web apps proxy `/api` and `/uploads` to the existing API host. React/Vite deployments need equivalent reverse-proxy routes, or an explicit `VITE_API_URL` in the added app's `.env.local` with appropriate backend CORS configuration.

## Quick start

From an empty folder, run Ranger, set up the database, and start dev:

```bash
# 1. Generate a new project (interactive prompts)
npx create-ranger my-app

# 2. Install dependencies
cd my-app
pnpm install

# 3. Set secrets, create the database, then seed
#    - BETTER_AUTH_SECRET in .env
#    - SEED_ADMIN_PASSWORD in the root .env
pnpm db:reset    # type "yes" when prompted
pnpm db:push
pnpm db:seed

# 4. Start all apps
pnpm dev
```

Open `http://localhost:3000`, then sign up at `/login` or use the admin account created by `pnpm db:seed` in your generated project.

**One-liner (non-interactive, full stack + Express API + desktop):**

```bash
npx create-ranger my-app --yes --web --mobile --desktop --backend express
```

---

## Why Ranger exists

Starting a full-stack monorepo usually means repeating the same work:

- wiring auth across web and mobile
- sharing API types between clients and server
- choosing a backend shape (Next.js routes vs Express)
- setting up Prisma, seed data, admin roles, and env files in the right places
- documenting architecture conventions for your team and AI tools

Ranger generates that foundation in one command so you can focus on product logic instead of boilerplate.

---

## What you get

Every generated project includes:

| Layer | Technology |
| --- | --- |
| Workspace | pnpm workspaces + Turbo |
| API | Shared `@repo/api` package with tRPC routers |
| Auth | Better Auth with Prisma adapter, admin plugin, Expo support |
| Database | Prisma + PostgreSQL (Better Auth models + `Post` model) |
| Web (optional) | Next.js App Router **or** React + Vite + TanStack Router |
| Mobile (optional) | Expo Router, React Native `StyleSheet` only |
| Desktop (optional) | Wails v2 app reusing framework-neutral web features via Vite |
| Backend | **Next.js server + tRPC** or **Express server + tRPC** |
| Tooling | Shared TypeScript config, Prettier, Cursor rules |

### Built-in features

- Email/password auth with role-based access (`user`, `admin`, etc.)
- Public post feed + authenticated post creation with image upload
- Admin dashboard: users, posts, summary stats
- Database seed script for local admin user and sample post
- `.cursor/rules` for API, database, web, and mobile architecture

---

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | `>= 20` |
| pnpm | `9.x` (generated apps pin `pnpm@9.12.0`) |
| PostgreSQL | local instance with `psql` available |
| Expo Go / simulator | only if you enable the mobile app |
| Go + Wails CLI v2 | only if you enable the desktop app (`go 1.23+`) |

---

## Install Ranger

Package name on npm: **`create-ranger`**

You do **not** need to clone this repo. Pick one method below.

### 1. `npx` — recommended

Run the latest version without installing anything globally:

```bash
npx create-ranger my-app
```

Pin a version:

```bash
npx create-ranger@1.2.0 my-app
```

### 2. `npm create`

```bash
npm create ranger my-app
```

This runs the `create-ranger` package (npm strips the `create-` prefix).

### 3. `pnpm dlx`

```bash
pnpm dlx create-ranger my-app
```

### 4. `yarn create`

```bash
yarn create ranger my-app
```

### 5. Global CLI install

Only if you want the `ranger` command available everywhere:

```bash
npm install -g create-ranger

ranger my-app           # primary
create-ranger my-app    # same CLI
renger my-app           # typo-safe alias
```

> `npm i create-ranger` (without `-g`) installs the CLI into the current project's `node_modules`. That is rarely what you want — prefer `npx create-ranger` instead.

### 6. From source (contributors)

```bash
git clone https://github.com/rangorithm/ranger.git
cd ranger
node ./bin/ranger.js my-app
```

To use the local source as a global command without publishing it to npm:

```bash
npm link
create-ranger my-app
```

`npm link` creates a global symlink, so later changes in this repository are reflected immediately. Remove it with `npm unlink -g create-ranger`.

### Command cheat sheet

| Goal | Command |
| --- | --- |
| Generate project (best) | `npx create-ranger <name>` |
| Generate via npm create | `npm create ranger <name>` |
| Generate via pnpm | `pnpm dlx create-ranger <name>` |
| Generate via yarn | `yarn create ranger <name>` |
| Use global CLI | `ranger <name>` after `npm i -g create-ranger` |

### Output

```bash
npx create-ranger my-app
# creates → ./my-app/
```

Ranger only writes inside the target folder.

---

## Interactive mode

Run Ranger without flags to walk through setup:

```bash
npx create-ranger
```

You will be asked:

1. **Project name** — becomes the folder name and `package.json` name (kebab-case)
2. **Include Expo mobile app?** — `Y/n`
3. **Include web/admin app?** — `Y/n`
4. **Web frontend** — choose `Next.js App Router` or `React + Vite + TanStack Router`
5. **Include Wails desktop app?** — `y/N`
6. **Backend server**:
   - With Next.js, choose `Next.js server + tRPC` or `Express server + tRPC`.
   - With React + Vite, Ranger automatically creates `Express server + tRPC` and connects the frontend to it.
   - Wails desktop also requires the Express + tRPC server.

Ranger writes the project into `./<project-name>` relative to your current directory.

---

## CLI reference

```bash
ranger <project-name> [options]
```

### Options

| Flag | Description |
| --- | --- |
| `--yes`, `-y` | Skip prompts; use defaults |
| `--force`, `-f` | Overwrite generated files in a non-empty target directory |
| `--web` | Include the web/admin app |
| `--no-web` | Exclude the web app (Express backend only) |
| `--mobile` | Include the Expo mobile app |
| `--no-mobile` | Exclude the mobile app |
| `--desktop` | Include the Wails desktop app |
| `--no-desktop` | Exclude the desktop app |
| `--frontend next\|react` | Select the web frontend |
| `--next`, `--nextjs` | Select Next.js and enable web |
| `--react` | Select React + Vite + TanStack Router and enable web |
| `--backend next` | Use the Next.js server for auth, tRPC, and uploads |
| `--backend express` | Use the Express + tRPC server on port `4000` |
| `--backend=express` | Same as `--backend express` |

### Examples

**Full stack with Express backend (recommended for web + mobile + desktop):**

```bash
npx create-ranger my-app --yes --web --mobile --desktop --backend express
```

**React + Vite + TanStack Router (Express + tRPC is automatic):**

```bash
npx create-ranger my-app --yes --react --mobile
```

**Web + desktop with Express API:**

```bash
npx create-ranger my-app --yes --web --no-mobile --desktop --backend express
```

**Web-only with Next.js API routes:**

```bash
npx create-ranger my-app --yes --web --no-mobile --backend next
```

**Mobile-only with Express API:**

```bash
npx create-ranger my-app --yes --no-web --mobile --backend express
```

**CI / automation with forced overwrite:**

```bash
npx create-ranger my-app --yes --web --mobile --backend express --force
```

### Defaults with `--yes`

| Setting | Default |
| --- | --- |
| Project name | `my-ranger-app` (if not provided) |
| Web app | enabled |
| Web frontend | Next.js App Router |
| Mobile app | enabled |
| Desktop app | disabled |
| Backend | `next`; automatically `express` with React, desktop, or `--no-web` |

> **Note:** Choosing `--backend next` always enables the web app, because Next.js hosts the API routes.

> **Note:** The desktop app requires the web app and an Express backend. It reuses `apps/web` through Vite aliases and calls the API via `VITE_API_URL`.

> **Note:** React + Vite always uses the Express backend. Next.js can use Next.js route handlers or Express.

---

## Backend modes

Ranger supports two backend architectures. Pick the one that matches how you want to deploy.

### `next` — Next.js server + tRPC

```
Browser / Mobile  →  Next.js (port 3000)
                       ├── /api/auth/*
                       ├── /api/trpc/*
                       └── /api/uploads
```

- Single origin for web and API
- `NEXT_PUBLIC_API_URL` is empty — clients use same-origin requests
- Best for: web-first apps, Vercel-style deployments, simpler local dev

### `express` — Express server + tRPC

```
Web (3000)  ──→  Express API (4000)
Mobile      ──→       ├── /api/auth/*
                      ├── /api/trpc/*
                      └── /api/uploads
```

- Web and API run as separate processes
- `NEXT_PUBLIC_API_URL=http://localhost:4000` (Next) or `VITE_API_URL=http://localhost:4000` (React) in the root `.env`
- Best for: mobile + web combos, custom server middleware, traditional API deployment

| | Next backend | Express backend |
| --- | --- | --- |
| API port | `3000` (shared with web) | `4000` |
| Web env | same-origin | points to `:4000` |
| `apps/server/` | not generated | generated |
| Mobile API URL | `http://localhost:3000` | `http://localhost:4000` |

---

## Generated project structure

```
my-app/
├── apps/
│   ├── web/                 # Next.js or React/Vite admin + public app
│   ├── mobile/              # Expo app (if enabled)
│   ├── desktop/             # Wails desktop app (if enabled)
│   └── server/              # Express API (express backend only)
├── packages/
│   ├── api/                 # tRPC routers: post, user, admin
│   ├── auth/                # Better Auth config + session helpers
│   └── db/                  # Prisma schema, client, seed script
├── tooling/
│   └── typescript-config/   # shared tsconfig presets
├── scripts/
│   └── reset-database.sh    # creates local Postgres DB from project name
├── .cursor/rules/           # architecture rules for Cursor AI
├── .env                     # single local environment source of truth
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Package naming

Ranger derives names from your project folder:

| Input folder | `package.json` name | Database name |
| --- | --- | --- |
| `MyApp` | `my-app` | `my_app` |
| `TestRanger` | `test-ranger` | `test_ranger` |

The database name is the kebab-case package name converted to `snake_case`.

---

## First-time setup (generated app)

> See [Quick start](#quick-start) for the full copy-paste flow. This section explains each step in detail.

After Ranger creates your project:

```bash
cd my-app
pnpm install
```

### 1. Configure secrets

Open the generated root `.env` and set the auth and seed secrets. Root `.env` is the single local environment source of truth:

```env
BETTER_AUTH_SECRET="use-a-long-random-string-at-least-32-chars"
SEED_ADMIN_PASSWORD="use-a-strong-local-password"
```

Scoped `.env.example` files document runtime-specific variables. Root scripts load the root `.env` into every app:

| File | Used by |
| --- | --- |
| `packages/db/.env.example` | Prisma CLI reference |
| `apps/web/.env.example` | Next.js or Vite client variables |
| `apps/server/.env.example` | Express reference |
| `apps/mobile/.env.example` | Expo reference |
| `apps/desktop/frontend/.env.example` | Wails desktop reference |

### 2. Create the database

```bash
pnpm db:reset
```

Type `yes` when prompted. This script:

- reads your `package.json` name
- creates a matching PostgreSQL database (e.g. `my_app`)
- updates `DATABASE_URL` in the root `.env`
- links `packages/db/.env` to the root `.env`

### 3. Push schema & seed data

```bash
pnpm db:push
pnpm db:seed
```

### 4. Start development

```bash
pnpm dev
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Turbo TUI — all selected apps |
| `pnpm dev:stream` | Same apps, plain log output |
| `pnpm dev:web` | Web/admin only |
| `pnpm dev:mobile` | Expo only |
| `pnpm dev:server` | Express API only |
| `pnpm desktop:setup` | Check/install Go and Wails CLI for desktop |
| `pnpm dev:desktop` | Wails desktop only |
| `pnpm dev:desktop:all` | Express API + Wails desktop |

### Sign in

After `pnpm db:seed`, open `/login` in the web app. You can sign in with the seeded admin user or create a new account via sign-up.

Update or remove the seed credentials in `packages/db/prisma/seed.mjs` before shipping to production.

---

## Environment variables

### Root `.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/my_app?schema=public"
BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
BETTER_AUTH_URL="http://localhost:4000"      # or :3000 for next backend
CORS_ORIGIN="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:4000"  # empty for next backend
EXPO_PUBLIC_API_URL="http://127.0.0.1:4000"
EXPO_PUBLIC_API_PORT="4000"
```

### Express backend ports

| Service | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000` |

### Next backend ports

| Service | URL |
| --- | --- |
| Web + API | `http://localhost:3000` |

### Physical device testing (Expo)

Update `EXPO_PUBLIC_API_URL` in the root `.env` with your machine's LAN IP:

```env
EXPO_PUBLIC_API_URL="http://192.168.1.10:4000"
```

Android emulators auto-fallback to `10.0.2.2` in the generated mobile code.

---

## Architecture conventions

Ranger encodes opinionated structure so teams (and AI assistants) stay consistent.

### Web (`apps/web`)

```
src/
├── app/ or router.tsx # thin Next.js or TanStack route definitions
├── modules/
│   ├── posts/        # public feature
│   ├── auth/         # login/signup
│   └── admin/        # admin-only features
├── components/ui/    # shared primitives
└── trpc/             # client setup
```

### Mobile (`apps/mobile`)

```
app/                  # Expo Router screens (thin)
src/features/         # MVVM-style feature modules
  └── posts/
      ├── components/
      └── hooks/      # tRPC calls, navigation, uploads
```

### Desktop (`apps/desktop`)

```
frontend/src/         # Vite shell, auth storage, navigation adapter
apps/web/src/         # reused UI modules via Vite aliases
```

- Wails v2 wraps a Vite + React Router frontend
- Reuses framework-neutral web modules from `apps/web/src` (posts, auth, admin)
- Persists Better Auth session data through Go bindings
- Talks to the Express API at `VITE_API_URL` (default `http://localhost:4000`)

Run `pnpm desktop:setup` to check for Go/Wails and install them when possible (also runs automatically right after project generation when desktop is enabled).

Local desktop dev:

```bash
pnpm dev:desktop:all   # API + desktop window
# or separately:
pnpm dev:server
pnpm dev:desktop
```

Build a distributable app:

```bash
pnpm --filter @repo/desktop build
```

### API (`packages/api`)

- `publicProcedure` — no auth required
- `protectedProcedure` — signed-in user required
- `adminProcedure` — staff/admin role required

Routers: `post`, `user`, `admin`

### Database (`packages/db`)

Prisma models:

- `User`, `Session`, `Account`, `Verification` — Better Auth
- `Post` — title, content, image, published flag, author relation

---

## Cursor rules

Every project ships `.cursor/rules/`:

| Rule file | Covers |
| --- | --- |
| `api/api.mdc` | tRPC procedure auth levels, Zod validation, error handling |
| `database/database-rule.mdc` | Prisma schema conventions |
| `web-arch/nextjs.mdc` | Next.js module and desktop-compatibility rules |
| `web-arch/react-vite.mdc` | React/Vite, TanStack Router, Query, and MVVM rules |
| `mobile-arch/mobile-arch.mdc` | Expo MVVM + StyleSheet-only UI |
| `server-arch/server-arch.mdc` | Express transport and production bundle boundaries |
| `desktop-arch/desktop-arch.mdc` | Wails/web reuse and authentication constraints |

These rules are loaded automatically in Cursor to keep generated code aligned with the scaffold's architecture.

---

## Database scripts

| Command | Description |
| --- | --- |
| `pnpm db:reset` | Drop & recreate local Postgres DB from project name |
| `pnpm db:push` | Push Prisma schema without migrations |
| `pnpm db:migrate` | Create & apply Prisma migrations |
| `pnpm db:seed` | Seed admin user + welcome post |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:generate` | Regenerate Prisma Client |

---

## Troubleshooting

### `Environment variable not found: DATABASE_URL`

Prisma runs from `packages/db/`. Make sure `packages/db/.env` exists.

Fix:

```bash
pnpm db:reset   # recreates DB and links env files
# or manually:
ln -sf ../../.env packages/db/.env
```

### Web shows `post.getAll` / `user.me` errors (Express backend)

The web app is calling the wrong origin instead of the Express API. Check the root `.env`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
VITE_API_URL="http://localhost:4000"
```

Then restart:

```bash
pnpm dev
```

Also confirm the Express server is running — you should see:

```
API server running on http://localhost:4000
```

### `Target directory is not empty`

Ranger refuses to write into populated folders unless you pass `--force`:

```bash
npx create-ranger my-app --yes --web --mobile --backend express --force
```

### `psql: command not found`

Install PostgreSQL client tools. On macOS with Homebrew:

```bash
brew install postgresql@17
```

### Mobile cannot reach API

- iOS Simulator: use `http://127.0.0.1:4000` or `http://localhost:4000`
- Android Emulator: code auto-uses `10.0.2.2`
- Physical device: use your Mac's LAN IP for `EXPO_PUBLIC_API_URL` in the root `.env`

---

## How Ranger works internally

Ranger is a single file: `bin/ranger.js`.

1. **Parse CLI args** — project name, flags, backend choice
2. **Prompt** (unless `--yes`) — interactive configuration
3. **Normalize** — derive `packageName`, `dbName`, ports, enabled apps
4. **Generate** — build a `files` map with inline template strings for web, mobile, desktop, packages, and server
5. **Write** — create the directory tree on disk (text + embedded binary assets for Wails icons/fonts)
6. **Print next steps** — install, db setup, dev commands

There are no runtime dependencies. The generated app dependencies are installed separately via `pnpm install` inside the new project.

The Wails desktop app lives in `addDesktopApp()` inside `bin/ranger.js`, same pattern as `addWebApp()` and `addMobileApp()`. To refresh the embedded desktop template from an explicitly selected source directory:

```bash
pnpm run generate:desktop-app -- /absolute/path/to/apps/desktop
```

### Smoke test (maintainers)

```bash
pnpm run smoke             # fast static generation matrix
pnpm run verify:generated  # install, typecheck, and build every variant
```

The matrix covers Next.js with either Next or Express/tRPC servers, React/Vite with its automatic Express/tRPC server, React/Vite + Wails, and Next.js + Wails projects.

### Publish to npm (maintainers)

`create-ranger` is an unscoped public package. Every release must use a version that has not already been published.

```bash
cd /path/to/ranger

# Sign in and confirm the npm account
npm login
npm whoami

# Compare the registry version with package.json
npm view create-ranger version
npm pkg get version
```

If `package.json` still needs a version bump, choose the appropriate SemVer change. Skip this step when it already contains the intended new version.

```bash
npm version patch --no-git-tag-version  # bug fixes
npm version minor --no-git-tag-version  # backward-compatible features
npm version major --no-git-tag-version  # breaking changes
```

Run the release checks and inspect exactly what npm will include:

```bash
pnpm test
pnpm verify:generated
npm pack --dry-run
npm publish --dry-run
```

Publish only after those commands pass and the package contents look correct:

```bash
npm publish
npm view create-ranger version
```

Publishing requires npm account 2FA or a suitable granular access token. When using interactive 2FA, `npm publish` prompts for the one-time password. The `prepublishOnly` script runs `pnpm test` again automatically before upload.

If npm reports `EPERM` because the default cache contains root-owned files, fix that cache's ownership or temporarily use a writable cache:

```bash
npm --cache /tmp/create-ranger-npm-cache login
npm --cache /tmp/create-ranger-npm-cache publish --dry-run
npm --cache /tmp/create-ranger-npm-cache publish
```

---

## What Ranger is not

- **Not a framework** — it generates a starting repo you fully own and modify
- **Not a deployment tool** — no Vercel/Fly/Railway config is generated
- **Not a design system package** — web UI uses lightweight shadcn-style primitives, not a published component library
- **Not migration-aware by default** — `db:push` is the default; use `db:migrate` when you need versioned migrations

---

## Roadmap ideas

- Additional backend targets (Hono, Fastify)
- Optional OAuth providers in the auth scaffold
- Docker Compose for local Postgres
- Template variants (e-commerce, SaaS dashboard, etc.)

Contributions and feature requests are welcome.

---

## License

MIT — see `LICENSE` in the repository.

---

<p align="center">
  <strong>Built by <a href="https://github.com/rangorithm">Rangorithm</a></strong><br>
  Generate once. Ship features.
</p>

## Documentation website

The React documentation site lives in [`docs/`](./docs/README.md). It uses the Ranger logo, supports English/Myanmar, and includes local search and light/dark themes.

```bash
pnpm --dir docs install
pnpm docs:dev
# Production output: docs/dist
pnpm docs:build
```
