import {
  siBetterauth,
  siExpo,
  siNextdotjs,
  siPnpm,
  siPostgresql,
  siPrisma,
  siReact,
  siReactquery,
  siTailwindcss,
  siTanstack,
  siTrpc,
  siTurborepo,
  siTypescript,
  siVite,
  siWails,
} from "simple-icons";

export const HERO_TITLE = "ဘိန်းစားမဟုတ်တဲ့";

// Split Myanmar text into syllables so vowel signs, medials and killed
// consonants stay attached to their base letter while animating.
export function syllables(text) {
  const chars = Array.from(text);
  return chars.reduce((out, char, i) => {
    const attach =
      out.length &&
      (/[ါ-ှ]/.test(char) ||
        chars[i + 1] === "်" ||
        chars[i - 1] === "္");
    if (attach) out[out.length - 1] += char;
    else out.push(char);
    return out;
  }, []);
}

export const stickers = [
  "100% ဘိန်း-free",
  "type-safe ✓",
  "sober since v1.0",
  "no black box",
  "made in Myanmar ✦",
];

export const stack = [
  {
    icons: [siTurborepo, siPnpm],
    name: "Turborepo + pnpm",
    role: { en: "Monorepo engine", my: "Monorepo engine" },
    blurb: {
      en: "Builds cached so hard your CPU gets the day off.",
      my: "Build တွေကို cache လုပ်ထားလို့ CPU တောင် အနားရတယ်။",
    },
  },
  {
    icons: [siNextdotjs],
    name: "Next.js",
    role: { en: "Web & API host", my: "Web နှင့် API host" },
    blurb: {
      en: "App Router for the web — or the whole API host. Your call.",
      my: "Web အတွက် App Router — API host တစ်ခုလုံးအဖြစ်လည်း သုံးနိုင်တယ်။",
    },
  },
  {
    icons: [siReact, siVite],
    name: "React + Vite",
    role: { en: "SPA web", my: "SPA web" },
    blurb: {
      en: "Instant HMR. Blink and it has already reloaded.",
      my: "HMR မြန်လွန်းလို့ မျက်တောင်ခတ်လိုက်တာနဲ့ reload ပြီးပြီ။",
    },
  },
  {
    icons: [siTanstack, siReactquery],
    name: "TanStack Router & Query",
    role: { en: "Routes & server state", my: "Routes နှင့် server state" },
    blurb: {
      en: "Typed routes, cached queries, loading states you never hand-write again.",
      my: "Type-safe route၊ cache ထားတဲ့ query၊ loading state တွေ လက်နဲ့ ထပ်မရေးရတော့ဘူး။",
    },
  },
  {
    icons: [siTrpc],
    name: "tRPC",
    role: { en: "Typed API", my: "Type-safe API" },
    blurb: {
      en: "End-to-end types. No codegen. No REST drama.",
      my: "အစအဆုံး type-safe။ Codegen မလို၊ REST ဒရာမာ မရှိ။",
    },
  },
  {
    icons: [siPrisma, siPostgresql],
    name: "Prisma + PostgreSQL",
    role: { en: "Database", my: "Database" },
    blurb: {
      en: "Schema-first models, migrations and a seed script. Your data, typed.",
      my: "Schema-first model၊ migration နဲ့ seed script။ Data ကိုယ်တိုင် type-safe။",
    },
  },
  {
    icons: [siBetterauth],
    name: "Better Auth",
    role: { en: "Authentication", my: "Authentication" },
    blurb: {
      en: "Email & password, roles and an admin plugin. Even on Expo.",
      my: "Email/password၊ role နဲ့ admin plugin။ Expo မှာပါ အလုပ်လုပ်တယ်။",
    },
  },
  {
    icons: [siExpo],
    name: "Expo",
    role: { en: "Mobile", my: "Mobile" },
    blurb: {
      en: "Native iOS and Android, talking to the very same API.",
      my: "iOS နဲ့ Android native app — API တစ်ခုတည်းကို သုံးတယ်။",
    },
  },
  {
    icons: [siWails],
    name: "Wails",
    role: { en: "Desktop", my: "Desktop" },
    blurb: {
      en: "Go-powered desktop apps with your web UI inside.",
      my: "Go နဲ့ run တဲ့ desktop app — web UI ကို အထဲမှာ ပြန်သုံးတယ်။",
    },
  },
  {
    icons: [siTypescript, siTailwindcss],
    name: "TypeScript + Tailwind",
    role: { en: "Everywhere", my: "နေရာတိုင်း" },
    blurb: {
      en: "Strict types and shared configs from database to button.",
      my: "Database ကနေ button အထိ strict type နဲ့ shared config။",
    },
  },
];

export const readyList = [
  "PRODUCTION READY",
  "TYPE-SAFE",
  "AUTH INCLUDED",
  "ADMIN DASHBOARD",
  "IMAGE UPLOADS",
  "SEED SCRIPT",
  "CURSOR RULES",
  "VPS FRIENDLY",
  "ZERO BLACK BOX",
];

export const features = [
  {
    id: "quick-start",
    visual: "terminal",
    title: {
      en: "One command. Whole monorepo.",
      my: "Command တစ်ကြောင်း၊ Monorepo တစ်ခုလုံး။",
    },
    body: {
      en: "Answer a few prompts, pick your platforms and backend. Ranger writes real source files — apps, packages, env and scripts — then gets out of your way.",
      my: "Prompt အနည်းငယ်ဖြေပြီး platform နဲ့ backend ကို ရွေးလိုက်ရုံပါပဲ။ Ranger က apps၊ packages၊ env နဲ့ scripts စတဲ့ source file အစစ်တွေကို ရေးပေးပြီး လမ်းဖယ်ပေးပါတယ်။",
    },
    link: { en: "Quick start", my: "အမြန် စတင်" },
  },
  {
    id: "architecture",
    visual: "types",
    title: {
      en: "Types from database to button.",
      my: "Database ကနေ Button အထိ Type-safe။",
    },
    body: {
      en: "Change a Prisma model and every tRPC procedure, React hook and Expo screen knows about it. Your editor catches the bug before your users do.",
      my: "Prisma model တစ်ခုပြောင်းလိုက်တာနဲ့ tRPC procedure၊ React hook၊ Expo screen အားလုံး သိပါတယ်။ User မတွေ့ခင် editor ကပဲ bug ကို ဖမ်းပေးပါတယ်။",
    },
    link: { en: "Architecture", my: "Architecture" },
  },
  {
    id: "backend-modes",
    visual: "platforms",
    title: {
      en: "Web, mobile, desktop. One backend.",
      my: "Web၊ Mobile၊ Desktop — Backend တစ်ခုတည်း။",
    },
    body: {
      en: "Next.js or React for web, Expo for mobile, Wails for desktop — all sharing one API, one auth and one database. Host it on Next.js or Express.",
      my: "Web အတွက် Next.js/React၊ mobile အတွက် Expo၊ desktop အတွက် Wails — အားလုံးက API၊ auth နဲ့ database တစ်ခုတည်းကို မျှသုံးပါတယ်။ Next.js ဒါမှမဟုတ် Express ပေါ်မှာ host လုပ်နိုင်ပါတယ်။",
    },
    link: { en: "Backend modes", my: "Backend modes" },
  },
  {
    id: "manage-apps",
    visual: "grow",
    title: {
      en: "Grow without starting over.",
      my: "အစကပြန်မစဘဲ ကြီးထွားပါ။",
    },
    body: {
      en: "Need a dashboard, a reader app or another API server? `ranger add` drops it into your workspace with ports, scripts and Turbo wiring already done.",
      my: "Dashboard၊ reader app ဒါမှမဟုတ် API server နောက်တစ်ခု လိုလား? `ranger add` က port၊ script နဲ့ Turbo wiring တွေ အကုန်လုပ်ပြီး workspace ထဲ ထည့်ပေးပါတယ်။",
    },
    link: { en: "Add & remove apps", my: "App ထည့်ခြင်း၊ ဖြုတ်ခြင်း" },
  },
  {
    id: "cursor-rules",
    visual: "rules",
    title: {
      en: "Conventions your AI actually follows.",
      my: "AI ကပါ လိုက်နာတဲ့ Conventions။",
    },
    body: {
      en: "Architecture rules ship in `.cursor/rules`, so every teammate — human or otherwise — keeps routes thin and shared logic in packages.",
      my: "Architecture rules တွေက `.cursor/rules` ထဲ ပါလာလို့ teammate တိုင်း — လူဖြစ်ဖြစ် AI ဖြစ်ဖြစ် — route တွေကို ပါးပါးထားပြီး shared logic ကို packages ထဲမှာ ထားကြပါတယ်။",
    },
    link: { en: "Cursor rules", my: "Cursor rules" },
  },
  {
    id: "vps-deployment",
    visual: "deploy",
    title: {
      en: "Ship it. Anywhere.",
      my: "ကြိုက်တဲ့နေရာမှာ Ship လုပ်ပါ။",
    },
    body: {
      en: "Run Next.js or Express API hosts as separate processes or containers behind a reverse proxy. Your VPS, your rules, zero lock-in.",
      my: "Next.js ဒါမှမဟုတ် Express API host တွေကို reverse proxy နောက်မှာ process/container သီးသန့်အဖြစ် run နိုင်ပါတယ်။ ကိုယ့် VPS၊ ကိုယ့်စည်းမျဉ်း၊ lock-in မရှိ။",
    },
    link: { en: "VPS & services", my: "VPS နှင့် services" },
  },
];

export const copy = {
  en: {
    nav: { docs: "Docs", reference: "Reference", start: "Get started" },
    sub: "The only thing it’s hooked on is type safety. One command scaffolds a full-stack monorepo — web, mobile, desktop, auth, API and database, already wired.",
    docs: "Read the docs",
    star: "Star on GitHub",
    scroll: "Scroll — it doesn’t bite",
    builtEyebrow: "BUILT WITH",
    statement:
      "Not a weekend toy. Ranger wires the exact stack production teams already trust — typed end to end, cached by Turbo, and ready to deploy from the very first commit.",
    stackHint: "Keep scrolling →",
    featuresEyebrow: "WHAT IT DOES",
    featuresTitle: "Everything you’d build in week one. Done in minute one.",
    featuresSub:
      "Scroll through what ships in the box. Every chapter opens the matching page in the docs.",
    read: "Read",
    shippedEyebrow: "PRODUCTS SHIPPED",
    shippedTitle: "Shipped with Ranger.",
    shippedSub: "Real products. Real users. Still 100% ဘိန်း-free.",
    next: "Your app, next?",
    ctaTitle: ["Stop wiring.", "Start shipping."],
    ctaSub: "The docs walk you from the first command to your first deploy.",
    openDocs: "Open the docs",
    footer: "Made with coffee, not ဘိန်း, by Rangorithm.",
  },
  my: {
    nav: { docs: "Docs", reference: "Reference", start: "စတင်မယ်" },
    sub: "သူစွဲလမ်းတာ type safety တစ်ခုတည်းပါ။ Command တစ်ကြောင်းနဲ့ web၊ mobile၊ desktop၊ auth၊ API နဲ့ database ကို ချိတ်ပြီးသား full-stack monorepo တစ်ခု ဆောက်ပေးပါတယ်။",
    docs: "Docs ဖတ်မယ်",
    star: "GitHub မှာ Star ပေးမယ်",
    scroll: "ဆွဲချကြည့်ပါ — မကိုက်ပါဘူး",
    builtEyebrow: "BUILT WITH",
    statement:
      "Weekend ကစားစရာ မဟုတ်ပါ။ Production team တွေ ယုံကြည်သုံးနေတဲ့ stack ကို Ranger က ကြိုချိတ်ပေးထားပါတယ် — အစအဆုံး type-safe၊ Turbo နဲ့ cache လုပ်ပြီး ပထမဆုံး commit ကတည်းက deploy လုပ်ဖို့ အသင့်ပါ။",
    stackHint: "ဆက်ဆွဲပါ →",
    featuresEyebrow: "WHAT IT DOES",
    featuresTitle: "ပထမအပတ်မှာ ဆောက်ရမယ့်အရာတွေ — ပထမမိနစ်မှာတင် ပြီးပြီ။",
    featuresSub:
      "Box ထဲမှာ ဘာတွေပါလဲ ဆွဲကြည့်ပါ။ အခန်းတိုင်းက docs ထဲက သက်ဆိုင်ရာ page ကို ဖွင့်ပေးပါတယ်။",
    read: "ဖတ်ရန်",
    shippedEyebrow: "PRODUCTS SHIPPED",
    shippedTitle: "Ranger နဲ့ Ship ပြီးသား။",
    shippedSub: "Product အစစ်၊ user အစစ်။ ဘိန်း လုံးဝ မပါ။",
    next: "နောက်တစ်ခုက သင့် app လား?",
    ctaTitle: ["Wiring ရပ်ပါ။", "Ship စလုပ်ပါ။"],
    ctaSub: "ပထမဆုံး command ကနေ ပထမဆုံး deploy အထိ docs က လမ်းပြပေးပါတယ်။",
    openDocs: "Docs ကိုဖွင့်မယ်",
    footer: "ဘိန်းနဲ့ မဟုတ်ဘဲ ကော်ဖီနဲ့ ဆောက်ထားပါတယ် — Rangorithm",
  },
};
