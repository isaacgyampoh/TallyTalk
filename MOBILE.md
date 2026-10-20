# TaskTally — Mobile app (Capacitor)

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
APK in the cloud for you — this is verified working.

1. Open the repo on GitHub → **Actions** tab → **Build mobile apps** →
   **Run workflow** (it also runs automatically on every push to `main`).
2. Wait for the **Android APK** job to finish (~3–4 minutes).
3. Open the finished run → scroll to **Artifacts** → download
   **`tallytalk-android`** (a zip containing the APK, ~5–6 MB — plus the `.aab`
   once release signing is configured).
4. Transfer the APK to your Android phone and open it. Allow "install from
   unknown sources" if prompted. Done — the app is on your phone.

Until the upload key is configured, that is a **debug** build — signed with the
shared debug key, fine for testing and useless to the Play Store. Set up signing
(next section) and the same workflow produces a signed APK and `.aab` instead.

**iOS:** the workflow runs an iOS compile check, but it's non-blocking — a
*runnable* iOS app requires Apple signing (your Apple Developer account), which
can't be done from a Linux cloud runner. For iOS without a Mac, connect this repo
to a Capacitor cloud-build service (Ionic Appflow or Codemagic) with your Apple
credentials.

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

The web toolchain (Node 22+) you already have.

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

## Signing a release build

Google Play will not accept an unsigned or debug-signed build, and Android
refuses to upgrade an installed app whose signature changed. So the upload key
is created once, kept forever, and never committed.

### 1. Create the key (once)

```bash
keytool -genkeypair -v \
  -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Your Name, O=TaskTally, C=GH"
```

It asks for two passwords (store and key); they may be the same. **Back the file
and the passwords up somewhere you will still have in five years** — a password
manager, not this repo. Losing it means never being able to update the app on
Play under the same listing.

### 2. Build locally

Put the key outside the repo (or at `android/keystore/upload.jks`, which is
git-ignored) and create `android/keystore.properties` from
`android/keystore.properties.example`:

```properties
storeFile=keystore/upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

`storeFile` is relative to `android/`. Then:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease bundleRelease -Pvcode=1 -Pvname=1.0.0
```

The APK lands in `android/app/build/outputs/apk/release/` and the Play bundle in
`android/app/build/outputs/bundle/release/`. Confirm which key signed it:

```bash
"$ANDROID_HOME"/build-tools/*/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk
```

The certificate DN must be yours, not `CN=Android Debug`. Without any key
configured, a release build stops with a message telling you what is missing
rather than producing something unusable.

### 3. Build in CI

Add four repository secrets (Settings → Secrets and variables → Actions):

| Secret                       | Value                                     |
| ---------------------------- | ----------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`    | `base64 -i upload.jks` (one line)         |
| `ANDROID_KEYSTORE_PASSWORD`  | the store password                        |
| `ANDROID_KEY_ALIAS`          | `upload`                                  |
| `ANDROID_KEY_PASSWORD`       | the key password                          |

With them present, **Build mobile apps** builds a signed APK and `.aab`, prints
the signing certificate in the log, and fails if a debug key somehow signed the
release. Without them it falls back to a debug APK and labels it as one. The
decoded keystore is deleted from the runner at the end of the job.

## Store submission (overview)

- **Google Play** — upload the signed `.aab` from the step above, create the
  Play Console listing, fill in store details, submit for review. Consider Play
  App Signing, which keeps a copy of the app signing key with Google so a lost
  upload key can be reset.
- **App Store** — Archive in Xcode, upload via the Organizer to App Store
  Connect, complete the listing, submit for review (PB-031).

## Relationship to the backend

The mobile app talks to the **same Supabase project** as the web app (URL + anon
key are already baked in). Once you've run the migration and enabled Arkesel SMS,
phone login works identically in the native apps.
