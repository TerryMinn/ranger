import english from "../../README.md?raw";
import burmese from "../../README.my.md?raw";
import manifest from "../../package.json";

export const version = manifest.version;
export const repository = "https://github.com/rangorithm/ranger";

// Only split real Markdown headings, never comments inside fenced examples.
export function sections(source) {
  const result = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    if (!fenced && line.startsWith("## "))
      result.push({ title: line.slice(3), lines: [] });
    else if (result.length) result.at(-1).lines.push(line);
  }
  return result.map(({ title, lines }) => ({
    title,
    body: lines
      .join("\n")
      .replace(/\n---\s*$/, "")
      .trim(),
  }));
}
const en = sections(english);
const my = sections(burmese);
const source = (indices, language) =>
  indices
    .map((index, i) => {
      const section = (language === "my" ? my : en)[index];
      return `${i ? `## ${section.title}\n\n` : ""}${section.body}`;
    })
    .join("\n\n");

export const pages = [
  {
    id: "introduction",
    title: "Introduction",
    my: "မိတ်ဆက်",
    group: "GET STARTED",
    description: "A familiar stack. A head start on your next idea.",
    indices: [3, 4],
  },
  {
    id: "installation",
    title: "Installation",
    my: "Install လုပ်နည်း",
    group: "GET STARTED",
    description: "Everything you need to start building with Ranger.",
    indices: [5, 6],
  },
  {
    id: "quick-start",
    title: "Quick start",
    my: "အမြန် စတင်",
    group: "GET STARTED",
    description: "From your first command to a running application.",
    indices: [2, 11],
  },
  {
    id: "project-structure",
    title: "Project structure",
    my: "Project structure",
    group: "GET STARTED",
    description: "One workspace. Clear boundaries. Source code you own.",
    indices: [10],
  },
  {
    id: "cli-reference",
    title: "CLI reference",
    my: "CLI reference",
    group: "BUILD WITH RANGER",
    description: "Every command and option, in one place.",
    indices: [8, 7],
  },
  {
    id: "manage-apps",
    title: "Add & remove apps",
    my: "App ထည့်ခြင်း၊ ဖြုတ်ခြင်း",
    group: "BUILD WITH RANGER",
    description: "Let your workspace grow with your project.",
    indices: [1],
    badge: "New",
  },
  {
    id: "backend-modes",
    title: "Backend modes",
    my: "Backend modes",
    group: "BUILD WITH RANGER",
    description: "Choose the API host that fits your platforms.",
    indices: [9],
  },
  {
    id: "architecture",
    title: "Architecture",
    my: "Architecture",
    group: "BUILD WITH RANGER",
    description: "Keep delivery layers thin and shared behavior in packages.",
    indices: [13],
  },
  {
    id: "environment",
    title: "Environment variables",
    my: "Environment variables",
    group: "CONFIGURATION",
    description: "Connect your database, authentication, and apps.",
    indices: [12],
  },
  {
    id: "database",
    title: "Database & Prisma",
    my: "Database နှင့် Prisma",
    group: "CONFIGURATION",
    description: "Create, migrate, and seed your PostgreSQL database.",
    indices: [15],
  },
  {
    id: "cursor-rules",
    title: "Cursor rules",
    my: "Cursor rules",
    group: "CONFIGURATION",
    description: "Architecture guidance that travels with your code.",
    indices: [14],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    my: "ပြဿနာဖြေရှင်းခြင်း",
    group: "RESOURCES",
    description: "Get back to building with answers to common issues.",
    indices: [16],
  },
  {
    id: "contributing",
    title: "Contributing",
    my: "ပါဝင်ကူညီခြင်း",
    group: "RESOURCES",
    description: "Explore the generator, run checks, and contribute.",
    indices: [17, 20],
  },
].map((page) => ({
  ...page,
  content: { en: source(page.indices, "en"), my: source(page.indices, "my") },
}));
export const groups = [...new Set(pages.map((page) => page.group))];
export const label = (page, language) =>
  language === "my" ? page.my : page.title;
export const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
export function headings(markdown) {
  let fenced = false;
  const seen = new Map();
  return markdown.split("\n").flatMap((line) => {
    if (line.startsWith("```")) fenced = !fenced;
    const match = !fenced && line.match(/^(#{2,3}) (.+)$/);
    if (!match) return [];
    const text = match[2].replace(/[`*]/g, "");
    const base = slug(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return [
      {
        title: text,
        id: count ? `${base}-${count}` : base,
        level: match[1].length,
      },
    ];
  });
}

export function resolveDocHref(url, currentPage) {
  if (url?.startsWith("#")) {
    const anchor = url.slice(1);
    const target = pages.find((page) =>
      page.indices.some((index) =>
        [en[index], my[index]].some(
          (section) => slug(section.title) === anchor,
        ),
      ),
    );
    return target ? `#/${target.id}` : `#/${currentPage}#${anchor}`;
  }
  return url?.startsWith("./")
    ? `${repository}/blob/main/${url.slice(2)}`
    : url;
}
