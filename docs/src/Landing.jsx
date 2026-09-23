import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Globe2,
  Monitor,
  Moon,
  Smartphone,
  Sun,
} from "lucide-react";
import logo from "../../ranger.png";
import shweNyarMyay from "./assets/products/shwe-nyar-myay.webp";
import dahlia from "./assets/products/dahlia.png";
import { repository, version } from "./content";
import {
  HERO_TITLE,
  copy,
  features,
  readyList,
  stack,
  stickers,
  syllables,
} from "./landingContent";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

const INSTALL = "npx create-ranger my-app";
const heroSyllables = syllables(HERO_TITLE);
const products = [
  { src: shweNyarMyay, name: "Shwe Nyar Myay · ရွှေညာမြေ" },
  { src: dahlia, name: "Dahlia · Stainless Steel Wholesale" },
];
const pad = (n) => String(n).padStart(2, "0");
const random = gsap.utils.random;
const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
// Replays of the intro (e.g. returning from the docs) run faster.
let introPlayed = false;

function Wordmark({ className = "", alt = "Ranger" }) {
  return (
    <span className={`lp-wordmark ${className}`}>
      <img src={logo} alt={alt} />
    </span>
  );
}

function BrandIcon({ icon, size = 28, className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
}

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      type="button"
      className="lp-cmd"
      onClick={copyCommand}
      aria-label={`Copy command: ${INSTALL}`}
    >
      <span className="lp-cmd-prompt">$</span>
      <code>{INSTALL}</code>
      <span className="lp-cmd-icon">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </span>
      <span className="lp-sr" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

// Inline `code` spans inside feature copy.
const withCode = (text) =>
  text
    .split("`")
    .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

function TerminalVisual() {
  const lines = [
    ["cmd", "$ npx create-ranger my-app"],
    ["q", "? Project name", "my-app"],
    ["q", "? Include Expo mobile app?", "Yes"],
    ["q", "? Web frontend", "Next.js App Router"],
    ["q", "? Include Wails desktop app?", "Yes"],
    ["q", "? Backend server", "Express + tRPC"],
    ["ok", "✔ Apps, packages & .env written"],
    ["ok", "✔ Auth, API & database wired"],
    ["hint", "→ cd my-app && pnpm dev"],
  ];
  return (
    <div className="lp-vis lp-vis-terminal">
      <div className="lp-window-bar">
        <i />
        <i />
        <i />
        <span>~/projects — zsh</span>
      </div>
      <div className="lp-term-body">
        {lines.map(([kind, text, answer], i) => (
          <div
            className={`lp-term-line lp-in is-${kind}`}
            style={{ "--i": i }}
            key={text}
          >
            {text}
            {answer && <b> › {answer}</b>}
          </div>
        ))}
        <span className="lp-caret" />
      </div>
    </div>
  );
}

function TypesVisual() {
  return (
    <div className="lp-vis lp-vis-types">
      <div className="lp-code-card lp-in" style={{ "--i": 0 }}>
        <div className="lp-code-file">packages/db/prisma/schema.prisma</div>
        <pre>
          <span className="t-k">model</span> <span className="t-t">Post</span>{" "}
          {"{\n"}
          {"  id        "}
          <span className="t-t">String</span> <span className="t-c">@id</span>
          {"\n  title     "}
          <span className="t-t">String</span>
          {"\n  published "}
          <span className="t-t">Boolean</span>
          {"\n}"}
        </pre>
      </div>
      <div className="lp-code-card lp-in" style={{ "--i": 1 }}>
        <div className="lp-code-file">packages/api/src/routers/post.ts</div>
        <pre>
          {"getAll: "}
          <span className="t-f">publicProcedure</span>
          {"\n  ."}
          <span className="t-f">query</span>
          {"(({ ctx }) => ({\n    posts: ctx.db.post."}
          <span className="t-f">findMany</span>
          {"(),\n  }))"}
        </pre>
      </div>
      <div className="lp-code-card lp-in" style={{ "--i": 2 }}>
        <div className="lp-code-file">apps/web/src/app/page.tsx</div>
        <pre>
          <span className="t-k">const</span>
          {" { data } = trpc.post.getAll."}
          <span className="t-f">useQuery</span>
          {"();\ndata?.posts[0]."}
          <span className="t-hl">title</span>
        </pre>
        <div className="lp-type-tip lp-in" style={{ "--i": 3 }}>
          (property) title: <b>string</b>
        </div>
      </div>
    </div>
  );
}

function PlatformsVisual() {
  const devices = [
    [Globe2, "Web", "Next.js / React"],
    [Smartphone, "Mobile", "Expo"],
    [Monitor, "Desktop", "Wails"],
  ];
  return (
    <div className="lp-vis lp-vis-platforms">
      <div className="lp-devices">
        {devices.map(([Icon, title, sub], i) => (
          <div className="lp-device lp-in" style={{ "--i": i }} key={title}>
            <Icon size={24} strokeWidth={1.6} />
            <strong>{title}</strong>
            <span>{sub}</span>
          </div>
        ))}
      </div>
      <svg
        className="lp-wires"
        viewBox="0 0 300 70"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M50 0 C50 38 150 32 150 70" />
        <path d="M150 0 L150 70" />
        <path d="M250 0 C250 38 150 32 150 70" />
      </svg>
      <div className="lp-core lp-in" style={{ "--i": 3 }}>
        <span className="lp-core-label">One shared foundation</span>
        <div className="lp-core-pkgs">
          <code>@repo/api</code>
          <code>@repo/auth</code>
          <code>@repo/db</code>
        </div>
        <span className="lp-core-host">Next.js or Express host</span>
      </div>
    </div>
  );
}

function GrowVisual() {
  const tree = [
    ["my-app/", 0],
    ["apps/", 1],
    ["web", 2],
    ["mobile", 2],
    ["dashboard", 2, true],
    ["api-server", 2, true],
    ["packages/", 1],
    ["api · auth · db", 2],
    ["turbo.json", 1],
  ];
  return (
    <div className="lp-vis lp-vis-grow">
      <div className="lp-grow-cmd">
        <span>$</span> ranger add -w dashboard
      </div>
      <ul className="lp-tree">
        {tree.map(([name, depth, fresh]) => (
          <li
            key={name}
            className={`d${depth} ${fresh ? "is-new lp-in" : ""}`}
            style={fresh ? { "--i": name === "dashboard" ? 1 : 3 } : undefined}
          >
            {name}
            {fresh && <em>new</em>}
          </li>
        ))}
      </ul>
      <div className="lp-grow-tags">
        {["own dev port", "pnpm dev:dashboard", "turbo pipeline"].map(
          (tag, i) => (
            <span className="lp-in" style={{ "--i": i + 4 }} key={tag}>
              ✓ {tag}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function RulesVisual() {
  const files = [
    "architecture/core.mdc",
    "api/api.mdc",
    "database/database-rule.mdc",
    "web-arch/nextjs.mdc",
    "mobile-arch/mobile-arch.mdc",
  ];
  return (
    <div className="lp-vis lp-vis-rules">
      <div className="lp-rules-files">
        <span className="lp-rules-dir">.cursor/rules/</span>
        {files.map((file, i) => (
          <span className="lp-rules-file lp-in" style={{ "--i": i }} key={file}>
            {file}
          </span>
        ))}
      </div>
      <div className="lp-chat">
        <div className="lp-bubble is-you lp-in" style={{ "--i": 5 }}>
          Add comments to posts
        </div>
        <div className="lp-bubble is-ai lp-in" style={{ "--i": 7 }}>
          Adding a <code>comment</code> router in <code>packages/api</code> and
          keeping <code>apps/web</code> thin — following <b>api.mdc</b> ✓
        </div>
      </div>
    </div>
  );
}

function DeployVisual() {
  return (
    <div className="lp-vis lp-vis-deploy">
      <div className="lp-node lp-in" style={{ "--i": 0 }}>
        Browser · Expo · Wails
      </div>
      <div className="lp-pipe">
        <i />
      </div>
      <div className="lp-node is-proxy lp-in" style={{ "--i": 1 }}>
        HTTPS reverse proxy
      </div>
      <div className="lp-pipe is-split">
        <i />
        <i />
      </div>
      <div className="lp-node-row">
        <div className="lp-node lp-in" style={{ "--i": 2 }}>
          Next.js <small>:3000</small>
        </div>
        <div className="lp-node lp-in" style={{ "--i": 3 }}>
          Express <small>:4000</small>
        </div>
      </div>
      <div className="lp-pipe">
        <i />
      </div>
      <div className="lp-node is-db lp-in" style={{ "--i": 4 }}>
        PostgreSQL
      </div>
    </div>
  );
}

const visuals = {
  terminal: TerminalVisual,
  types: TypesVisual,
  platforms: PlatformsVisual,
  grow: GrowVisual,
  rules: RulesVisual,
  deploy: DeployVisual,
};

function tilt(event) {
  if (reducedMotion() || event.pointerType === "touch") return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  gsap.to(card.firstElementChild, {
    rotationY: x * 24,
    rotationX: -y * 24,
    transformPerspective: 700,
    duration: 0.5,
    ease: "power3.out",
  });
}
function untilt(event) {
  gsap.to(event.currentTarget.firstElementChild, {
    rotationX: 0,
    rotationY: 0,
    duration: 1,
    ease: "elastic.out(1, 0.45)",
  });
}

export default function Landing({ language, setLanguage, theme, setTheme }) {
  const root = useRef();
  const t = copy[language];

  // Smooth scrolling and the hero intro: once per visit to the landing page.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add("lp-active");
    window.scrollTo(0, 0);
    if (reducedMotion()) return () => html.classList.remove("lp-active");

    const lenis = new Lenis({ lerp: 0.085 });
    const raf = (time) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const hurry = () => intro.timeScale(4);
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"];
    const release = () => {
      inputs.forEach((type) => window.removeEventListener(type, hurry));
      lenis.start();
    };
    let intro;

    const ctx = gsap.context((self) => {
      const q = self.selector;
      const chars = q(".lp-title .lp-char");
      const rangerChars = q(".lp-ranger .lp-char");
      const ranger = q(".lp-ranger")[0];
      ranger.classList.add("is-dim");
      lenis.stop();
      inputs.forEach((type) =>
        window.addEventListener(type, hurry, { passive: true }),
      );

      intro = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          introPlayed = true;
          release();
        },
      });
      if (introPlayed) intro.timeScale(1.8);

      intro
        .set(chars, { transformPerspective: 700 })
        .set(q(".lp-title"), { "--depth": 10 })
        // 1. Everything tumbles in from above and lands in a heap.
        .fromTo(
          chars,
          {
            y: () => -window.innerHeight * random(0.9, 1.3),
            rotation: () => random(-140, 140),
            rotationX: () => random(-200, 200),
          },
          {
            y: 0,
            xPercent: () => random(-55, 55),
            yPercent: () => random(-40, 55),
            rotation: () => random(-38, 38),
            rotationX: () => random(-55, 55),
            rotationY: () => random(-50, 50),
            scale: () => random(0.82, 1.22),
            duration: 1.25,
            ease: "bounce.out",
            stagger: 0.07,
          },
        )
        // 2. A woozy wobble. Dizzy, not high.
        .to(
          chars,
          {
            rotation: "+=9",
            duration: 0.13,
            yoyo: true,
            repeat: 3,
            ease: "sine.inOut",
            stagger: { each: 0.012, from: "random" },
          },
          "-=0.15",
        )
        // 3. Sober up: a slow, cinematic snap into formation.
        .to(chars, {
          xPercent: 0,
          yPercent: 0,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          duration: 1.35,
          ease: "expo.inOut",
          stagger: { each: 0.03, from: "center" },
        })
        .to(
          q(".lp-title"),
          { "--depth": 3, duration: 1.2, ease: "expo.inOut" },
          "<",
        )
        .fromTo(
          q(".lp-ranger-block"),
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: "expo.inOut" },
          "-=0.5",
        )
        .call(() => ranger.classList.remove("is-dim"), null, "-=0.4")
        .to(
          rangerChars,
          {
            y: -14,
            duration: 0.22,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
            stagger: 0.04,
          },
          "<",
        )
        .from(
          q(".lp-nav"),
          { yPercent: -140, duration: 0.9, clearProps: "transform" },
          "-=0.5",
        )
        .from(
          q(".lp-hero-sub, .lp-hero-actions > *"),
          {
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.08,
            clearProps: "transform,opacity",
          },
          "<0.1",
        )
        .from(
          q(".lp-sticker-pop"),
          {
            scale: 0,
            rotation: () => random(-90, 90),
            duration: 0.75,
            ease: "back.out(2.4)",
            stagger: 0.07,
          },
          "<0.1",
        )
        .from(
          q(".lp-hero-meta > span"),
          { opacity: 0, y: 12, duration: 0.6 },
          "<0.3",
        );
    }, root);

    return () => {
      release();
      ctx.revert();
      root.current?.querySelector(".lp-ranger")?.classList.remove("is-dim");
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      html.classList.remove("lp-active");
    };
  }, []);

  // Scroll-driven scenes. Rebuilt when the copy (and therefore layout) changes.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia(root);
    const q = gsap.utils.selector(root);
    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        wide: "(min-width: 900px)",
      },
      ({ conditions: { motion, wide } }) => {
        const nav = q(".lp-nav")[0];
        const bar = q(".lp-progress")[0];
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            nav.classList.toggle(
              "is-hidden",
              self.direction === 1 && self.scroll() > 240,
            );
            bar.style.transform = `scaleX(${self.progress})`;
          },
        });

        // Feature chapters drive the sticky stage (and inline visuals).
        const blocks = q(".lp-feature");
        const layers = [...q(".lp-stage-visual"), ...q(".lp-stage-dot")];
        const setActive = (index) => {
          blocks.forEach((block, i) =>
            block.classList.toggle("is-active", i === index),
          );
          layers.forEach((layer) =>
            layer.classList.toggle(
              "is-active",
              Number(layer.dataset.index) === index,
            ),
          );
        };
        setActive(0);
        blocks.forEach((block, i) =>
          ScrollTrigger.create({
            trigger: block,
            start: "top 62%",
            end: "bottom 62%",
            // Created before the pins above them, so measure after they exist.
            refreshPriority: -1,
            onToggle: (self) => self.isActive && setActive(i),
          }),
        );

        if (!motion) return;

        // Hero: the red block swallows the screen.
        const hero = q(".lp-hero")[0];
        const block = q(".lp-ranger-block")[0];
        const blockInset = () => {
          let x = 0;
          let y = 0;
          for (let el = block; el && el !== hero; el = el.offsetParent) {
            x += el.offsetLeft;
            y += el.offsetTop;
          }
          const right = hero.offsetWidth - x - block.offsetWidth;
          const bottom = hero.offsetHeight - y - block.offsetHeight;
          const radius = parseFloat(getComputedStyle(block).borderTopLeftRadius);
          return `inset(${y}px ${right}px ${bottom}px ${x}px round ${radius}px)`;
        };
        gsap
          .timeline({
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "+=120%",
              pin: true,
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          })
          .set(q(".lp-curtain"), { autoAlpha: 1 }, 0.001)
          .fromTo(
            q(".lp-curtain"),
            { clipPath: blockInset },
            {
              clipPath: "inset(0px 0px 0px 0px round 0px)",
              ease: "power3.inOut",
              duration: 1,
            },
            0,
          )
          .to(
            q(".lp-title-my"),
            { yPercent: -70, opacity: 0, ease: "power2.in", duration: 0.45 },
            0,
          )
          .to(
            q(".lp-hero-bottom"),
            { y: 70, opacity: 0, ease: "power2.in", duration: 0.35 },
            0,
          )
          .to(
            q(".lp-sticker"),
            {
              x: (i, el) =>
                (el.offsetLeft + el.offsetWidth / 2 <
                el.parentElement.offsetWidth / 2
                  ? -1
                  : 1) * random(220, 460),
              y: () => random(-280, 180),
              rotation: () => random(-120, 120),
              opacity: 0,
              ease: "power2.in",
              duration: 0.6,
            },
            0,
          )
          .to(q(".lp-hero-meta"), { opacity: 0, duration: 0.2 }, 0)
          .to(
            q(".lp-ranger"),
            { scale: 1.14, ease: "power2.inOut", duration: 1 },
            0,
          );

        // Built with: the statement lights up word by word.
        gsap.fromTo(
          q(".lp-word"),
          { opacity: 0.16 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.1,
            scrollTrigger: {
              trigger: q(".lp-statement")[0],
              start: "top 80%",
              end: "bottom 45%",
              scrub: true,
            },
          },
        );

        // The stack: vertical scroll becomes a horizontal ride.
        if (wide) {
          const section = q(".lp-stack")[0];
          const track = q(".lp-stack-track")[0];
          const distance = () =>
            Math.max(0, track.scrollWidth - section.clientWidth);
          const scrollTrigger = {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: 0.8,
            invalidateOnRefresh: true,
          };
          const ride = gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: { ...scrollTrigger, pin: true },
          });
          gsap.fromTo(
            q(".lp-stack-progress i"),
            { scaleX: 0 },
            { scaleX: 1, ease: "none", scrollTrigger },
          );
          q(".lp-stack-card").forEach((card, i) =>
            gsap.fromTo(
              card,
              { rotation: i % 2 ? 5 : -4, y: i % 2 ? 50 : -30 },
              {
                rotation: i % 2 ? -3 : 3,
                y: i % 2 ? -30 : 40,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  containerAnimation: ride,
                  start: "left right",
                  end: "right left",
                  scrub: true,
                },
              },
            ),
          );
        } else {
          q(".lp-stack-card").forEach((card) =>
            gsap.from(card, {
              y: 70,
              opacity: 0,
              rotation: random(-5, 5),
              duration: 0.9,
              ease: "expo.out",
              scrollTrigger: { trigger: card, start: "top 92%" },
            }),
          );
        }

        // Marquee that speeds up, reverses and leans with scroll velocity.
        const marquee = q(".lp-marquee")[0];
        const loops = q(".lp-marquee-row").map((row, i) => {
          const loop = gsap.fromTo(
            row,
            { xPercent: i % 2 ? -50 : 0 },
            {
              xPercent: i % 2 ? 0 : -50,
              duration: 30,
              ease: "none",
              repeat: -1,
            },
          );
          return loop.totalTime(loop.duration() * 40);
        });
        const lean = gsap.quickTo(q(".lp-marquee-inner")[0], "skewX", {
          duration: 0.4,
          ease: "power3.out",
        });
        let settle;
        ScrollTrigger.create({
          trigger: marquee,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const velocity = self.getVelocity();
            const speed = gsap.utils.clamp(1, 7, Math.abs(velocity) / 180);
            loops.forEach((loop) =>
              gsap.to(loop, {
                timeScale: self.direction * speed,
                duration: 0.2,
                overwrite: true,
              }),
            );
            lean(gsap.utils.clamp(-12, 12, velocity / -220));
            clearTimeout(settle);
            settle = setTimeout(() => {
              loops.forEach((loop) =>
                gsap.to(loop, { timeScale: self.direction, duration: 1 }),
              );
              lean(0);
            }, 140);
          },
        });

        // Generic reveals.
        q(".lp-reveal").forEach((el) =>
          gsap.from(el, {
            y: 60,
            opacity: 0,
            duration: 1.1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          }),
        );

        // Products rise and settle at a jaunty angle.
        gsap.fromTo(
          q(".lp-product"),
          { y: 180, rotation: (i) => [-16, 14, -10][i] ?? 0, opacity: 0 },
          {
            y: 0,
            rotation: (i) => [-4, 3, -2][i] ?? 0,
            opacity: 1,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: {
              trigger: q(".lp-products")[0],
              start: "top 90%",
              end: "top 40%",
              scrub: 1,
            },
          },
        );

        // Finale.
        gsap.fromTo(
          q(".lp-cta-row"),
          { xPercent: 0 },
          {
            xPercent: -28,
            ease: "none",
            scrollTrigger: {
              trigger: q(".lp-cta")[0],
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
        gsap.from(q(".lp-mask-inner"), {
          yPercent: 110,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.12,
          scrollTrigger: { trigger: q(".lp-cta-title")[0], start: "top 85%" },
        });
        gsap.fromTo(
          q(".lp-footer-mark"),
          { clipPath: "inset(100% 0% 0% 0%)", yPercent: 30 },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            yPercent: 0,
            ease: "none",
            scrollTrigger: {
              trigger: q(".lp-footer")[0],
              start: "top bottom",
              end: "bottom bottom",
              scrub: true,
            },
          },
        );

        return () => clearTimeout(settle);
      },
    );
    let live = true;
    document.fonts?.ready.then(() => live && ScrollTrigger.refresh());
    return () => {
      live = false;
      mm.revert();
    };
  }, [language]);

  return (
    <div className="lp" ref={root}>
      <div className="lp-progress" aria-hidden="true" />
      <nav className="lp-nav" aria-label="Main navigation">
        <a className="lp-nav-logo" href="#/" aria-label="Ranger home">
          <Wordmark />
        </a>
        <div className="lp-nav-links">
          <a href="#/introduction">{t.nav.docs}</a>
          <a href="#/cli-reference">{t.nav.reference}</a>
          <a href={repository} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="lp-nav-actions">
          <label className="lp-lang">
            <Globe2 size={15} />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              aria-label="Language"
            >
              <option value="en">EN</option>
              <option value="my">မြန်မာ</option>
            </select>
          </label>
          <button
            type="button"
            className="lp-icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a className="lp-btn lp-btn-small" href="#/quick-start">
            {t.nav.start}
            <ArrowRight size={15} />
          </a>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-curtain" aria-hidden="true" />
          <div className="lp-hero-inner">
            <h1 className="lp-title" id="lp-hero-title">
              <span className="lp-sr">{HERO_TITLE} Ranger</span>
              <span className="lp-title-line lp-title-my" aria-hidden="true">
                {heroSyllables.map((part, i) => (
                  <span className="lp-char" key={i}>
                    {part}
                  </span>
                ))}
              </span>
              <span className="lp-title-line lp-title-en" aria-hidden="true">
                <span className="lp-ranger">
                  <span className="lp-ranger-block" />
                  {"Ranger".split("").map((letter, i) => (
                    <span className="lp-char" key={i}>
                      {letter}
                    </span>
                  ))}
                </span>
              </span>
              {stickers.map((sticker, i) => (
                <span
                  className={`lp-sticker lp-sticker-${i}`}
                  key={sticker}
                  aria-hidden="true"
                >
                  <span className="lp-sticker-pop">
                    <span className="lp-sticker-body">{sticker}</span>
                  </span>
                </span>
              ))}
            </h1>
            <div className="lp-hero-bottom">
              <p className="lp-hero-sub">{t.sub}</p>
              <div className="lp-hero-actions">
                <a className="lp-btn" href="#/introduction">
                  {t.docs}
                  <ArrowRight size={17} />
                </a>
                <CopyCommand />
              </div>
            </div>
          </div>
          <div className="lp-hero-meta" aria-hidden="true">
            <span>{t.scroll} ↓</span>
            <span>v{version} · MIT</span>
          </div>
        </section>

        <section className="lp-built" aria-labelledby="lp-built-title">
          <div className="lp-container">
            <p className="lp-eyebrow" id="lp-built-title">
              {t.builtEyebrow}
            </p>
            <p className="lp-statement">
              {t.statement.split(" ").map((word, i) => (
                <span className="lp-word" key={`${language}-${i}`}>
                  {word}{" "}
                </span>
              ))}
            </p>
          </div>
          <div className="lp-stack">
            <div className="lp-stack-head lp-container">
              <span>{t.stackHint}</span>
              <div className="lp-stack-progress" aria-hidden="true">
                <i />
              </div>
              <span>{pad(stack.length)} tools</span>
            </div>
            <div className="lp-stack-track">
              {stack.map((item, i) => (
                <article className="lp-stack-card" key={item.name}>
                  <BrandIcon
                    icon={item.icons[0]}
                    size={220}
                    className="lp-stack-ghost"
                  />
                  <div className="lp-stack-card-top">
                    <span className="lp-stack-num">{pad(i + 1)}</span>
                    <span className="lp-stack-icons">
                      {item.icons.map((icon) => (
                        <BrandIcon icon={icon} size={28} key={icon.slug} />
                      ))}
                    </span>
                  </div>
                  <div>
                    <p className="lp-stack-role">{item.role[language]}</p>
                    <h3>{item.name}</h3>
                    <p className="lp-stack-blurb">{item.blurb[language]}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="lp-marquee" aria-hidden="true">
            <div className="lp-marquee-inner">
              {[0, 1].map((row) => (
                <div className="lp-marquee-row" key={row}>
                  {[0, 1].map((group) => (
                    <span className="lp-marquee-group" key={group}>
                      {readyList.map((word) => (
                        <span key={word}>
                          {word}
                          <i>✦</i>
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <p className="lp-sr">{readyList.join(", ")}</p>
        </section>

        <section className="lp-features" aria-labelledby="lp-features-title">
          <div className="lp-container">
            <div className="lp-features-head">
              <p className="lp-eyebrow lp-reveal">{t.featuresEyebrow}</p>
              <h2 className="lp-h2 lp-reveal" id="lp-features-title">
                {t.featuresTitle}
              </h2>
              <p className="lp-lead lp-reveal">{t.featuresSub}</p>
            </div>
            <div className="lp-features-grid">
              <div className="lp-feature-list">
                {features.map((feature, i) => {
                  const Visual = visuals[feature.visual];
                  return (
                    <article className="lp-feature" key={feature.id}>
                      <span className="lp-feature-num">
                        {pad(i + 1)} / {pad(features.length)}
                      </span>
                      <h3>{feature.title[language]}</h3>
                      <p>{withCode(feature.body[language])}</p>
                      <a className="lp-link" href={`#/${feature.id}`}>
                        {t.read}: {feature.link[language]}
                        <ArrowUpRight size={17} />
                      </a>
                      <div className="lp-feature-inline" aria-hidden="true">
                        <Visual />
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="lp-stage" aria-hidden="true">
                <div className="lp-stage-frame">
                  {features.map((feature, i) => {
                    const Visual = visuals[feature.visual];
                    return (
                      <div
                        className="lp-stage-visual"
                        data-index={i}
                        key={feature.id}
                      >
                        <Visual />
                      </div>
                    );
                  })}
                </div>
                <div className="lp-stage-dots">
                  {features.map((feature, i) => (
                    <span
                      className="lp-stage-dot"
                      data-index={i}
                      key={feature.id}
                    >
                      {pad(i + 1)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-shipped" aria-labelledby="lp-shipped-title">
          <div className="lp-container">
            <p className="lp-eyebrow lp-reveal">{t.shippedEyebrow}</p>
            <h2 className="lp-h2 lp-reveal" id="lp-shipped-title">
              {t.shippedTitle}
            </h2>
            <p className="lp-lead lp-reveal">{t.shippedSub}</p>
            <div className="lp-products">
              {products.map((product) => (
                <figure
                  className="lp-product"
                  key={product.name}
                  onPointerMove={tilt}
                  onPointerLeave={untilt}
                >
                  <div className="lp-product-tilt">
                    <img
                      src={product.src}
                      alt={product.name}
                      title={product.name}
                      loading="lazy"
                      width="512"
                      height="512"
                    />
                  </div>
                </figure>
              ))}
              <a
                className="lp-product lp-product-next"
                href="#/quick-start"
                onPointerMove={tilt}
                onPointerLeave={untilt}
              >
                <span className="lp-product-tilt">
                  <span className="lp-plus">+</span>
                  <span>{t.next}</span>
                </span>
              </a>
            </div>
          </div>
        </section>

        <section className="lp-cta" aria-labelledby="lp-cta-title">
          <div className="lp-cta-band" aria-hidden="true">
            <div className="lp-cta-row">
              {[0, 1, 2].map((i) => (
                <span key={i}>
                  Generate once <i>✦</i> Ship features <i>✦</i>
                </span>
              ))}
            </div>
          </div>
          <div className="lp-container lp-cta-inner">
            <h2 className="lp-cta-title" id="lp-cta-title">
              {t.ctaTitle.map((line) => (
                <span className="lp-mask" key={line}>
                  <span className="lp-mask-inner">{line}</span>
                </span>
              ))}
            </h2>
            <p className="lp-lead">{t.ctaSub}</p>
            <div className="lp-cta-actions">
              <a className="lp-btn lp-btn-red" href="#/introduction">
                {t.openDocs}
                <ArrowRight size={18} />
              </a>
              <CopyCommand />
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <Wordmark className="lp-footer-mark" alt="" />
          <div className="lp-footer-row">
            <span>{t.footer}</span>
            <nav aria-label="Footer">
              <a href="#/introduction">Docs</a>
              <a href={repository} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a
                href="https://www.npmjs.com/package/create-ranger"
                target="_blank"
                rel="noreferrer"
              >
                npm
              </a>
            </nav>
            <span>© {new Date().getFullYear()} Rangorithm · MIT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
