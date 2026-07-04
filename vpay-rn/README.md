# VPay — React Native App

Voice-first UPI payment app built with React Native + Expo. Say "Rahul ko pachaas rupaye bhejo" and it handles the rest — in any of 10 Indian languages. Test instantly on your phone via Expo Go — no build required (unless you're touching the native security config plugins, see below).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Auth | Supabase Auth — PIN-based (6-digit, no SMS required) + biometric sign-in |
| Payments | `@stripe/stripe-react-native` — native Payment Sheet for card charges |
| State | Zustand |
| Navigation | React Navigation 6 (Native Stack) |
| HTTP | Axios (auto JWT injection + HMAC request signing on payment routes) |
| Voice Input | expo-av (audio recording) |
| Voice Output | expo-speech (TTS readback, locale-aware per language) |
| Contacts | expo-contacts (recipient lookup by name) |
| Biometrics | expo-local-authentication + expo-secure-store |
| i18n | i18next — 10 languages: English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi |

## Features

- **PIN + biometric sign-in** — enter phone number + 6-digit PIN, or use Face ID/fingerprint once enrolled. Account locks for 15 minutes after 5 failed PIN attempts.
- **Voice commands** — tap mic, speak in any of 10 supported languages, confirm payment
- **AI intent parsing** — Groq Whisper transcribes → Gemma 4 extracts recipient and amount, with a language-aware prompt and clarification messages in the user's own language
- **Contact lookup** — matches spoken name against phone contacts, checks the recipient is on VPay before navigating to confirm
- **Add Money** — top up your wallet with a real card via Stripe's Payment Sheet
- **Send money** — every P2P send opens the Stripe Payment Sheet and charges the sender's card directly (see the backend README's "Payment Design" section for why)
- **Balance + history** — real-time wallet and transaction log
- **Language switcher** — dropdown showing the currently selected language, not just a toggle

## Project Structure

```
vpay-rn/
├── plugins/
│   └── withAndroidNetworkSecurityConfig.js  # Custom Expo config plugin — TLS enforcement for the prod API domain
├── src/
│   ├── components/
│   │   ├── LanguageSwitcher.tsx  # Dropdown showing current language + all 10 options
│   │   ├── LockScreen.tsx        # PIN/biometric re-auth after idle timeout
│   │   ├── Sidebar.tsx           # Navigation drawer
│   │   └── VoiceButton.tsx       # Animated mic button
│   ├── hooks/
│   │   ├── useBiometric.ts       # Biometric availability, enrollment, biometric-gated PIN storage
│   │   └── useVoice.ts           # Record → transcribe → parse intent
│   ├── i18n/
│   │   ├── index.ts              # i18next setup (10 languages, fallback to English)
│   │   ├── languages.ts          # AppLang type + per-language TTS/Whisper locale config
│   │   └── {en,hi,bn,te,mr,ta,gu,kn,ml,pa}.json
│   ├── lib/
│   │   ├── api.ts                # Axios instance — auto JWT + HMAC signing on money-moving routes
│   │   └── supabase.ts           # Supabase client (chunked SecureStore session adapter)
│   ├── screens/
│   │   ├── LandingScreen.tsx
│   │   ├── SignInScreen.tsx      # Phone + PIN pad, with biometric fallback
│   │   ├── SignUpScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── HomeScreen.tsx        # Main voice interface
│   │   ├── ConfirmPaymentScreen.tsx  # Voice-prefilled or manual P2P send, Stripe Payment Sheet
│   │   ├── AddMoneyScreen.tsx    # Wallet top-up via Stripe Payment Sheet
│   │   ├── BalanceScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── store/
│   │   └── store.ts              # Zustand: session, profile, language
│   └── utils/
│       └── phone.ts              # E.164 normalisation (+91XXXXXXXXXX)
├── App.tsx                       # Navigation root + idle-lock + StripeProvider
├── app.json                      # Expo config, permissions, network security + Stripe + SecureStore plugins
├── babel.config.js
├── tsconfig.json
├── .env.example
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- **Expo Go** installed on your Android or iOS phone (sufficient for everyday development — see the native build note below)
- Backend server running and reachable (see `backend/README.md`)
- Supabase project with all three migrations applied and "Confirm email" turned OFF
- A Stripe account with test-mode API keys

### 2. Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client) |
| `EXPO_PUBLIC_API_URL` | Backend URL — use your LAN IP, **not** `localhost` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys (use `pk_test_...` for development) |
| `EXPO_PUBLIC_APP_SIGNING_SECRET` | Must match `backend/.env`'s `APP_SIGNING_SECRET` exactly |

> **LAN IP:** Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) → IPv4 under your Wi-Fi adapter.
> Example: `http://192.168.1.5:3000/api`

### 3. Install and Run

```bash
npm install

# Recommended — works even when auto-detection fails
npx expo start --tunnel

# Alternative — requires phone and laptop on the same Wi-Fi
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

### A note on native config plugins

`app.json` registers several config plugins, including a custom one (`plugins/withAndroidNetworkSecurityConfig.js`) and `expo-secure-store`'s (for biometric-gated PIN storage). These only take effect in a **custom development build** (`npx expo run:android` / `npx expo run:ios` / EAS dev client) — plain Expo Go ignores config plugins entirely, since Expo Go is a pre-built generic shell. Day-to-day feature work (voice, payments, screens) is fully testable in Expo Go; only verify actual native config changes (network security enforcement, Face ID prompts) with a real prebuild.

## Voice Flow

```
[Hold mic]
  → expo-av records audio
  → POST /api/whisper/transcribe    → transcript text (language-aware)
  → POST /api/ai/analyze-transcript → { intent, parameters, clarification_message }
  → expo-contacts lookup (match name → phone number)
  → GET /api/payment/lookup/:phone  → confirm receiver is on VPay
  → navigate to ConfirmPaymentScreen
  → [User taps "Pay now"]
  → POST /api/stripe/create-transfer-intent → clientSecret
  → Stripe Payment Sheet (native card entry)
  → POST /api/stripe/confirm-transfer
  → expo-speech reads back result in the user's language
```

Supported intents: `make_payment`, `check_balance`, `check_history`, `unknown`

## Auth Design

No SMS/OTP required. Instead:

1. User enters their 10-digit Indian mobile number
2. User sets/enters a 6-digit PIN, or authenticates via Face ID/fingerprint if already enrolled
3. App calls `supabase.auth.signInWithPassword` — falls back to `signUp` if new user
4. Session persists via a chunked `SecureStore` adapter (not `AsyncStorage` — the JWT is encrypted at rest via the OS Keychain/Keystore); `App.tsx` listens to `onAuthStateChange` for navigation
5. 5 wrong PINs in a row locks the account for 15 minutes, checked via Supabase RPC before the sign-in attempt even reaches Supabase Auth
6. If biometric sign-in is enabled, the PIN is stored with `requireAuthentication: true` — decrypting it always requires a live OS biometric/passcode check, not just app-level control flow

The fake email used internally: `vpay_+91XXXXXXXXXX@vpay.local`

## Navigation Structure

```
App.tsx (wrapped in StripeProvider)
├── No session
│   ├── LandingScreen
│   ├── SignInScreen        ← phone + PIN pad, biometric fallback
│   └── SignUpScreen
├── Authenticated, no profile
│   └── ProfileSetupScreen
├── Authenticated, onboarding incomplete
│   └── OnboardingScreen
└── Fully set up
    ├── HomeScreen            ← voice button + quick actions
    ├── ConfirmPaymentScreen  ← Stripe Payment Sheet
    ├── AddMoneyScreen        ← Stripe Payment Sheet
    ├── BalanceScreen
    ├── HistoryScreen
    └── ProfileScreen
```

An idle timeout (5 minutes backgrounded) drops the user to `LockScreen` for PIN/biometric re-auth without losing their session — re-auth revokes any other active sessions afterward via `signOut({ scope: 'others' })`.

All API calls automatically attach the current Supabase JWT via the Axios interceptor in `src/lib/api.ts`; money-moving requests (`/payment/transfer`, all `/stripe/*` payment routes) are additionally HMAC-signed. A 401 response anywhere auto-signs the user out.

## Security

See **`SECURITY.md`** at the repo root for the full audit and fix history. This app's client side specifically:

- Never stores the JWT or PIN in plain `AsyncStorage` — both live in `SecureStore`, backed by the OS Keychain/Keystore
- Biometric-gated PIN: the OS itself requires a live fingerprint/Face ID/passcode to decrypt the stored PIN, not just app-level logic
- HMAC-signs every payment-moving request (see the backend README for the caveat on what this guards against vs. doesn't)
- iOS blocks arbitrary cleartext HTTP via `NSAppTransportSecurity`, while `NSAllowsLocalNetworking` keeps LAN-IP local dev working without exceptions
