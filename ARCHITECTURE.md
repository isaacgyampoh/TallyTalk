# Architecture

TaskTally is a **task-first accountability app**: instead of chatting, people
send each other tasks, and each contact is a two-sided ledger ("they owe me" /
"I owe them"). One codebase ships to **web (PWA)** and **native iOS/Android**
(via Capacitor).

## Stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| UI             | React 18 + TypeScript (strict)                     |
| Build          | Vite                                               |
| Styling        | Tailwind CSS (themeable via CSS variables)         |
| Routing        | React Router                                       |
| Backend        | Supabase (Postgres + Auth + Realtime + Storage)    |
| SMS OTP        | Arkesel (via a Supabase Send-SMS hook)             |
| Native shell   | Capacitor (iOS + Android)                          |
| Push           | FCM v1 (Supabase Edge Function)                    |

## Directory map

```
src/
  main.tsx            App entry (mounts <App/>, imports fonts + global CSS)
  App.tsx             Providers + routing "Gate" (auth vs app vs landing)
  index.css           Tailwind layers, theme tokens, .app-frame/.app-device
  context/
    AuthContext.tsx   Session state; Supabase phone OTP + a "preview" demo mode
    ThemeContext.tsx  System/Light/Dark; applies .dark; syncs native status bar
  hooks/
    useInstallPrompt  PWA install prompt + iOS/standalone detection
  lib/
    config.ts         App constants (name, countries, priorities, checklists)
    supabase.ts       Supabase client (null when env vars are absent)
    platform.ts       isNative + native bootstrap (status bar, splash)
    haptics.ts        buzz(): native Haptics or web Vibration
    push.ts           Native push registration -> stores token in Supabase
    smartParse.ts     Natural-language -> structured task (the "smart add")
    sampleData.ts     Demo data (contacts, tasks, checklists, groups)
    demoStore.ts      In-memory demo state (created tasks/lists/groups)
  components/         Reusable UI (Shell/nav, Avatar, Toast, sheets, icons…)
  screens/           One file per screen (Today, Contacts, Personal, Groups…)
supabase/
  migrations/        SQL schema (0001 core, 0002 push tokens) — RLS on everything
  functions/         Edge Functions (send-sms-hook, send-push)
android/  ios/        Native Capacitor projects
assets/              Source icon/splash for native asset generation
```

## How the app boots

`App.tsx` wraps everything in `ThemeProvider → AuthProvider → ToastProvider`,
then renders `<Gate/>`:

1. **Not ready** → splash.
2. **Not signed in** → `/signin` shows the phone-OTP `AuthFlow`; everything else
   shows the marketing `Landing`.
3. **Signed in** (real session *or* demo preview) → the app: full-screen detail
   routes (`/contacts/:id`, `/personal/:key`, `/groups/:id`) and the tabbed
   `Shell` (Today / Contacts / Personal / Groups / Profile).

`AppViewport` frames the app as a device on tablet/desktop and full-bleed on
phones and in the native app.

## Auth

`AuthContext` runs in one of two modes:

- **Live** — when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are present.
  Phone OTP via `supabase.auth.signInWithOtp` / `verifyOtp`. Supabase owns the
  code; the `send-sms-hook` Edge Function delivers it through Arkesel.
- **Preview** — when those env vars are absent **or** the user taps "Explore with
  sample data". Renders the app against `sampleData.ts` + `demoStore` with no
  network. This is what makes the demo shareable with no backend.

## The demo/real split — and how to scale

Screens currently read from `sampleData.ts` / `demoStore` so the demo works with
zero backend. The **live data layer is now built** in `src/data/`:

- `types.ts` — DB row types mirroring the schema.
- `tasks.ts` / `checklists.ts` — typed Supabase query & mutation functions
  (contacts + tallies, task spaces, accept/complete/poke, checklists, groups).
- `mappers.ts` — convert DB rows into the UI's existing shapes.
- `hooks.ts` — TanStack Query hooks (`useContacts`, `useSpaceTasks`,
  `useChecklists`, `useGroups`) that return **sample data in preview** and **live
  queries when there's a real session** (`useIsLive`).

The app is wrapped in a `QueryClientProvider`. To finish going live:

1. Run the migrations in Supabase (`0001_init.sql`, `0002_push_tokens.sql`).
2. Flip each screen from its sample import to the matching hook — e.g. in
   `ContactsScreen`, replace `SAMPLE_CONTACTS` with
   `const { data: contacts = [] } = useContacts()`. The shapes already match, so
   this is mechanical. Add optimistic mutations for create/accept/complete.
3. Subscribe to Supabase Realtime and invalidate queries so task spaces update
   live like a chat.

Because every table has **Row-Level Security** (`0001_init.sql`), the client can
query directly with the anon key — no bespoke API tier needed.

> The live query functions are written against the validated schema but have not
> yet been exercised against a running database; verify them once the migration
> is applied.

## Theming

Colors are CSS variables (RGB channels) in `index.css`; `.dark` flips the
neutrals. Tailwind references them as `rgb(var(--c-x) / <alpha-value>)`, so
opacity utilities keep working. Fixed brand colors (violet, `carbon`) never flip.

## Native (Capacitor)

The native apps load the built web app. `platform.ts` marks the document as
`native`, hides the desktop device frame, syncs the status bar to the theme, and
hides web-install UI. `haptics.ts` and `push.ts` use native plugins on device and
degrade gracefully on web. See `MOBILE.md`.

## Adding a screen

1. Create `src/screens/MyScreen.tsx`.
2. Add a `<Route>` in `App.tsx` (inside `Shell` for a tab, or as a top-level
   full-screen route for a detail view).
3. If it's a tab, add it to `TABS` in `components/Shell.tsx`.
