import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Github,
  Globe2,
  Layers3,
  Menu,
  Monitor,
  Moon,
  Search,
  Smartphone,
  Sun,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import logo from "../../ranger.png";
import {
  groups,
  headings,
  label,
  pages,
  repository,
  resolveDocHref,
  version,
} from "./content";
import "./styles.css";

const icons = {
  "GET STARTED": BookOpen,
  "BUILD WITH RANGER": Layers3,
  CONFIGURATION: Code2,
  RESOURCES: Globe2,
};
const getRoute = () => {
  const [id = "introduction", anchor = ""] = location.hash.slice(2).split("#");
  return { id: id || "introduction", anchor };
};
const href = (id, anchor = "") => `#/${id}${anchor ? `#${anchor}` : ""}`;
function stored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage is optional. */
  }
}
function Logo() {
  return (
    <span className="brand-mark">
      <img src={logo} alt="Ranger" />
    </span>
  );
}
function CopyButton({ text, compact = false }) {
  const [status, setStatus] = useState("Copy");
  const timeout = useRef();
  useEffect(() => () => clearTimeout(timeout.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied!");
    } catch {
      setStatus("Select to copy");
    }
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setStatus("Copy"), 2200);
  }
  return (
    <button
      className="copy-button"
      onClick={copy}
      aria-label={`${status} code`}
      title={status}
    >
      {status === "Copied!" ? <Check size={14} /> : <Copy size={14} />}
      {!compact && <span aria-live="polite">{status}</span>}
    </button>
  );
}
function CodeBlock({ children, title }) {
  const child = React.Children.toArray(children)[0];
  const code =
    typeof children === "string"
      ? children
      : String(child?.props?.children ?? "").replace(/\n$/, "");
  const language =
    child?.props?.className?.replace("language-", "") || "terminal";
  return (
    <div className="code-block">
      <div className="code-heading">
        <span>
          <Terminal size={14} />
          {title || language}
        </span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>
          {code.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              <span
                className={line.trim().startsWith("#") ? "code-comment" : ""}
              >
                {line}
              </span>
              {i < code.split("\n").length - 1 ? "\n" : ""}
            </React.Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
function Intro({ language }) {
  const my = language === "my";
  const [manager, setManager] = useState("npm");
  const commands = {
    npm: "npx create-ranger my-app",
    pnpm: "pnpm dlx create-ranger my-app",
    yarn: "yarn create ranger my-app",
  };
  return (
    <>
      <div className="intro-lead">
        {my ? (
          "Web၊ mobile နဲ့ desktop app တွေကို ချိတ်ဆက်ပြီးသား stack တစ်ခုနဲ့ စတင်တည်ဆောက်ပါ။"
        ) : (
          <>
            Your next app starts here.
            <br />
            The full stack, already connected.
          </>
        )}
      </div>
      <p className="intro-description">
        {my
          ? "Ranger က Next.js သို့မဟုတ် React၊ Expo၊ Wails၊ tRPC၊ Better Auth နဲ့ Prisma တို့ပါဝင်တဲ့ monorepo ကို generate လုပ်ပေးပါတယ်။ Source code အားလုံးကို သင်ပိုင်ဆိုင်ပါတယ်။"
          : "Ranger scaffolds a full-stack monorepo with web, mobile, and desktop apps. Authentication, your API, and your database — wired up and ready to build on."}
      </p>
      <div
        className="stack-map"
        aria-label="Web, mobile, and desktop apps connected to one shared backend"
      >
        <div className="map-topline">
          <span>
            <span className="status-dot" /> ONE WORKSPACE. EVERY PLATFORM.
          </span>
          <span className="map-label">/my-app</span>
        </div>
        <div className="platforms">
          {[
            [Globe2, "Web", "Next.js / React"],
            [Smartphone, "Mobile", "Expo / React Native"],
            [Monitor, "Desktop", "Go / Wails"],
          ].map(([Icon, title, sub]) => (
            <a href={href("architecture")} className="platform" key={title}>
              <Icon size={25} strokeWidth={1.5} />
              <strong>{title}</strong>
              <span>{sub}</span>
            </a>
          ))}
        </div>
        <div className="connectors" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="shared-stack">
          <Layers3 size={18} />
          <strong>One shared foundation</strong>
          <span>
            tRPC <b>·</b> Better Auth <b>·</b> Prisma
          </span>
        </div>
        <div className="map-footer">
          <span>TypeScript, end to end</span>
          <span>
            Powered by Turborepo <ArrowUpRight size={12} />
          </span>
        </div>
      </div>
      <div className="section-title">
        <h2 id="start-building">{my ? "စတင်တည်ဆောက်ပါ" : "Start building"}</h2>
        <span className="small-pill">
          <Zap size={12} /> One command
        </span>
      </div>
      <p>
        {my
          ? "Terminal မှာ အောက်က command ကို run ပြီး သင့် project အတွက် လိုတဲ့ platform တွေ ရွေးပါ။"
          : "Open your terminal, run the command below, and choose your platforms. Ranger takes care of the setup."}
      </p>
      <div className="install-box">
        <div
          className="package-tabs"
          role="tablist"
          aria-label="Package manager"
        >
          {Object.keys(commands).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={manager === item}
              aria-controls="install-command"
              id={`tab-${item}`}
              onClick={() => setManager(item)}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                  event.preventDefault();
                  const keys = Object.keys(commands);
                  const next =
                    keys[
                      (keys.indexOf(manager) +
                        (event.key === "ArrowRight" ? 1 : 2)) %
                        3
                    ];
                  setManager(next);
                  document.getElementById(`tab-${next}`).focus();
                }
              }}
              tabIndex={manager === item ? 0 : -1}
            >
              {item}
            </button>
          ))}
          <span>Terminal</span>
        </div>
        <div
          id="install-command"
          role="tabpanel"
          aria-labelledby={`tab-${manager}`}
          className="install-command"
        >
          <code>
            <span>$</span> {commands[manager]}
          </code>
          <CopyButton text={commands[manager]} compact />
        </div>
      </div>
      <div className="prerequisite">
        <span className="info-circle">i</span>
        <span>
          {my
            ? "Node.js 20+ နှင့် pnpm 9 လိုအပ်ပါတယ်။"
            : "You’ll need Node.js 20+ and pnpm 9."}{" "}
          <a href={href("installation")}>
            {my ? "လိုအပ်ချက်များ" : "View prerequisites"}{" "}
            <ArrowRight size={13} />
          </a>
        </span>
      </div>
      <a className="primary-button" href={href("quick-start")}>
        {my ? "Quick start ကိုဖတ်ရန်" : "Follow the quick start"}
        <ArrowRight size={16} />
      </a>
      <h2 id="built-to-work-together">
        {my ? "အဆင်သင့် ချိတ်ဆက်ထားပြီးသား" : "Built to work together"}
      </h2>
      <p>
        {my
          ? "Setup အတွက် အချိန်ကုန်သက်သာပြီး သင့် app ရဲ့ features တွေကို အာရုံစိုက်နိုင်ပါတယ်။"
          : "Spend less time connecting tools and more time building your product. Start with a working blog, authentication, and an admin dashboard."}
      </p>
      <div className="feature-grid">
        {[
          [
            Code2,
            "Type-safe by default",
            "Share types from your database to every client with TypeScript and tRPC.",
            "architecture",
          ],
          [
            Layers3,
            "A stack that grows with you",
            "Add another app when you need it. Keep your shared code in one place.",
            "manage-apps",
          ],
          [
            Terminal,
            "Your code, your project",
            "Real source files with familiar conventions. No hidden runtime or framework.",
            "project-structure",
          ],
          [
            Globe2,
            "Choose your platforms",
            "Next.js or React for web. Expo for mobile. Wails for desktop.",
            "backend-modes",
          ],
        ].map(([Icon, title, description, id]) => (
          <a className="feature" href={href(id)} key={title}>
            <Icon size={19} />
            <h3>
              {title}
              <ArrowUpRight size={15} />
            </h3>
            <p>{description}</p>
          </a>
        ))}
      </div>
      <div className="new-callout">
        <div className="new-icon">
          <Terminal size={21} />
        </div>
        <div>
          <span className="eyebrow">GROW YOUR WORKSPACE</span>
          <h3>One more app? One more command.</h3>
          <p>
            Add Expo, web, and Wails apps to an existing workspace with{" "}
            <code>ranger add</code>.
          </p>
          <a href={href("manage-apps")}>
            Explore app management <ArrowRight size={14} />
          </a>
        </div>
      </div>
      <h2 id="where-to-next">{my ? "ဆက်လက်လေ့လာရန်" : "Where to next?"}</h2>
      <div className="next-links">
        <a href={href("project-structure")}>
          <span>
            Understand your workspace
            <strong>Explore the project structure</strong>
          </span>
          <ArrowRight size={19} />
        </a>
        <a href={href("cli-reference")}>
          <span>
            Make it your own<strong>Browse the CLI reference</strong>
          </span>
          <ArrowRight size={19} />
        </a>
      </div>
    </>
  );
}
function SearchDialog({ language, onClose }) {
  const dialog = useRef();
  const input = useRef();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = pages
    .filter((page) =>
      terms.every((term) =>
        `${page.title} ${page.my} ${page.content[language]}`
          .toLowerCase()
          .includes(term),
      ),
    )
    .sort((a, b) => {
      const score = (page) =>
        terms.filter((term) =>
          `${page.title} ${page.my}`.toLowerCase().includes(term),
        ).length;
      return score(b) - score(a);
    });
  useEffect(() => {
    dialog.current.showModal();
    input.current.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelected((i) => Math.min(i + 1, results.length - 1));
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelected((i) => Math.max(i - 1, 0));
        }
        if (event.key === "Enter" && results[selected]) {
          location.hash = href(results[selected].id);
          onClose();
        }
      }}
      aria-label="Search documentation"
    >
      <div className="search-input">
        <Search size={20} />
        <input
          ref={input}
          placeholder={
            language === "my"
              ? "Docs ထဲမှာ ရှာရန်…"
              : "Search the documentation…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          aria-label="Search documentation"
        />
        <button onClick={onClose} aria-label="Close search">
          <kbd>Esc</kbd>
        </button>
      </div>
      <div className="search-results">
        <p>{query ? `${results.length} results` : "EXPLORE THE DOCS"}</p>
        {results.length ? (
          results.map((page, i) => (
            <a
              className={i === selected ? "selected" : ""}
              href={href(page.id)}
              key={page.id}
              onClick={onClose}
            >
              <BookOpen size={18} />
              <span>
                <strong>{label(page, language)}</strong>
                <small>{page.description}</small>
              </span>
              <ArrowRight size={16} />
            </a>
          ))
        ) : (
          <div className="empty-search">
            No pages found for “{query}”. Try “Expo”, “database”, or “add”.
          </div>
        )}
      </div>
      <div className="search-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to navigate
        </span>
        <span>
          <kbd>↵</kbd> to open
        </span>
        <span>
          <kbd>esc</kbd> to close
        </span>
      </div>
    </dialog>
  );
}
export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [language, setLanguage] = useState(() =>
    stored("ranger-language", "en") === "my" ? "my" : "en",
  );
  const [theme, setTheme] = useState(() => stored("ranger-theme", "light"));
  const [search, setSearch] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const page = pages.find((item) => item.id === route.id);
  const article = useRef();
  const menuButton = useRef();
  const [activeHeading, setActiveHeading] = useState("");
  const toc =
    page?.id === "introduction"
      ? [
          { id: "start-building", title: "Start building" },
          { id: "built-to-work-together", title: "Built to work together" },
          { id: "where-to-next", title: "Where to next?" },
        ]
      : headings(page?.content[language] || "");
  useEffect(() => {
    const update = () => {
      setRoute(getRoute());
      setMobileNav(false);
    };
    const keyboard = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearch((open) => !open);
      }
      if (event.key === "Escape") {
        setMobileNav(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    remember("ranger-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language === "my" ? "my" : "en";
    remember("ranger-language", language);
  }, [language]);
  useEffect(() => {
    document.title = `${page ? label(page, language) : "Page not found"} · Ranger Docs`;
    if (route.anchor)
      requestAnimationFrame(() => {
        let anchor = route.anchor;
        try {
          anchor = decodeURIComponent(anchor);
        } catch {
          /* Keep malformed URL fragments harmless. */
        }
        document
          .getElementById(anchor)
          ?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
      });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [route, language, page]);
  useEffect(() => {
    setActiveHeading("");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setActiveHeading(entry.target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    article.current
      ?.querySelectorAll("h2[id],h3[id]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [page, language]);
  let headingIndex = 0;
  const heading =
    (Tag) =>
    ({ children }) => {
      const item = toc[headingIndex++];
      return (
        <Tag id={item?.id}>
          {children}
          {item && (
            <a
              className="heading-anchor"
              href={href(page.id, item.id)}
              aria-label="Link to this section"
            >
              #
            </a>
          )}
        </Tag>
      );
    };
  const index = pages.indexOf(page);
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content").focus();
        }}
      >
        Skip to content
      </a>
      <header className="header">
        <div className="header-brand">
          <a href={href("introduction")} aria-label="Ranger documentation home">
            <Logo />
          </a>
          <span className="brand-divider" />
          <span className="docs-word">docs</span>
        </div>
        <nav className="top-nav" aria-label="Main navigation">
          <a href={href("introduction")} className={index < 4 ? "active" : ""}>
            Learn
          </a>
          <a
            href={href("cli-reference")}
            className={index >= 4 ? "active" : ""}
          >
            Reference
          </a>
        </nav>
        <button
          className="search-trigger"
          aria-label="Search documentation"
          onClick={() => setSearch(true)}
        >
          <Search size={16} />
          <span>Search documentation</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="header-actions">
          <label className="language-select">
            <Globe2 size={16} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Documentation language"
            >
              <option value="en">EN</option>
              <option value="my">မြန်မာ</option>
            </select>
            <ChevronDown size={11} />
          </label>
          <span className="action-divider" />
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            className="icon-button github-link"
            href={repository}
            target="_blank"
            rel="noreferrer"
            aria-label="Ranger on GitHub"
          >
            <Github size={19} />
          </a>
          <button
            ref={menuButton}
            className="icon-button menu-button"
            aria-expanded={mobileNav}
            aria-controls="sidebar"
            aria-label="Toggle navigation"
            onClick={() => setMobileNav(!mobileNav)}
          >
            {mobileNav ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`} id="sidebar">
        <div className="sidebar-top">
          <span>DOCUMENTATION</span>
          <span className="version">v{version}</span>
        </div>
        <nav aria-label="Documentation">
          {groups.map((group) => {
            const Icon = icons[group];
            return (
              <div className="nav-group" key={group}>
                <div className="nav-group-title">
                  <Icon size={14} />
                  {group}
                </div>
                {pages
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <a
                      key={item.id}
                      href={href(item.id)}
                      className={item.id === page?.id ? "current" : ""}
                      aria-current={item.id === page?.id ? "page" : undefined}
                    >
                      {label(item, language)}
                      {item.badge && (
                        <span className="nav-badge">{item.badge}</span>
                      )}
                      {item.id === page?.id && <ChevronRight size={14} />}
                    </a>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="tiny-mark">r</span>
          <div>
            Built by Rangorithm<span>Open source. Yours to build.</span>
          </div>
          <a href={repository} aria-label="Visit the repository">
            <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className="page-layout">
        <main id="main-content" tabIndex={-1} ref={article}>
          <div className="breadcrumbs">
            <BookOpen size={14} />
            <span>
              {page?.group === "GET STARTED" ? "Get started" : "Documentation"}
            </span>
            <ChevronRight size={12} />
            <strong>{page ? label(page, language) : "Not found"}</strong>
          </div>
          {page ? (
            <>
              <div className="article-heading">
                <div>
                  <div className="eyebrow">
                    {page.group === "GET STARTED" ? "GET STARTED" : page.group}
                  </div>
                  <h1>{label(page, language)}</h1>
                </div>
                <span className="reading-time">
                  {page.id === "introduction"
                    ? "3"
                    : Math.max(
                        2,
                        Math.ceil(
                          page.content[language].split(/\s+/).length / 220,
                        ),
                      )}{" "}
                  min read
                </span>
              </div>
              {page.id === "introduction" ? (
                <Intro language={language} />
              ) : (
                <>
                  <p className="page-description">
                    {language === "en"
                      ? page.description
                      : page.id === "manage-apps"
                        ? "သင့် project နဲ့အတူ workspace ကို တိုးချဲ့ပါ။"
                        : "သင့် app ကို တည်ဆောက်ရန် အဆင့်ဆင့် လမ်းညွှန်ချက်များ။"}
                  </p>
                  <div className="markdown">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre: CodeBlock,
                        h2: heading("h2"),
                        h3: heading("h3"),
                        table: ({ children }) => (
                          <div className="table-scroll">
                            <table>{children}</table>
                          </div>
                        ),
                        a: ({ href: url, children }) => (
                          <a
                            href={resolveDocHref(url, page.id)}
                            {...(url?.startsWith("http")
                              ? { target: "_blank", rel: "noreferrer" }
                              : {})}
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {page.content[language]}
                    </Markdown>
                  </div>
                </>
              )}
              <div className="article-meta">
                <span>
                  Something unclear?{" "}
                  <a
                    href={`${repository}/issues`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Let us know <ArrowUpRight size={12} />
                  </a>
                </span>
                <a
                  href={`${repository}/blob/main/README${language === "my" ? ".my" : ""}.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View source <ArrowUpRight size={12} />
                </a>
              </div>
              <nav className="pagination" aria-label="Previous and next pages">
                {index > 0 ? (
                  <a href={href(pages[index - 1].id)}>
                    <small>PREVIOUS</small>
                    <span>← {label(pages[index - 1], language)}</span>
                  </a>
                ) : (
                  <span />
                )}
                {index < pages.length - 1 && (
                  <a className="next-page" href={href(pages[index + 1].id)}>
                    <small>NEXT UP</small>
                    <span>
                      {label(pages[index + 1], language)}{" "}
                      <ArrowRight size={17} />
                    </span>
                  </a>
                )}
              </nav>
            </>
          ) : (
            <div className="not-found">
              <h1>Page not found</h1>
              <p>This documentation page doesn’t exist.</p>
              <a className="primary-button" href={href("introduction")}>
                Back to introduction <ArrowRight size={16} />
              </a>
            </div>
          )}
          <footer>
            <span>© {new Date().getFullYear()} Rangorithm</span>
            <span>Released under the MIT License</span>
          </footer>
        </main>
        <aside className="table-of-contents" aria-label="On this page">
          <div className="toc-title">ON THIS PAGE</div>
          <nav>
            {page?.id === "introduction" && (
              <a
                href={href(page.id)}
                className={!activeHeading ? "active" : ""}
              >
                Overview
              </a>
            )}
            {toc.map((item) => (
              <a
                href={href(page.id, item.id)}
                key={item.id}
                className={`${item.level === 3 ? "nested" : ""} ${activeHeading === item.id ? "active" : ""}`}
              >
                {item.title}
              </a>
            ))}
          </nav>
          <div className="toc-note">
            <Terminal size={19} />
            <strong>
              Less setup.
              <br />
              More building.
            </strong>
            <p>Your next idea is one command away.</p>
            <a href={href("quick-start")}>
              Let’s get started <ArrowRight size={13} />
            </a>
          </div>
          <a
            className="github-star"
            href={repository}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={14} /> Star on GitHub <ArrowUpRight size={12} />
          </a>
        </aside>
      </div>
      {search && (
        <SearchDialog language={language} onClose={() => setSearch(false)} />
      )}
    </>
  );
}
