# VPay — Voice-First UPI Payments

Say "Rahul ko pachaas rupaye bhejo" and the money moves. VPay is a full-stack voice payment app for India — React Native front-end, Node.js back-end, Supabase database, Groq Whisper for transcription, and Gemma 4 for intent parsing.

## Repository Structure

```
vachan-pay/
├── backend/                      # Express.js REST API
├── vpay-rn/                      # React Native + Expo app
├── Python-Speech-Recognition-/   # Voice auth experiments (standalone)
└── Voice-Authentication-CNN/     # CNN voice auth model (standalone)
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Backend + Expo tooling |
| npm | 9+ | Comes with Node |
| Expo Go | Latest | Install on your Android/iOS phone |
| Git | Any | For cloning |

**API Keys required (all free tier):**

| Key | Where to get |
|-----|-------------|
| Supabase URL + Service Role Key | supabase.com → Project Settings → API |
| Supabase Anon Key | supabase.com → Project Settings → API |
| Groq API Key | console.groq.com/keys |
| Google AI API Key | aistudio.google.com/apikey |

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

### 3. Apply the database schema

In **Supabase Dashboard → SQL Editor**, paste and run the contents of `backend/supabase_schema.sql`.

This creates:
- `profiles` table (users + wallet balance)
- `transactions` table (payment history)
- `transfer_payment()` stored procedure (atomic debit/credit)
- RLS policies
- Service-role grants

### 4. Disable email confirmation (required for PIN auth)

In **Supabase Dashboard → Authentication → Email**, turn off **"Confirm email"**.

> Without this, new user signups will be stuck waiting for an email that never comes.

### 5. Set up the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:

```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

# Your machine's LAN IP — run ipconfig (Windows) or ifconfig (Mac/Linux)
# Include the Expo Go origin so the app can call the API
ALLOWED_ORIGINS=http://localhost:3000,exp://<your-LAN-IP>:8081,http://<your-LAN-IP>:8081
```

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

Open `.env` and fill in:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Must be your LAN IP — localhost won't work on a physical phone
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000/api
```

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
4. You're in — tap the mic and speak a payment command

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
  │  Supabase Auth (PIN login)
  │  Axios + JWT
  ▼
Express API  (192.168.1.x:3000)
  ├── /api/whisper/transcribe  → Groq whisper-large-v3
  ├── /api/ai/analyze-*        → Google AI gemma-4-26b-a4b-it
  ├── /api/profile             → Supabase PostgreSQL
  └── /api/payment/transfer    → atomic stored procedure
```
