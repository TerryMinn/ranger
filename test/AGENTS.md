# Test Agent Guide

## Architecture

- Apps are delivery layers. Shared server behavior belongs in `packages/api`, authentication in `packages/auth`, and persistence in `packages/db`.
- The web frontend is Next.js App Router.

- Next.js route handlers host auth, tRPC, and uploads.
- Feature components render state. View-model hooks own queries, mutations, forms, uploads, and navigation side effects.

## Required checks

- Run `pnpm typecheck` after TypeScript changes.
- Run `pnpm --filter @repo/web build` after web routing or configuration changes.


- Never commit real secrets. The root `.env` is the local source of truth.
