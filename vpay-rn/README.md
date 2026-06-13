# VPay — React Native App

Voice-first UPI payment app built with React Native + Expo. Say "Rahul ko pachaas rupaye bhejo" and it handles the rest. Test instantly on your phone via Expo Go — no build required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Auth | Supabase Auth — PIN-based (6-digit, no SMS required) |
| State | Zustand |
| Navigation | React Navigation 6 (Native Stack) |
| HTTP | Axios (auto JWT injection via interceptor) |
| Voice Input | expo-av (audio recording) |
| Voice Output | expo-speech (TTS readback) |
| Contacts | expo-contacts (recipient lookup by name) |
| i18n | i18next — English + Hindi |

## Features

- **PIN login** — enter phone number + 6-digit PIN, no SMS/OTP needed
- **Voice commands** — tap mic, speak in Hindi or English, confirm payment
- **AI intent parsing** — Groq Whisper transcribes → Gemma 4 extracts recipient and amount
- **Contact lookup** — matches spoken name against phone contacts
- **Bilingual TTS** — reads back payment details in EN or HI
- **Balance + history** — real-time wallet and transaction log

## Project Structure

```
vpay-rn/
├── src/
│   ├── components/
│   │   ├── LanguageSwitcher.tsx  # EN/HI toggle
│   │   └── VoiceButton.tsx       # Animated mic button
│   ├── hooks/
│   │   └── useVoice.ts           # Record → transcribe → parse intent
│   ├── i18n/
│   │   ├── index.ts              # i18next setup
│   │   ├── en.json               # English strings
│   │   └── hi.json               # Hindi strings
│   ├── lib/
│   │   ├── api.ts                # Axios instance with auto-auth headers
│   │   └── supabase.ts           # Supabase client (AsyncStorage session)
│   ├── screens/
│   │   ├── LoginScreen.tsx       # Phone number + 6-digit PIN pad
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── HomeScreen.tsx        # Main voice interface
│   │   ├── ConfirmPaymentScreen.tsx
│   │   ├── BalanceScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── store/
│   │   └── store.ts              # Zustand: session, profile, language
│   └── utils/
│       └── phone.ts              # E.164 normalisation (+91XXXXXXXXXX)
├── App.tsx                       # Navigation root (3 states: no-session / no-profile / app)
├── app.json                      # Expo config + permissions
├── babel.config.js
├── tsconfig.json
├── .env.example
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- **Expo Go** installed on your Android or iOS phone
- Backend server running and reachable (see `backend/README.md`)
- Supabase project with schema applied and "Confirm email" turned OFF

### 2. Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client) |
| `EXPO_PUBLIC_API_URL` | Backend URL — use your LAN IP, **not** `localhost` |

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

## Voice Flow

```
[Tap mic]
  → expo-av records audio
  → POST /api/whisper/transcribe    → transcript text
  → POST /api/ai/analyze-transcript → { intent, parameters, clarification_message }
  → expo-contacts lookup (match name → phone number)
  → navigate to ConfirmPaymentScreen
  → [User confirms]
  → POST /api/payment/transfer
  → expo-speech reads back result
```

Supported intents: `make_payment`, `check_balance`, `check_history`, `unknown`

## Auth Design

No SMS/OTP required. Instead:

1. User enters their 10-digit Indian mobile number
2. User sets/enters a 6-digit PIN
3. App calls `supabase.auth.signInWithPassword` — falls back to `signUp` if new user
4. Session persists via AsyncStorage; `App.tsx` listens to `onAuthStateChange` for navigation

The fake email used internally: `vpay_+91XXXXXXXXXX@vpay.local`

## Navigation Structure

```
App.tsx
├── No session
│   ├── LoginScreen          ← phone number + PIN pad
│   └── ProfileSetupScreen   ← name + optional email
└── Authenticated + profile
    ├── HomeScreen            ← voice button + quick actions
    ├── ConfirmPaymentScreen
    ├── BalanceScreen
    ├── HistoryScreen
    └── ProfileScreen
```

All API calls automatically attach the current Supabase JWT via the Axios interceptor in `src/lib/api.ts`. A 401 response anywhere auto-signs the user out.
