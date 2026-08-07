# TallyTalk — Mobile app (Capacitor)

The native iOS and Android apps wrap the **same** web codebase (in `src/`) — no
separate mobile code to maintain. Capacitor packages the built web app (`dist/`)
into a native shell and exposes native APIs (haptics, status bar, splash, push
notifications).

- App id: `com.tallytalk.app`
- Native projects: `android/` and `ios/` (committed — they are your real
  Xcode / Android Studio projects)
- Config: `capacitor.config.ts`

## Get the Android app WITHOUT a laptop (cloud build)

You don't need Android Studio or a powerful machine. A GitHub Action builds the
APK in the cloud for you:

1. Open the repo on GitHub → **Actions** tab → **Build mobile apps** →
   **Run workflow** (it also runs automatically on every push to `main`).
2. Wait for the **Android APK** job to finish (a few minutes).
3. Open the finished run → scroll to **Artifacts** → download
   **`tallytalk-android-debug`** (a zip containing `app-debug.apk`).
4. Transfer the APK to your Android phone and open it. Allow "install from
   unknown sources" if prompted. Done — the app is on your phone.

This is a **debug** build (auto-signed, for testing/sharing). For the Play Store
you'll later produce a signed release bundle (below).

The workflow also runs an **iOS compile check** on a Mac runner to confirm the iOS
app builds — but a *runnable* iOS app needs Apple signing (see iOS below), which
requires your Apple Developer account. For iOS without a Mac, use a Capacitor
cloud-build service (Ionic Appflow or Codemagic) connected to this repo.

## The core workflow (if you do have the tools)

Whenever you change the web app, rebuild and copy it into the native shells:

```bash
npm run sync          # = npm run build && npx cap sync
```

Then open and run the native project:

```bash
npm run android       # builds, syncs, opens Android Studio
npm run ios           # builds, syncs, opens Xcode  (macOS only)
```

## Prerequisites

**Android**
- Android Studio (latest), which brings the Android SDK + Gradle
- A device or emulator

**iOS** (macOS only)
- Xcode (latest) + CocoaPods (`sudo gem install cocoapods`)
- An Apple Developer account to run on a real device / submit

The web toolchain (Node 20+) you already have.

## Run on a device

Android: `npm run android` → in Android Studio press **Run** (pick your device).
To get a shareable APK: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

iOS: `npm run ios` → in Xcode pick your device/simulator → **Run**. For TestFlight
or the App Store, use **Product → Archive**.

## Icons & splash

Source art lives in `assets/` (`icon.png`, `splash.png`, `splash-dark.png`).
Regenerate all native sizes after changing them:

```bash
npm run assets
npx cap sync
```

## Native niceties already wired

- **Haptics** — the Poke, complete, and create actions use the native haptics
  engine on device (falls back to web vibration in the browser).
- **Status bar** — follows the app's light/dark theme automatically.
- **Splash screen** — violet launch screen; hidden once the app is ready.
- **Device frame** — the desktop "phone frame" is disabled inside the native
  app, so it runs true full-screen (even on tablets).
- **Install prompts** — the web "Install app" UI is hidden inside the native app.

## Push notifications

The plumbing is in place; what's left is the provider credentials (only you can
add those).

**Already built**
- App-side registration (`src/lib/push.ts`) — on a real (non-demo) login inside
  the native app it asks permission, registers with APNs/FCM, and stores the
  device token in Supabase.
- `push_tokens` table + RLS — migration `supabase/migrations/0002_push_tokens.sql`.
- `send-push` Edge Function (`supabase/functions/send-push/index.ts`) — looks up
  a user's device tokens and sends via FCM HTTP v1. Call it after a Poke or when
  a task goes overdue.

**Remaining setup (your accounts)**
1. Run migration `0002_push_tokens.sql` in Supabase.
2. **Firebase** — create a project, add the Android app (`com.tallytalk.app`),
   download `google-services.json` into `android/app/`, and add the Google
   Services Gradle plugin. For iOS, upload an **APNs key** to Firebase and add
   the iOS app + `GoogleService-Info.plist`.
3. Deploy the function and set its secrets:
   ```bash
   supabase functions deploy send-push --no-verify-jwt
   supabase secrets set SEND_PUSH_SECRET='<random>' \
     FCM_SERVICE_ACCOUNT='<service-account JSON>'
   ```
4. From your backend/app, call `send-push` with `{ userId, title, body, data }`
   when something notify-worthy happens.

Note: the Edge Function hasn't been run against a live FCM project here — test it
on a real device once your credentials are in.

## Store submission (overview)

- **Google Play** — generate a signed **App Bundle** (`.aab`), create a Play
  Console listing, upload, fill store details, submit for review.
- **App Store** — Archive in Xcode, upload via the Organizer to App Store
  Connect, complete the listing, submit for review.

## Relationship to the backend

The mobile app talks to the **same Supabase project** as the web app (URL + anon
key are already baked in). Once you've run the migration and enabled Arkesel SMS,
phone login works identically in the native apps.
