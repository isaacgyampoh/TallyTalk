# TallyTalk

A task-first, WhatsApp-familiar accountability app. Instead of chatting, people
send each other **tasks**. Every contact is a two-sided ledger — what they owe
you on one side, what you owe them on the other — plus private checklists,
shared group checklists, and a **Poke** nudge.

Built as an installable **PWA** and as native **iOS + Android** apps from the same
codebase (Capacitor), on **Supabase** (Postgres + Auth + Realtime + Storage) with
**Arkesel** for SMS one-time codes. Deploys on **Vercel**.

**Docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) · [MOBILE.md](./MOBILE.md)

---

## What runs where

- **Frontend** — Vite + React + TypeScript + Tailwind, served as a static PWA.
- **Auth** — Supabase phone OTP. Supabase generates and verifies the code; an
  Edge Function (`send-sms-hook`) delivers it through Arkesel.
- **Data** — Postgres with Row-Level Security on every table.

If the two Supabase env values are missing, the app boots in **Preview mode**
(local sample data, no backend) so you can show it around before anything is
wired up.

---

## Everything below is click-only — no terminal needed

### 1. Create the Supabase project (browser)

1. Go to supabase.com → **New project**. Pick a name and region (choose one
   close to your users).
2. When it finishes, open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key
   These two are safe to expose — they go in the frontend.

### 2. Create the tables (browser — paste SQL)

1. In Supabase, open the **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy the whole file,
   paste it in, and click **Run**. It creates every table, all the security
   rules, the storage buckets, and realtime. (It has been validated to run
   clean end to end.)

### 3. Add the SMS delivery function (browser)

1. In Supabase, open **Edge Functions → Create a function**. Name it
   `send-sms-hook`.
2. Paste the contents of `supabase/functions/send-sms-hook/index.ts` and deploy.
3. Open **Edge Functions → send-sms-hook → Secrets** (or Project Settings →
   Edge Functions secrets) and add:
   - `ARKESEL_API_KEY` — your Arkesel API key
   - `ARKESEL_SENDER_ID` — your registered Arkesel sender ID (e.g. `TallyTalk`)
   - `SEND_SMS_HOOK_SECRET` — you'll get this value in the next step; add it
     after.

### 4. Turn on phone auth + point it at the function (browser)

1. **Authentication → Providers → Phone** — enable it.
2. **Authentication → Hooks** → enable **Send SMS** → choose the
   `send-sms-hook` Edge Function.
3. Supabase shows a **hook secret** (starts with `v1,whsec_`). Copy it into the
   `SEND_SMS_HOOK_SECRET` secret from step 3.

That's the whole backend, entirely in the browser.

### 5. Deploy to Vercel (browser)

1. Go to vercel.com → **Add New… → Project** → import
   `isaacgyampoh/TallyTalk`.
2. Vercel auto-detects Vite. Leave the build settings as-is (`npm run build`,
   output `dist`).
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL from step 1
   - `VITE_SUPABASE_ANON_KEY` = your anon key from step 1
4. Click **Deploy**. When it's live, open the URL on your phone and use the
   browser's **Add to Home Screen** to install it as an app.

---

## Running it locally (optional — only if you ever want to)

```bash
npm install
cp .env.example .env     # blank = Preview mode; fill in the two values for live auth
npm run dev
```

## Project layout

```
src/
  screens/        Contacts (owe-ledger), contact task space, Personal, Groups, Profile, Auth
  components/     Shell + bottom nav, Avatar, icons
  context/        AuthContext (Supabase phone OTP + Preview fallback)
  lib/            supabase client, config, sample data
supabase/
  migrations/0001_init.sql          full schema + RLS + storage + realtime
  functions/send-sms-hook/index.ts  Arkesel SMS delivery hook
vercel.json       SPA routing + PWA headers
```

## Security notes

- The Supabase **anon key is public by design** — it's safe in the frontend and
  in Vercel env vars. Security is enforced by Row-Level Security, not by hiding
  the key.
- The **Arkesel API key** and the **hook secret** are true secrets. They live
  only in Supabase Edge Function secrets — never in this repo or the frontend.
