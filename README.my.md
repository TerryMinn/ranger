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
  <strong>Command တစ်ခုတည်းနဲ့ full-stack monorepo တစ်ခုလုံး generate လုပ်ပါ။</strong><br />
  Next.js · Expo · tRPC · Better Auth · Prisma · Turbo
</p>

<p align="center">
  <a href="./README.md">English</a> · <strong>မြန်မာ</strong>
</p>

**Ranger** သည် web၊ mobile၊ auth၊ API နဲ့ database ကို အဆင်သင့်ချိတ်ထားပေးထားတဲ့ production-ready monorepo တွေကို scaffold လုပ်ပေးတဲ့ zero-dependency Node.js CLI ဖြစ်ပါတယ်။

Dahlai-style stack အတွက် တရားဝင် project generator ဖြစ်ပြီး black-box framework မဟုတ်ဘဲ သင်ပိုင်ဆိုင်တဲ့ source files တွေကို generate လုပ်ပေးပါတယ်။

**npm:** [`create-ranger`](https://www.npmjs.com/package/create-ranger)

---

## အသုံးပြုနည်း

> **Ranger သည် project generator (CLI) ဖြစ်ပြီး `dependencies` ထဲ ထည့်သုံးတဲ့ library မဟုတ်ပါ။**

npm sidebar မှာ `npm i create-ranger` ပြနေပေမယ့် ဒါက **CLI tool ကိုသာ install** လုပ်တာပါ။ **project အသစ် generate** လုပ်ဖို့ အောက်ပါ command တွေကို သုံးပါ။

```bash
# ✅ အကြံပြု — တစ်ခါ run၊ install မလို
npx create-ranger my-app

# ✅ npm create shorthand (package တူ)
npm create ranger my-app

# ✅ global install လုပ်ပြီးရင်
npm install -g create-ranger
ranger my-app
```

| ✅ Project generate | ❌ မှားနည်း |
| --- | --- |
| `npx create-ranger my-app` | `npm i create-ranger` တစ်ခုတည်း (CLI သာ install၊ project မထွက်) |
| `npm create ranger my-app` | app ရဲ့ `package.json` ထဲ `create-ranger` ထည့်ခြင်း |
| `pnpm dlx create-ranger my-app` | `import {} from "create-ranger"` လို library import မျှော်ခြင်း |

---

## အမြန် စတင်

Folder အလွတ်တစ်ခုကနေ Ranger run ပြီး database setup လုပ်ကာ dev စတင်ပါ။

```bash
# 1. Project အသစ် generate (interactive prompts)
npx create-ranger my-app

# 2. Dependencies install
cd my-app
pnpm install

# 3. Secrets သတ်မှတ်၊ database ဖန်တီး၊ seed လုပ်
#    - .env ထဲ BETTER_AUTH_SECRET
#    - packages/db/.env ထဲ SEED_ADMIN_PASSWORD
pnpm db:reset    # prompt မှာ "yes" ရိုက်ပါ
pnpm db:push
pnpm db:seed

# 4. App အားလုံး စတင်
pnpm dev
```

`http://localhost:3000` ဖွင့်ပြီး `/login` မှာ sign up လုပ်ပါ သို့မဟုတ် `pnpm db:seed` နဲ့ ဖန်တီးထားတဲ့ admin account သုံးပါ။

**One-liner (non-interactive, full stack + Express API):**

```bash
npx create-ranger my-app --yes --web --mobile --backend express
```

---

## Ranger ဘာကြောင့် လိုအပ်လဲ

Full-stack monorepo စတင်တိုင်း အလုပ်တူတူ ထပ်ခါထပ်ခါ လုပ်ရတတ်ပါတယ်။

- web နဲ့ mobile မှာ auth ချိတ်ဆက်ခြင်း
- client နဲ့ server အကြား API type မျှဝေခြင်း
- backend ပုံစံ ရွေးချယ်ခြင်း (Next.js routes vs Express)
- Prisma၊ seed data၊ admin roles၊ env files မှန်ကန်စွာ ထားခြင်း
- team နဲ့ AI tools အတွက် architecture convention မှတ်တမ်းတင်ခြင်း

Ranger က command တစ်ခုတည်းနဲ့ အခြေခံ foundation ကို generate လုပ်ပေးလို့ product logic ပဲ အာရုံစိုက်နိုင်ပါတယ်။

---

## ရရှိမည့် အရာများ

Generate လုပ်ထားတဲ့ project တိုင်းမှာ ပါဝင်ပါတယ်။

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
- Database seed script for local admin user and sample post
- `.cursor/rules` for API, database, web, and mobile architecture

---

## လိုအပ်ချက်များ

| Tool | Version |
| --- | --- |
| Node.js | `>= 20` |
| pnpm | `9.x` (generated apps pin `pnpm@9.12.0`) |
| PostgreSQL | local instance with `psql` available |
| Expo Go / simulator | mobile app ဖွင့်မှသာ လို |

---

## Ranger install လုပ်နည်း

npm package name: **`create-ranger`**

Repo clone မလုပ်ရပါ။ အောက်ပါနည်းလမ်းတစ်ခု ရွေးပါ။

### 1. `npx` — အကြံပြု

Global install မလိုဘဲ latest version run ပါ။

```bash
npx create-ranger my-app
```

Version သတ်မှတ်ချင်ရင်:

```bash
npx create-ranger@1.0.7 my-app
```

### 2. `npm create`

```bash
npm create ranger my-app
```

`create-ranger` package ကို run လုပ်ပါတယ် (npm က `create-` prefix ဖယ်ပေးတယ်)။

### 3. `pnpm dlx`

```bash
pnpm dlx create-ranger my-app
```

### 4. `yarn create`

```bash
yarn create ranger my-app
```

### 5. Global CLI install

`ranger` command ကို နေရာတိုင်း သုံးချင်မှသာ:

```bash
npm install -g create-ranger

ranger my-app           # primary
create-ranger my-app    # same CLI
renger my-app           # typo-safe alias
```

> `npm i create-ranger` (`-g` မပါ) ဆိုရင် လက်ရှိ project ရဲ့ `node_modules` ထဲ CLI သာ install လုပ်တယ်။ အများအားဖြင့် `npx create-ranger` က ပိုသင့်တော်ပါတယ်။

### 6. Source ကနေ (contributors)

```bash
git clone https://github.com/rangorithm/ranger.git
cd ranger
node ./bin/ranger.js my-app
```

### Command cheat sheet

| ရည်ရွယ်ချက် | Command |
| --- | --- |
| Project generate (အကောင်းဆုံး) | `npx create-ranger <name>` |
| npm create ဖြင့် generate | `npm create ranger <name>` |
| pnpm ဖြင့် generate | `pnpm dlx create-ranger <name>` |
| yarn ဖြင့် generate | `yarn create ranger <name>` |
| Global CLI သုံး | `npm i -g create-ranger` ပြီးရင် `ranger <name>` |

### Output

```bash
npx create-ranger my-app
# creates → ./my-app/
```

Ranger က target folder အတွင်းမှာသာ ဖိုင်တွေ ရေးပါတယ်။

---

## Interactive mode

Flag မပါဘဲ run လုပ်ရင် setup ကို လမ်းညွှန်ပေးပါတယ်။

```bash
npx create-ranger
```

မေးမည့်အရာများ:

1. **Project name** — folder name နဲ့ `package.json` name (kebab-case)
2. **Include Expo mobile app?** — `Y/n`
3. **Include Next.js web/admin app?** — `Y/n`
4. **Backend server** — ရွေးချယ်ပါ:
   - `Next.js API routes + tRPC`
   - `Express server + tRPC`

Ranger က လက်ရှိ directory ရဲ့ `./<project-name>` ထဲ project ရေးပါတယ်။

---

## CLI reference

```bash
ranger <project-name> [options]
```

### Options

| Flag | ဖော်ပြချက် |
| --- | --- |
| `--yes`, `-y` | Prompt ကျော်ပြီး defaults သုံး |
| `--force`, `-f` | folder မဗလာ ဖြစ်နေရင် generated files overwrite |
| `--web` | Next.js web/admin app ထည့် |
| `--no-web` | Web app မထည့် (Express backend only) |
| `--mobile` | Expo mobile app ထည့် |
| `--no-mobile` | Mobile app မထည့် |
| `--backend next` | Next.js API routes သုံး |
| `--backend express` | Express server port `4000` |
| `--backend=express` | `--backend express` နဲ့ တူ |

### Examples

**Express backend နဲ့ full stack (web + mobile အတွက် အကြံပြု):**

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
| Project name | `my-ranger-app` (မပေးရင်) |
| Web app | enabled |
| Mobile app | enabled |
| Backend | `next` |

> **မှတ်ချက်:** `--backend next` ရွေးရင် web app ကို အမြဲ enable လုပ်ပါတယ် — Next.js က API routes ကို host လုပ်လို့ပါ။

---

## Backend modes

Ranger က backend architecture နှစ်မျိုး ပံ့ပိုးပါတယ်။ deploy ပုံစံနဲ့ ကိုက်ညီအောင် ရွေးပါ။

### `next` — Next.js API routes

```
Browser / Mobile  →  Next.js (port 3000)
                       ├── /api/auth/*
                       ├── /api/trpc/*
                       └── /api/uploads
```

- Web နဲ့ API အတွက် single origin
- `NEXT_PUBLIC_API_URL` ဗလာ — same-origin requests
- သင့်တော်သည်: web-first apps, Vercel-style deploy, local dev ရိုးရှင်း

### `express` — Standalone Express server

```
Web (3000)  ──→  Express API (4000)
Mobile      ──→       ├── /api/auth/*
                      ├── /api/trpc/*
                      └── /api/uploads
```

- Web နဲ့ API က process ခွဲထား
- `apps/web/.env` ထဲ `NEXT_PUBLIC_API_URL=http://localhost:4000`
- သင့်တော်သည်: mobile + web combo, custom server middleware, traditional API deploy

| | Next backend | Express backend |
| --- | --- | --- |
| API port | `3000` (web နဲ့ မျှသုံး) | `4000` |
| Web env | same-origin | `:4000` ကို ညွှန်း |
| `apps/server/` | မထွက် | ထွက် |
| Mobile API URL | `http://localhost:3000` | `http://localhost:4000` |

---

## Generate လုပ်ထားသော project structure

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

Ranger က project folder နာမည်ကနေ derive လုပ်ပါတယ်။

| Input folder | `package.json` name | Database name |
| --- | --- | --- |
| `MyApp` | `my-app` | `my_app` |
| `TestRanger` | `test-ranger` | `test_ranger` |

Database name သည် kebab-case package name ကို `snake_case` ပြောင်းထားတာပါ။

---

## ပထမဆုံး setup (generated app)

> အပြည့်အစုံ copy-paste flow အတွက် [အမြန် စတင်](#အမြန်-စတင်) ကို ကြည့်ပါ။ ဒီအပိုင်းက အဆင့်တိုင်းကို အသေးစိတ် ရှင်းပြထားပါတယ်။

Ranger က project ဖန်တီးပြီးရင်:

```bash
cd my-app
pnpm install
```

### 1. Secrets သတ်မှတ်ပါ

`.env` ဖွင့်ပြီး auth secret အစစ်ထည့်ပါ။

```env
BETTER_AUTH_SECRET="use-a-long-random-string-at-least-32-chars"
```

Ranger က runtime တစ်ခုချင်းစီအတွက် env files လည်း ရေးပေးပါတယ်။

| File | သုံးသူ |
| --- | --- |
| `packages/db/.env` | Prisma CLI |
| `apps/web/.env` | Next.js |
| `apps/server/.env` | Express (express backend only) |
| `apps/mobile/.env` | Expo |

### 2. Database ဖန်တီးပါ

```bash
pnpm db:reset
```

Prompt မှာ `yes` ရိုက်ပါ။ Script က:

- `package.json` name ဖတ်ပါတယ်
- ကိုက်ညီ PostgreSQL database ဖန်တီးပါတယ် (ဥပမာ `my_app`)
- env files အားလုံးမှာ `DATABASE_URL` update လုပ်ပါတယ်
- `packages/db/.env` ကို root `.env` နဲ့ link လုပ်ပါတယ်

### 3. Schema push & seed

```bash
pnpm db:push
pnpm db:seed
```

### 4. Development စတင်ပါ

```bash
pnpm dev
```

| Script | လုပ်ဆောင်ချက် |
| --- | --- |
| `pnpm dev` | Turbo TUI — app အားလုံး |
| `pnpm dev:stream` | App တူ၊ log ရိုးရှင်း |
| `pnpm dev:web` | Web/admin သာ |
| `pnpm dev:mobile` | Expo သာ |
| `pnpm dev:server` | Express API သာ |

### Sign in

`pnpm db:seed` ပြီးရင် web app မှာ `/login` ဖွင့်ပါ။ Seeded admin user နဲ့ login လုပ်နိုင်သလို sign-up နဲ့ account အသစ်လည်း ဖန်တီးနိုင်ပါတယ်။

Production မတိုင်ခင် `packages/db/prisma/seed.mjs` ထဲ seed credentials ကို update လုပ်ပါ သို့မဟုတ် ဖယ်ပါ။

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

`apps/mobile/.env` ထဲ machine ရဲ့ LAN IP ထည့်ပါ။

```env
EXPO_PUBLIC_API_URL="http://192.168.1.10:4000"
```

Android emulator မှာ generated mobile code က `10.0.2.2` ကို auto-fallback လုပ်ပါတယ်။

---

## Architecture conventions

Ranger က opinionated structure ထားပေးလို့ team (နဲ့ AI assistants) တူညီစွာ ဆက်လုပ်နိုင်ပါတယ်။

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

- `publicProcedure` — auth မလို
- `protectedProcedure` — login လုပ်ထားရမည်
- `adminProcedure` — staff/admin role လို

Routers: `post`, `user`, `admin`

### Database (`packages/db`)

Prisma models:

- `User`, `Session`, `Account`, `Verification` — Better Auth
- `Post` — title, content, image, published flag, author relation

---

## Cursor rules

Project တိုင်းမှာ `.cursor/rules/` ပါဝင်ပါတယ်။

| Rule file | အကြောင်းအရာ |
| --- | --- |
| `api/api.mdc` | tRPC procedure auth levels, Zod validation, error handling |
| `database/database-rule.mdc` | Prisma schema conventions |
| `web-arch/web-arch.mdc` | Next.js module layout |
| `mobile-arch/mobile-arch.mdc` | Expo MVVM + StyleSheet-only UI |

Cursor မှာ အလိုအလျောက် load ဖြစ်ပြီး generated code က scaffold architecture နဲ့ ကိုက်ညီအောင် ထိန်းပေးပါတယ်။

---

## Database scripts

| Command | ဖော်ပြချက် |
| --- | --- |
| `pnpm db:reset` | Project name အလိုက် local Postgres DB drop & recreate |
| `pnpm db:push` | Migration မသုံး schema push |
| `pnpm db:migrate` | Prisma migrations ဖန်တီး & apply |
| `pnpm db:seed` | Admin user + welcome post seed |
| `pnpm db:studio` | Prisma Studio ဖွင့် |
| `pnpm db:generate` | Prisma Client regenerate |

---

## ပြဿနာဖြေရှင်းခြင်း

### `Environment variable not found: DATABASE_URL`

Prisma က `packages/db/` ကနေ run လုပ်ပါတယ်။ `packages/db/.env` ရှိမရှိ စစ်ပါ။

ဖြေရှင်းနည်း:

```bash
pnpm db:reset   # DB ပြန်ဖန်တီး + env link
# or manually:
ln -sf ../../.env packages/db/.env
```

### Web မှာ `post.getAll` / `user.me` errors (Express backend)

Web app က Next.js ကို ခေါ်နေပြီး API server ကို မခေါ်တာ ဖြစ်နိုင်ပါတယ်။ `apps/web/.env` စစ်ပါ။

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

ပြီးရင် restart:

```bash
pnpm dev
```

Express server run နေရဲ့လား စစ်ပါ — ဒီစာသား ပေါ်ရမည်:

```
API server running on http://localhost:4000
```

### `Target directory is not empty`

Folder ထဲမှာ ဖိုင်ရှိနေရင် `--force` မပါဘဲ Ranger က မရေးပါ။

```bash
npx create-ranger my-app --yes --web --mobile --backend express --force
```

### `psql: command not found`

PostgreSQL client tools install လုပ်ပါ။ macOS + Homebrew:

```bash
brew install postgresql@17
```

### Mobile က API ဆီ မရောက်

- iOS Simulator: `http://127.0.0.1:4000` or `http://localhost:4000`
- Android Emulator: code က `10.0.2.2` auto သုံး
- Physical device: `apps/mobile/.env` ထဲ Mac ရဲ့ LAN IP သုံး

### Mobile မှာ auth အောင်ပေမယ့် post မတင်ရ

Expo + Better Auth မှာ session cookie ကို manual ပို့တဲ့အခါ React Native fetch က native cookie handling နဲ့ ရောနိုင်ပါတယ်။ Generated project မှာ `credentials: "omit"` ပါပြီးသား ဖြစ်သင့်ပါတယ်။ Mobile app reload လုပ်ပြီး server restart လုပ်ကြည့်ပါ။

---

## Ranger အတွင်းပိုင်း လုပ်ဆောင်ပုံ

Ranger သည် file တစ်ခုတည်း: `bin/ranger.js`။

1. **CLI args parse** — project name, flags, backend choice
2. **Prompt** (`--yes` မပါရင်) — interactive configuration
3. **Normalize** — `packageName`, `dbName`, ports, enabled apps derive
4. **Generate** — template strings နဲ့ source files ~100+ `files` map တည်ဆောက်
5. **Write** — directory tree ရေးသား
6. **Print next steps** — install, db setup, dev commands

Runtime dependencies မရှိပါ။ Generated app dependencies ကို project အသစ်ထဲ `pnpm install` နဲ့ သီးသန့် install လုပ်ရပါမယ်။

### Smoke test (maintainers)

```bash
pnpm run smoke
```

`/private/tmp/ranger-smoke` မှာ web, mobile, Express backend နဲ့ test project generate လုပ်ပါတယ်။

---

## Ranger မဟုတ်တဲ့ အရာများ

- **Framework မဟုတ်** — သင်ပိုင်ဆိုင်ပြီး ပြင်ဆင်နိုင်တဲ့ starting repo generate လုပ်ပေးတာ
- **Deployment tool မဟုတ်** — Vercel/Fly/Railway config မထွက်
- **Design system package မဟုတ်** — web UI က lightweight shadcn-style primitives သာ
- **Migration-aware default မဟုတ်** — default က `db:push`； versioned migrations လိုရင် `db:migrate` သုံး

---

## Roadmap ideas

- Backend targets ထပ်ထည့် (Hono, Fastify)
- Auth scaffold မှာ OAuth providers optional
- Local Postgres အတွက် Docker Compose
- Template variants (e-commerce, SaaS dashboard, etc.)

Contributions နဲ့ feature requests ကြိုဆိုပါတယ်။

---

## License

MIT — repository ထဲ `LICENSE` ကို ကြည့်ပါ။

---

<p align="center">
  <strong>Built by <a href="https://github.com/rangorithm">Rangorithm</a></strong><br>
  Generate once. Ship features.
</p>
