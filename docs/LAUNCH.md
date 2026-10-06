# Launching RiffRaff on the App Store and Google Play

Everything that can be done in code is done: native iOS and Android projects, sign-in, subscriptions, paywall, onboarding, account deletion, privacy policy, terms, app icons, splash screens and automated builds. What's left needs **your** accounts, because only the owner can create them and agree to the store terms.

Bundle / package ID: **`com.riffraff.party`** (change it in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project *before* the first store upload; after that it's permanent).

## 0. Accounts you'll need

| Service | Why | Cost |
| --- | --- | --- |
| Apple Developer Program | Publish on the App Store, TestFlight, Sign in with Apple | $99 / year |
| Google Play Console | Publish on Google Play | $25 once |
| Supabase | Accounts (sign-in) and the small server functions | Free tier |
| RevenueCat | Subscriptions on both stores | Free up to $2.5k/month in revenue |
| ElevenLabs | BOXTER's voice (you have this) | Your plan |

Check that the name **"RiffRaff"** is available on both stores (search them) before committing to it. App Store names must be unique; "RiffRaff: Party Games" is a good fallback.

## 1. Supabase (accounts)

1. Create a project at [supabase.com](https://supabase.com). Copy **Project URL** and the **anon public** key (Project Settings → API).
2. Run the database setup: open SQL Editor, paste `supabase/migrations/20261005000000_init.sql`, run it. (Or with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)
3. **Authentication → Providers → Email**: enabled. **Authentication → Email Templates → Magic Link**: make sure the template shows the code `{{ .Token }}` (RiffRaff signs in with a 6-digit code, no links needed).
4. **Authentication → URL Configuration**: Site URL = your website (`https://bobby-coleman.github.io/jacked-box/` for now); add it to Redirect URLs too.
5. Optional, recommended for the stores:
   - **Apple** provider: needs an Apple Services ID and key (Apple Developer → Certificates, IDs & Profiles). Add `com.riffraff.party` as an authorized client ID for native sign-in.
   - **Google** provider: create OAuth client IDs in Google Cloud (Web, iOS, Android). Put the web client ID and secret in Supabase; the web and iOS client IDs go in the app config (below).
6. Deploy the server functions (needs the Supabase CLI, `npx supabase login` once):
   ```bash
   npx supabase functions deploy delete-account
   npx supabase functions deploy revenuecat-webhook
   npx supabase functions deploy tts
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<make up a long random string>
   npx supabase secrets set REVENUECAT_SECRET_KEY=<RevenueCat secret API key>
   npx supabase secrets set ELEVENLABS_API_KEY=<your ElevenLabs key> ELEVENLABS_VOICE_ID=<BOXTER's voice id>
   ```

## 2. App Store Connect (iOS)

1. Enroll in the Apple Developer Program.
2. Certificates, IDs & Profiles → Identifiers → new App ID `com.riffraff.party` with **Sign in with Apple** and **In-App Purchase**.
3. App Store Connect → My Apps → new app (iOS, bundle ID above).
4. Monetization → Subscriptions → group **RiffRaff Premium** with two auto-renewable subscriptions, e.g. `riffraff_premium_monthly` and `riffraff_premium_yearly`. Set prices, add a localized name/description and the review screenshot (the paywall).
5. Users and Access → Integrations → **App Store Connect API** → generate a key (role App Manager). Download the `.p8` once.
6. Add GitHub **secrets**: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the file's contents), `APPLE_TEAM_ID`. The **iOS app** workflow then builds on GitHub's Macs and uploads to TestFlight. No Mac needed.

## 3. Google Play Console (Android)

1. Create the app in Play Console (package `com.riffraff.party`).
2. **Your upload key** is already made: `C:\Users\Omen\RiffRaffKeys\riffraff-upload.jks` with its passwords in `keystore.properties` next to it. **Back up that folder somewhere safe** (a password manager or private cloud drive). Play App Signing protects you if it's lost, but resetting it takes a support request.
3. Upload the first build by hand: Testing → Internal testing → create a release → upload `app-release.aab` (built locally into `android/app/build/outputs/bundle/release/`, or from the **Android app** workflow).
4. Monetize → Subscriptions: create `riffraff_premium_monthly` and `riffraff_premium_yearly` (base plans: monthly / yearly auto-renewing).
5. For automatic uploads from GitHub: Setup → API access → create a service account with release permissions, download its JSON key → GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`.
6. GitHub secrets for signing in CI: `RR_KEYSTORE_BASE64` (the .jks file, base64-encoded), `RR_KEYSTORE_PASSWORD`, `RR_KEY_ALIAS` (`riffraff-upload`), `RR_KEY_PASSWORD`.
   PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Omen\RiffRaffKeys\riffraff-upload.jks")) | Set-Clipboard`

## 4. RevenueCat (subscriptions)

1. Create a project. Add an **App Store** app (connect with an In-App Purchase key from App Store Connect) and a **Play Store** app (connect with the Play service account).
2. Products: import the four store products. **Entitlement**: `premium`, attach all products. **Offering**: `default` (current) with **Monthly** and **Annual** packages.
3. Integrations → **Webhooks**: URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header = the `REVENUECAT_WEBHOOK_SECRET` you set above.
4. Copy the **public** SDK keys (iOS `appl_…`, Android `goog_…`) into GitHub variables below.

## 5. GitHub settings (Settings → Secrets and variables → Actions)

**Variables** (publishable, go into the app):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | from Supabase step 1 |
| `VITE_RC_IOS_KEY` / `VITE_RC_ANDROID_KEY` | RevenueCat public SDK keys |
| `VITE_SUPPORT_EMAIL` | the email you want on the privacy policy and store pages |
| `VITE_AUTH_APPLE` / `VITE_AUTH_GOOGLE` | `true` once those providers are set up |
| `VITE_GOOGLE_WEB_CLIENT_ID` / `VITE_GOOGLE_IOS_CLIENT_ID` | Google OAuth client IDs |
| `VITE_LIVE_VOICE` | `true` to read typed answers in BOXTER's voice in Premium rooms (uses ElevenLabs credits, capped per account per day) |
| `VITE_APP_STORE_URL` / `VITE_PLAY_STORE_URL` | store links, once live |

**Secrets** (never in the app): the Apple and Android signing secrets above, `PLAY_SERVICE_ACCOUNT_JSON`.

## 6. Store listings

- **Privacy policy URL**: `<website>/privacy.html`. **Support URL**: `<website>/support.html`. **Terms (EULA)**: `<website>/terms.html`.
- **Apple privacy labels** (matches `ios/App/App/PrivacyInfo.xcprivacy`): Email address, User ID, Other user content (profile name/avatar), Purchase history. All linked to the user, used for app functionality, no tracking.
- **Google Data safety**: same data types; data encrypted in transit; users can request deletion (in-app).
- **Age rating**: players type their own text (user-generated content), shared only within private parties, with a family filter on by default and host removal. Expect 12+ (Apple) / Teen (Google). Spicy mode exists, so answer the questionnaire honestly about mature humor.
- **Screenshots**: iPhone 6.9"/6.5" and an Android phone. Lobby, a face game, the gallery and the paywall make a good set.
- **App Review notes**: "RiffRaff is a party game for several phones in the same room. To try it on one device: tap Start a party, then add practice bots in the lobby (they play automatically). Premium games can be unlocked with a sandbox account."

## 7. Ship it

Push a tag to build both apps:
```bash
git tag v1.0.0
git push origin v1.0.0
```
iOS lands in TestFlight; Android lands in the Play Console internal track. Test on real phones, then submit for review from each console.
