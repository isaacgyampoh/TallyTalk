# Contributing

## Prerequisites

- **Node 20+** (see `.nvmrc`)
- For native builds: Android Studio (Android) and/or Xcode + CocoaPods (iOS, macOS
  only). See `MOBILE.md`.

## Setup

```bash
npm install
cp .env.example .env     # leave blank for Preview mode, or add Supabase URL + anon key
npm run dev
```

With a blank `.env` the app runs in **Preview mode** (sample data, no backend).

## Scripts

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Vite dev server                               |
| `npm run build`        | Type-check + production build to `dist/`      |
| `npm run preview`      | Serve the production build                    |
| `npm run typecheck`    | `tsc` with no emit                            |
| `npm run lint`         | ESLint                                        |
| `npm run format`       | Prettier write                                |
| `npm run format:check` | Prettier check (CI)                           |
| `npm run sync`         | Build + `cap sync` into native projects       |
| `npm run android`      | Build, sync, open Android Studio              |
| `npm run ios`          | Build, sync, open Xcode (macOS)               |
| `npm run assets`       | Regenerate native icons/splash from `assets/` |

## Conventions

- **TypeScript strict** — no `any`. Model data with explicit types/interfaces.
- **Formatting** is Prettier-enforced (no semicolons, single quotes, width 100).
  Run `npm run format` before committing; CI runs `format:check` + `lint` +
  `build`.
- **Styling** is Tailwind utilities using the theme tokens (`ink`, `paper`,
  `wash`, `line`, `violet`, …) — don't hard-code hex except the fixed brand
  colors already tokenised. New colors that must adapt to dark mode go through
  CSS variables in `index.css`.
- **Imports** use the `@/` alias for `src/` (e.g. `@/components/Avatar`).
- **One screen per file** in `src/screens`; shared UI in `src/components`;
  non-UI logic in `src/lib`.
- Keep components presentational; put data access behind `src/data/` when the
  real backend is wired (see `ARCHITECTURE.md`).

## Before opening a PR

```bash
npm run format
npm run lint
npm run build   # includes typecheck
```

All three must pass. Describe user-facing changes and, for UI, include a
screenshot on both light and dark themes.

## Commit style

Short imperative subject, then a body explaining the *why*. Group related changes
into one commit.
