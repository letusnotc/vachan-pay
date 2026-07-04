# VPay — Voice-First UPI Payments

Say "Rahul ko pachaas rupaye bhejo" and the money moves. VPay is a full-stack voice payment app for India — React Native front-end, Node.js back-end, Supabase database, Groq Whisper for transcription, Gemma 4 for intent parsing, and Stripe for card payments. Supports 10 Indian languages and biometric sign-in.

## Repository Structure

```
vachan-pay/
├── backend/                      # Express.js REST API
├── vpay-rn/                      # React Native + Expo app
├── SECURITY.md                   # Security audit, fixes applied, what's still outstanding
├── Python-Speech-Recognition-/   # Voice auth experiments (standalone)
└── Voice-Authentication-CNN/     # CNN voice auth model (standalone)
```

---

## What's in the app

- **Voice payments** — hold the mic, speak a payment command in English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, or Punjabi
- **PIN + biometric sign-in** — no SMS/OTP; a 6-digit PIN doubles as your password, with optional Face ID/fingerprint unlock and a 15-minute lockout after 5 failed attempts
- **Real card payments via Stripe** — top up your wallet, or send money to another VPay user, both via Stripe's native Payment Sheet
- **Security hardened** — see `SECURITY.md` for the full audit: encrypted session/PIN storage, HMAC-signed payment requests, rate limiting, prompt-injection defenses on the AI layer, and more

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Backend + Expo tooling |
| npm | 9+ | Comes with Node |
| Expo Go | Latest | Install on your Android/iOS phone |
| Git | Any | For cloning |

**API keys / accounts required:**

| Key | Where to get | Cost |
|-----|-------------|------|
| Supabase URL + Service Role Key + Anon Key | supabase.com → Project Settings → API | Free tier |
| Groq API Key | console.groq.com/keys | Free tier |
| Google AI API Key | aistudio.google.com/apikey | Free tier |
| Stripe API keys (test mode) | dashboard.stripe.com/apikeys | Free, no card required |

---

## Step-by-Step Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd vachan-pay
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Wait for the project to be ready (~1 min)
3. Note your **Project URL** and both API keys (Anon + Service Role) from
   **Settings → API**

### 3. Apply the database migrations

In **Supabase Dashboard → SQL Editor**, run these three files **in order** (all idempotent — safe to re-run):

1. `backend/supabase_schema.sql` — core schema: `profiles`, `transactions`, `transfer_payment()` RPC, RLS policies
2. `backend/stripe_migration.sql` — Stripe columns/tables, `credit_wallet_topup()` and `credit_p2p_card_transfer()` RPCs
3. `backend/security_migration.sql` — idempotency keys, PIN lockout tracking, per-user lookup rate limiting

See `backend/README.md` for what each one creates in detail.

### 4. Disable email confirmation (required for PIN auth)

In **Supabase Dashboard → Authentication → Email**, turn off **"Confirm email"**.

> Without this, new user signups will be stuck waiting for an email that never comes.

### 5. Set up the backend

```bash
cd backend
cp .env.example .env
```

Fill in `.env` — Supabase URL/keys, Groq key, Gemini key, `ALLOWED_ORIGINS`, Stripe secret + webhook keys, and a generated `APP_SIGNING_SECRET` (used for HMAC request signing — see `backend/README.md` for the exact command and full variable reference).

Then install and start:

```bash
npm install
npm run dev
```

You should see: `[VPay] API listening on port 3000 [development]`

> Windows users: see the **Network Setup** section below for firewall rules.

### 6. Set up the React Native app

Open a **new terminal**:

```bash
cd vpay-rn
cp .env.example .env
```

Fill in `.env` — Supabase URL/anon key, your backend's LAN IP as `EXPO_PUBLIC_API_URL`, Stripe publishable key, and the same `EXPO_PUBLIC_APP_SIGNING_SECRET` you generated for the backend (must match exactly). See `vpay-rn/README.md` for the full reference.

Then install and start:

```bash
npm install
npx expo start --tunnel
```

Scan the QR code with **Expo Go** on your phone.

> `--tunnel` is recommended — it works even when LAN auto-detection fails. The tunnel only serves the JS bundle; API calls still go directly to your LAN backend.

---

## First Run

1. Enter your 10-digit Indian mobile number
2. Enter a 6-digit PIN — this becomes your permanent password
3. Set up your display name
4. You're in — tap the mic and speak a payment command, or use "Add Money" to top up your wallet with a test card

**Test card for Stripe (test mode):** `4000 0035 6000 0008` (always succeeds) · `4000 0000 0000 9995` (always declines)

**Example voice commands:**
- "Rahul ko pachaas rupaye bhejo" → sends ₹50 to Rahul
- "Mera balance check karo" → shows wallet balance
- "Send 200 rupees to Priya" → sends ₹200 to Priya

---

## Running in Development

You need **two terminals** running simultaneously:

| Terminal | Directory | Command |
|----------|-----------|---------|
| Backend | `backend/` | `npm run dev` |
| Frontend | `vpay-rn/` | `npx expo start --tunnel` |

If you're testing Stripe webhook reconciliation locally, a third terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Network Setup (Windows)

The phone and laptop must talk to each other over Wi-Fi. Run these **once** after first clone — they persist across reboots.

**Step 1 — Find your LAN IP**

```powershell
ipconfig
# Look for: Wireless LAN adapter Wi-Fi → IPv4 Address
# Example: 192.168.1.5
```

**Step 2 — Open both ports through Windows Firewall**

```powershell
# Expo Metro bundler (serves the JS bundle to the phone)
netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081

# VPay backend API (handles auth, payments, AI)
netsh advfirewall firewall add rule name="VPay Backend" dir=in action=allow protocol=TCP localport=3000
```

**Step 3 — Verify your phone is on the same Wi-Fi**

Check your phone's Wi-Fi settings — it must be on the same network as your laptop (both should be on the same router, e.g. phone `192.168.1.4`, laptop `192.168.1.5`).

**Step 4 — Test connectivity from the phone**

Open a browser on your phone and go to `http://<your-LAN-IP>:3000/health`.
You should see `{"status":"ok"}`. If it times out, the firewall rule didn't apply — re-run Step 2 as Administrator.

**When to use `--tunnel` vs LAN**

| Situation | Command |
|-----------|---------|
| Default (most reliable) | `npx expo start --tunnel` |
| Metro shows `exp://127.0.0.1:8081` instead of your LAN IP | `npx expo start --tunnel` |
| LAN works and you want faster cold starts | `npx expo start` |

> `--tunnel` routes the JS bundle through Expo's servers but **API calls always go direct to your LAN backend** — so the backend firewall rule is required in all cases.

---

## Common Issues

**"Failed to save profile"**
- Backend isn't reachable from the phone → check firewall rule for port 3000
- `.env` values missing or wrong → verify `SUPABASE_SERVICE_ROLE_KEY` is correct

**"permission denied for table profiles"**
- The GRANT statements at the bottom of `supabase_schema.sql` weren't run → re-run just those lines in the SQL editor

**Stripe payment sheet won't open / "invalid API key"**
- Check `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend) and `STRIPE_SECRET_KEY` (backend) are both set and from the **same** Stripe account/mode (both test, or both live — never mixed)

**"Invalid request signature" on payment/Stripe calls**
- `APP_SIGNING_SECRET` (backend) and `EXPO_PUBLIC_APP_SIGNING_SECRET` (frontend) must match exactly

**"Project is incompatible with this version of Expo Go"**
- Your Expo Go app is a different SDK version → run `npx expo install --fix -- --legacy-peer-deps` and restart Metro

**App not loading on phone (same Wi-Fi)**
- Use `npx expo start --tunnel` to bypass LAN detection issues

**tsconfig red underline in VS Code**
- Run `npm install` in `vpay-rn/` first, then restart TypeScript server: `Ctrl+Shift+P → TypeScript: Restart TS Server`

---

## Architecture

```
Phone (Expo Go)
  │  Supabase Auth (PIN + biometric login) — session in SecureStore
  │  Axios + JWT + HMAC signature (money-moving routes)
  ▼
Express API  (192.168.1.x:3000)
  ├── /api/whisper/transcribe  → Groq whisper-large-v3
  ├── /api/ai/analyze-*        → Google AI gemma-4-26b-a4b-it (10 languages)
  ├── /api/profile             → Supabase PostgreSQL
  ├── /api/payment/transfer    → atomic wallet-to-wallet stored procedure
  └── /api/stripe/*            → Stripe PaymentIntents (top-up + P2P card charges)
```

## Security

This project has been through a full security audit and hardening pass. See **`SECURITY.md`** for:
- Every finding (critical/high/medium/low), what was fixed, and how it was verified
- What's still outstanding — a short list of things that need a human (credential rotation, buying a production domain, etc.), not more code
- The network security plan (HTTPS enforcement, Android/iOS TLS config, HMAC request signing)
- Data encryption status — what's encrypted at rest and in transit, and what isn't yet
