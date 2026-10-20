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
    AuthContext.tsx   Session state; Supabase phone OTP
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
    notifications.ts  Channels, categories, and where a notification routes to
    deeplinks.ts      Which in-app path an incoming URL may open
    retryImport.ts    Code-split screens that survive a dropped connection
  i18n/
    en.ts             The source catalogue: every string, under a key
    index.ts          translate() with per-key fallback to English
    I18nProvider.tsx  Holds the current language; re-renders on a change
    Tx.tsx            A translated sentence with React nodes in its placeholders
  data/
    types.ts          DB row types mirroring the schema
    viewTypes.ts      The shapes screens render
    tasks.ts          Contacts, tallies, task spaces, accept/complete/poke
    checklists.ts     Personal lists, groups, members, invitations
    attachments.ts    Private file uploads and short-lived signed links
    profile.ts        Your own row: identity, privacy scopes, preferences
    mappers.ts        DB rows -> view shapes
    hooks.ts          TanStack Query hooks, keys and optimistic mutations
  components/         Reusable UI (Shell/nav, Avatar, Toast, sheets, icons…)
  screens/           One file per screen (Today, Contacts, Personal, Groups…)
supabase/
  migrations/        0001 core schema, 0002 push tokens, 0003 security hardening
  functions/         Edge Functions (send-sms-hook, send-push, delete-account)
android/  ios/        Native Capacitor projects
assets/              Source icon/splash for native asset generation
```

## How the app boots

`App.tsx` wraps everything in `ThemeProvider → AuthProvider → ToastProvider`,
then renders `<Gate/>`:

1. **Not ready** → splash.
2. **Not signed in** → `/signin` shows the phone-OTP `AuthFlow`; everything else
   shows the marketing `Landing`.
3. **Signed in** → the app: full-screen detail routes (`/contacts/:id`,
   `/personal/:key`, `/groups/:id`) and the tabbed `Shell` (Contacts /
   Personal / Groups / Profile).

Screens are code-split. A chunk fetch that is interrupted is retried and, once
the connection returns, the page reloads on the same URL — losing signal
mid-tap must not end the session (`lib/retryImport.ts`).

`AppViewport` frames the app as a device on tablet/desktop and full-bleed on
phones and in the native app.

## Auth

Phone OTP, and nothing else. `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
build the client; `supabase.auth.signInWithOtp` / `verifyOtp` own the code, and
the `send-sms-hook` Edge Function delivers it through Arkesel. The number is
the identity: a trigger in `0003` rejects any attempt to change it, and
`ProfilePatch` does not offer the column.

Without those env vars there is no client at all. The public pages still open
and anything needing an account reports that the server is unreachable. There
is no sample-data mode: a screen shows real data or an empty state, never
invented rows.

## The data layer

Screens never touch Supabase directly. `src/data/` holds the queries and
mutations; `hooks.ts` wraps them in TanStack Query with one key builder per
collection, so a query and the mutation that invalidates it cannot drift apart.
Mutations that the user watches happen (accepting, completing, poking) apply
optimistically and roll back on failure.

`useIsLive()` is the gate: a configured client *and* a session. Queries stay
disabled until both hold, and it is part of every query key, so one account's
cache cannot outlive its session.

Because every table has **Row-Level Security** (`0001_init.sql`) and the
hardening triggers in `0003` own the writes a client must not make (seating a
group's first admin, accepting an invitation), the client queries Postgres
directly with the anon key — there is no bespoke API tier.

### Verifying it

Two layers, deliberately separate:

- `src/data/*.test.ts` run against a mock Supabase client. They pin the query
  that gets built and the mapping that comes back — not what the database does
  with it.
- `supabase/tests/` applies the real migrations to a throwaway PostgreSQL and
  exercises the policies and triggers as the roles the app connects as
  (`npm run test:db`). Every security decision in this app lives there, so that
  is where it is checked. This found `0004`: two policies read `contacts` with
  an inline sub-select, which RLS hid from the caller, so blocking did nothing
  and being added by someone did not let you see their name. The mocks had
  agreed with the code all along.

A third layer, run by hand against the live project rather than in CI, because
it creates and deletes real users: three accounts through GoTrue, signed in for
real, asserting the same things through PostgREST with the JWTs GoTrue issued.
Last run 20 October 2026 — 24 assertions, all passing, including both halves of
the `0004` fix. The accounts were removed afterwards and the database left
empty. Worth repeating after any change to a policy, because that run is the
only one that exercises PostgREST's role switching and a real token.

Not covered by any of them: Realtime authorisation, and the Storage API's own
path handling.

## Language

Every string on the first-run path — the language step, the intro slides,
welcome, sign-in, the tab labels, the connection notices — is read from
`src/i18n/en.ts` by key. A language with no catalogue, or a key missing from
one, falls back to English, so a partial translation is useful the day it
arrives. The rest of the screens are still English in JSX.

English is the only catalogue shipped, deliberately: the wording here carries
obligation ("owes you", "agree and continue", "overdue"), and a plausible
mistranslation of that changes what someone believes they agreed to. A
catalogue goes in when a speaker has written it — `src/i18n/README.md` is the
instruction, and a test enforces that nothing machine-translated appears.

The choice is held in localStorage before an account exists and mirrored to
`profiles.preferred_language` once there is one. On a device that never asked
(the web build, a fresh install) the account's language is adopted instead, so
a preference is not silently reset to English.

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
