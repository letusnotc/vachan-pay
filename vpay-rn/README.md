# VPay — React Native App

Voice-first UPI payment app built with React Native + Expo. Say "send ₹200 to Rahul" and it handles the rest. Test instantly on your phone via Expo Go — no build required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 51 |
| Language | TypeScript |
| Auth | Supabase Auth (phone OTP) |
| State | Zustand |
| Navigation | React Navigation 6 (Stack) |
| HTTP | Axios (with auto JWT injection) |
| Voice Input | expo-av (recording) |
| Voice Output | expo-speech (TTS) |
| Contacts | expo-contacts |
| i18n | i18next (English + Hindi) |

## Features

- **Phone OTP login** — no passwords, Supabase handles SMS
- **Voice commands** — tap mic, speak, confirm payment
- **Intent parsing** — Whisper transcribes → Mistral extracts who/how much
- **Contact lookup** — matches spoken names to phone contacts
- **Bilingual TTS** — reads back payment details in EN or HI
- **Balance + history** — real-time wallet and transaction log

## Project Structure

```
vpay-rn/
├── src/
│   ├── hooks/
│   │   └── useVoice.ts          # Record → transcribe → parse intent
│   ├── lib/
│   │   ├── api.ts               # Axios instance with auto-auth headers
│   │   └── supabase.ts          # Supabase client (AsyncStorage session)
│   ├── screens/
│   │   ├── LoginScreen.tsx      # Phone + OTP entry
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── HomeScreen.tsx       # Main voice interface
│   │   ├── ConfirmPaymentScreen.tsx
│   │   ├── BalanceScreen.tsx
│   │   └── HistoryScreen.tsx
│   ├── store/
│   │   └── useStore.ts          # Zustand global state
│   └── utils/
│       └── phone.ts             # E.164 normalisation (+91XXXXXXXXXX)
├── App.tsx                      # Navigation root (3-state: unauthed / no-profile / app)
├── app.json                     # Expo config
├── .env.example
├── .gitignore
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Expo Go installed on your Android/iOS phone
- Backend server running and reachable on your LAN
- Supabase project with Phone Auth enabled

### 2. Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for client) |
| `EXPO_PUBLIC_API_URL` | Backend URL — use your LAN IP, **not** `localhost` |

> **LAN IP:** Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) → IPv4 under your Wi-Fi adapter.
> Example: `http://192.168.1.5:3000/api`

### 3. Install and Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. Both devices must be on the same Wi-Fi network.

## Voice Flow

```
[Tap mic] → expo-av records audio
         → POST /api/whisper/transcribe   → transcript text
         → POST /api/ai/analyze-transcript → { intent, recipient, amount }
         → contact lookup (expo-contacts)
         → navigate to ConfirmPaymentScreen
         → [Confirm] → POST /api/payment/transfer
```

Supported intents: `make_payment`, `check_balance`, `check_history`, `unknown`

## Navigation Structure

```
App.tsx
├── Auth Stack (no session)
│   ├── LoginScreen
│   └── ProfileSetupScreen
└── App Stack (authenticated + profile)
    ├── HomeScreen          (tab: Home)
    ├── ConfirmPaymentScreen
    ├── BalanceScreen       (tab: Balance)
    └── HistoryScreen       (tab: History)
```

Session state is managed by `supabase.auth.onAuthStateChange` — navigation updates automatically on login/logout.

## Notes

- Audio files are sent as `multipart/form-data` to the backend; transcription happens server-side (Whisper API).
- All API calls automatically attach the current Supabase JWT via the Axios request interceptor in `src/lib/api.ts`.
- A 401 response anywhere auto-signs the user out.
