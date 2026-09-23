# Ranger documentation

A React + Vite documentation site in the Ranger repository. The original `ranger.png` supplies the wordmark and the visual palette. The CLI and its generated app templates remain independent of this site.

## Run locally

From the repository root:

```sh
pnpm --dir docs install
pnpm docs:dev
```

Vite prints the local URL. To use a specific port:

```sh
pnpm docs:dev --port 4173
```

## Production build

```sh
pnpm docs:build
pnpm docs:preview
```

Publish the contents of `docs/dist` to a static host. Relative asset URLs and hash routes support hosting under a subdirectory without server-side route rewrites. No API, credentials, or backend service is needed. Google Fonts is optional; local system font fallbacks keep the docs usable offline.

## Edit content

- `src/content.js` imports the root English and Myanmar READMEs as Markdown. Changes appear on reload and are included in the next build.
- The page definitions select corresponding README sections. If top-level README sections are reordered, update their `indices` in `content.js`; maintain the same ordering in both languages.
- `src/App.jsx` contains the introduction, documentation layout, copy controls, accessible search dialog, language selector, and theme switch. An empty hash (`#/`) shows the landing page; documentation pages live at `#/<page>`.
- `src/Landing.jsx` is the landing page (GSAP + ScrollTrigger scenes with Lenis smooth scrolling). Its English/Myanmar copy, the "Built with" stack and the feature chapters live in `src/landingContent.js`; styles are in `src/landing.css`. Product icons are in `src/assets/products/`. With reduced motion enabled the page skips the intro and scroll scenes and shows their final state.
- `src/styles.css` contains light/dark theme tokens and responsive layouts.
- The version badge reads the CLI's root `package.json`.

Language and theme preferences are saved only in the reader's browser. Search runs locally across all documentation pages; it does not send queries to a service.

## Browser verification

Check a desktop and a narrow viewport. Verify navigation, section links, search (including an empty result), keyboard controls, package-manager tabs, code copying, English/Myanmar text, and both color themes. The production build also checks that all Markdown and logo imports resolve.
