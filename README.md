# Ranger

[![npm version](https://img.shields.io/npm/v/create-ranger.svg)](https://www.npmjs.com/package/create-ranger)
[![node](https://img.shields.io/node/v/create-ranger.svg)](https://www.npmjs.com/package/create-ranger)

**Ranger** is a zero-dependency Node.js CLI that scaffolds production-ready monorepos for full-stack apps with web, mobile, auth, API, and database already wired together.

It is the official project generator for the Dahlai-style stack: a pnpm + Turbo workspace with shared tRPC, Better Auth, Prisma, Next.js, and Expo — generated as real source files you own, not a black-box framework.

**npm package:** [`create-ranger`](https://www.npmjs.com/package/create-ranger)

---

## Quick start

From an empty folder, run Ranger, set up the database, and start dev:

```bash
# 1. Generate a new project (interactive prompts)
npx create-ranger my-app

# 2. Install dependencies
cd my-app
pnpm install

# 3. Set auth secret in .env, then create the database
pnpm db:reset    # type "yes" when prompted
pnpm db:push
pnpm db:seed

# 4. Start all apps
pnpm dev
```

Open `http://localhost:3000` and sign in with the seeded admin:

```txt
Email:    superadmin@example.com
Password: root64@Admin
```

**One-liner (non-interactive, full stack + Express API):**

```bash
npx create-ranger my-app --yes --web --mobile --backend express
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
| Web (optional) | Next.js 15 App Router, shadcn-style black & white UI |
| Mobile (optional) | Expo Router, React Native `StyleSheet` only |
| Backend | **Next.js API routes** or **Express server** |
| Tooling | Shared TypeScript config, Prettier, Cursor rules |

### Built-in features

- Email/password auth with role-based access (`user`, `admin`, etc.)
- Public post feed + authenticated post creation with image upload
- Admin dashboard: users, posts, summary stats
- Seeded superadmin account ready for local development
- `.cursor/rules` for API, database, web, and mobile architecture

---

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | `>= 20` |
| pnpm | `9.x` (generated apps pin `pnpm@9.12.0`) |
| PostgreSQL | local instance with `psql` available |
| Expo Go / simulator | only if you enable the mobile app |

---

## Install Ranger

Ranger is published on npm as **`create-ranger`**. You do **not** need to clone this repo to use it.

### Option 1 — `npx` (recommended)

Downloads the latest version and runs it once. No global install.

```bash
npx create-ranger my-app
```

Pin a specific version:

```bash
npx create-ranger@1.0.0 my-app
```

### Option 2 — `npm create`

Same package, npm's create-app shorthand:

```bash
npm create ranger@latest my-app
```

Equivalent to `npx create-ranger@latest my-app`.

### Option 3 — `pnpm dlx`

```bash
pnpm dlx create-ranger my-app
```

### Option 4 — `yarn`

```bash
yarn create ranger my-app
```

### Option 5 — Global install

Install the CLI globally, then run `ranger` from anywhere:

```bash
npm install -g create-ranger

# any of these work after global install:
ranger my-app
create-ranger my-app
renger my-app          # typo-safe alias
```

### Option 6 — From source (contributors)

```bash
git clone https://github.com/rangorithm/ranger.git
cd ranger
node ./bin/ranger.js my-app
```

### Available commands

| Command | When to use |
| --- | --- |
| `npx create-ranger <name>` | **Most users** — no install, always latest |
| `npm create ranger <name>` | Same as above, npm shorthand |
| `pnpm dlx create-ranger <name>` | pnpm users |
| `ranger <name>` | After `npm install -g create-ranger` |
| `renger <name>` | Typo-safe alias (global install) |

### What gets created

```bash
npx create-ranger my-app
# → ./my-app/   (new folder in your current directory)
```

Ranger never modifies files outside the target folder.

---

## Interactive mode

Run Ranger without flags to walk through setup:

```bash
npx create-ranger
```

You will be asked:

1. **Project name** — becomes the folder name and `package.json` name (kebab-case)
2. **Include Expo mobile app?** — `Y/n`
3. **Include Next.js web/admin app?** — `Y/n`
4. **Backend server** — choose one:
   - `Next.js API routes + tRPC`
   - `Express server + tRPC`

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
| `--web` | Include the Next.js web/admin app |
| `--no-web` | Exclude the web app (Express backend only) |
| `--mobile` | Include the Expo mobile app |
| `--no-mobile` | Exclude the mobile app |
| `--backend next` | Use Next.js API routes for auth, tRPC, and uploads |
| `--backend express` | Use a standalone Express server on port `4000` |
| `--backend=express` | Same as `--backend express` |

### Examples

**Full stack with Express backend (recommended for web + mobile):**

```bash
npx create-ranger my-app --yes --web --mobile --backend express
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
| Mobile app | enabled |
| Backend | `next` |

> **Note:** Choosing `--backend next` always enables the web app, because Next.js hosts the API routes.

---

## Backend modes

Ranger supports two backend architectures. Pick the one that matches how you want to deploy.

### `next` — Next.js API routes

```
Browser / Mobile  →  Next.js (port 3000)
                       ├── /api/auth/*
                       ├── /api/trpc/*
                       └── /api/uploads
```

- Single origin for web and API
- `NEXT_PUBLIC_API_URL` is empty — clients use same-origin requests
- Best for: web-first apps, Vercel-style deployments, simpler local dev

### `express` — Standalone Express server

```
Web (3000)  ──→  Express API (4000)
Mobile      ──→       ├── /api/auth/*
                      ├── /api/trpc/*
                      └── /api/uploads
```

- Web and API run as separate processes
- `NEXT_PUBLIC_API_URL=http://localhost:4000` in `apps/web/.env`
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
│   ├── web/                 # Next.js admin + public app (if enabled)
│   ├── mobile/              # Expo app (if enabled)
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
├── .env                     # root env (reference)
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

Open `.env` and set a real auth secret:

```env
BETTER_AUTH_SECRET="use-a-long-random-string-at-least-32-chars"
```

Ranger also writes scoped env files where each runtime needs them:

| File | Used by |
| --- | --- |
| `packages/db/.env` | Prisma CLI |
| `apps/web/.env` | Next.js |
| `apps/server/.env` | Express (express backend only) |
| `apps/mobile/.env` | Expo |

### 2. Create the database

```bash
pnpm db:reset
```

Type `yes` when prompted. This script:

- reads your `package.json` name
- creates a matching PostgreSQL database (e.g. `my_app`)
- updates `DATABASE_URL` across all env files
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

### Default login

```
Email:    superadmin@example.com
Password: root64@Admin
```

Change these credentials before shipping to production.

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

Update `apps/mobile/.env` with your machine's LAN IP:

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
├── app/              # thin route files only
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
| `web-arch/web-arch.mdc` | Next.js module layout |
| `mobile-arch/mobile-arch.mdc` | Expo MVVM + StyleSheet-only UI |

These rules are loaded automatically in Cursor to keep generated code aligned with the scaffold's architecture.

---

## Database scripts

| Command | Description |
| --- | --- |
| `pnpm db:reset` | Drop & recreate local Postgres DB from project name |
| `pnpm db:push` | Push Prisma schema without migrations |
| `pnpm db:migrate` | Create & apply Prisma migrations |
| `pnpm db:seed` | Seed superadmin + welcome post |
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

The web app is calling Next.js instead of the API server. Check `apps/web/.env`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
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
- Physical device: use your Mac's LAN IP in `apps/mobile/.env`

---

## How Ranger works internally

Ranger is a single file: `bin/ranger.js`.

1. **Parse CLI args** — project name, flags, backend choice
2. **Prompt** (unless `--yes`) — interactive configuration
3. **Normalize** — derive `packageName`, `dbName`, ports, enabled apps
4. **Generate** — build a `files` map with ~100+ source files as template strings
5. **Write** — create the directory tree on disk
6. **Print next steps** — install, db setup, dev commands

There are no runtime dependencies. The generated app dependencies are installed separately via `pnpm install` inside the new project.

### Smoke test (maintainers)

```bash
pnpm run smoke
```

Generates a test project at `/private/tmp/ranger-smoke` with web, mobile, and Express backend.

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
