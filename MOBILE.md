# TallyTalk — Mobile app (Capacitor)

The native iOS and Android apps wrap the **same** web codebase (in `src/`) — no
separate mobile code to maintain. Capacitor packages the built web app (`dist/`)
into a native shell and exposes native APIs (haptics, status bar, splash, push
notifications).

- App id: `com.tallytalk.app`
- Native projects: `android/` and `ios/` (committed — they are your real
  Xcode / Android Studio projects)
- Config: `capacitor.config.ts`

## The core workflow

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

## Push notifications (next step)

The `@capacitor/push-notifications` plugin is installed and configured. To turn it
on:

1. **Android** — create a Firebase project, add the Android app
   (`com.tallytalk.app`), download `google-services.json` into
   `android/app/`, and add the Google Services Gradle plugin.
2. **iOS** — enable the Push Notifications capability in Xcode, and set up an APNs
   key in your Apple Developer account.
3. On the web side, register for push on login and store the token in Supabase so
   the backend (an Edge Function) can send "you've been poked" / overdue
   reminders.

## Store submission (overview)

- **Google Play** — generate a signed **App Bundle** (`.aab`), create a Play
  Console listing, upload, fill store details, submit for review.
- **App Store** — Archive in Xcode, upload via the Organizer to App Store
  Connect, complete the listing, submit for review.

## Relationship to the backend

The mobile app talks to the **same Supabase project** as the web app (URL + anon
key are already baked in). Once you've run the migration and enabled Arkesel SMS,
phone login works identically in the native apps.
