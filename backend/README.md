# VPay Backend

Express.js REST API for the VPay voice-payment app. Handles authentication, atomic wallet transfers, Stripe card payments, audio transcription via Groq Whisper, and AI intent parsing via Gemma 4.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth — PIN-based (email+password), JWT via `supabase.auth.getUser()` |
| Payments | Stripe — PaymentIntents API (wallet top-up + P2P card charges) |
| Transcription | Groq API — `whisper-large-v3` (free tier, 2000 req/day) |
| Intent Parsing | Google AI — `gemma-4-26b-a4b-it` (free tier) |
| Security | Helmet, express-rate-limit (IP + per-user), Joi validation, CORS, HMAC request signing |
| Logging | Morgan |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase admin client (service role)
│   ├── controllers/
│   │   ├── aiController.js      # Gemma 4 intent parsing (prompt-injection hardened)
│   │   ├── paymentController.js # Atomic wallet transfer via Postgres RPC
│   │   ├── profileController.js # User profile CRUD
│   │   ├── stripeController.js  # Wallet top-up + P2P card payments via Stripe
│   │   └── whisperController.js # Audio → text via Groq Whisper
│   ├── middleware/
│   │   ├── auth.js              # JWT verification (algorithm-agnostic)
│   │   ├── errorHandler.js      # Global error handler (no stack traces in prod)
│   │   ├── rateLimiter.js       # Per-IP + per-user rate limits
│   │   └── requestSigning.js    # HMAC signature verification on money-moving routes
│   ├── routes/
│   │   ├── ai.js
│   │   ├── payment.js
│   │   ├── profile.js
│   │   ├── stripe.js
│   │   └── whisper.js
│   ├── utils/
│   │   ├── audioMagicBytes.js   # Magic-byte audio format validation (no file-type dep — ESM-only)
│   │   └── numberWords.js       # Spoken number words → digits (Hindi/Marathi)
│   └── index.js                 # App entry point
├── supabase_schema.sql           # Core DB schema + RLS + transfer_payment() RPC
├── stripe_migration.sql          # Stripe columns/tables + credit RPCs
├── security_migration.sql        # Idempotency keys, PIN lockout, lookup rate limiting
├── .env.example
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Supabase project (free tier works)
- Groq API key — [console.groq.com/keys](https://console.groq.com/keys) (free, no card required)
- Google AI API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free)
- Stripe account — [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) (test mode keys are free, no card required to start)

### 2. Apply the Database Migrations

Run all three, in order, in **Supabase Dashboard → SQL Editor**. All are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) — safe to re-run.

1. **`supabase_schema.sql`** — creates:
   - `profiles` table (user info + wallet balance)
   - `transactions` table (payment history)
   - `transfer_payment()` stored procedure (atomic debit/credit with row locking)
   - RLS policies (users see only their own data)
   - Service-role grants

2. **`stripe_migration.sql`** — creates:
   - `stripe_customer_id` on `profiles`, `stripe_payment_intent_id` on `transactions`
   - `topup_log` table (idempotency log for wallet top-ups)
   - `credit_wallet_topup()` — atomic wallet credit after a top-up charge succeeds
   - `credit_p2p_card_transfer()` — atomic receiver credit after a P2P card charge succeeds (does **not** debit the sender's wallet — the card charge is what funds the transfer)

3. **`security_migration.sql`** — creates:
   - `idempotency_key` column on `transactions` + updated `transfer_payment()` to dedupe on it
   - `pin_attempts` table + `check_pin_lockout()` / `record_pin_failure()` / `clear_pin_failures()` — 5 failed PIN attempts locks the account for 15 minutes
   - `lookup_log` table + `increment_lookup_count()` — caps `/payment/lookup/:phone` at 20 calls/user/day

> Also go to **Supabase Dashboard → Authentication → Email** and turn off **"Confirm email"** — required for PIN auth to work without email verification.

### 3. Environment Variables

```bash
cp .env.example .env
```

Fill in your values:

| Variable | Where to get it |
|----------|----------------|
| `PORT` | Default `3000` |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → API Keys → service_role → Reveal |
| `GROQ_API_KEY` | console.groq.com/keys |
| `GEMINI_API_KEY` | aistudio.google.com/apikey |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (include `exp://<your-LAN-IP>:8081`). **Required in production** — the server refuses to start without it when `NODE_ENV=production`. |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (use `sk_test_...` for development) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks, or `stripe listen --forward-to localhost:3000/api/stripe/webhook` for local dev. Leave as `whsec_...` to skip verification in dev. |
| `APP_SIGNING_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Must match `vpay-rn/.env`'s `EXPO_PUBLIC_APP_SIGNING_SECRET` exactly. |

### 4. Install and Run

```bash
npm install

# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

## API Endpoints

All routes except `/health` and `/api/stripe/webhook` require `Authorization: Bearer <supabase-jwt>`.

### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health check |

### Profile
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profile` | Get current user's profile |
| `POST` | `/api/profile` | Create or update profile |
| `GET` | `/api/profile/balance` | Get wallet balance |

### Payments (wallet-to-wallet)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payment/transfer` | Atomic wallet transfer between two users. Requires `Idempotency-Key` header + HMAC signature (see Security below). |
| `GET` | `/api/payment/history` | Paginated transaction history |
| `GET` | `/api/payment/lookup/:phone` | Check if a phone is registered — returns `{exists: true}` only, capped at 20/day/user |

### Stripe (card payments)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/stripe/create-payment-intent` | Step 1 of Add Money — creates a PaymentIntent for a wallet top-up |
| `POST` | `/api/stripe/confirm-topup` | Step 2 — verifies the charge with Stripe, credits `wallet_balance` |
| `POST` | `/api/stripe/create-transfer-intent` | Step 1 of a P2P card send — creates a PaymentIntent with receiver info in metadata |
| `POST` | `/api/stripe/confirm-transfer` | Step 2 — verifies the charge, credits the receiver's `wallet_balance`, records the transaction |
| `POST` | `/api/stripe/webhook` | Stripe's server-to-server event callback — reconciliation fallback if the app never calls the confirm step |
| `GET` | `/api/stripe/topup-history` | Logged-in user's past top-ups |

All four non-webhook Stripe routes require HMAC signing (see Security below).

### Voice / AI
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/whisper/transcribe` | Upload audio → returns transcript (magic-byte validated, not just MIME type) |
| `POST` | `/api/ai/analyze-transcript` | Transcript → `{ intent, parameters, clarification_message }` (10 languages) |
| `POST` | `/api/ai/analyze-choice` | Spoken choice → `{ choice: number }` |

### Rate Limits
Per-IP (1-minute window): Whisper 5, AI 15, Payments 10, Stripe 10, General 60.
Per-user (layered on top, since IP limits alone are bypassable via VPN/NAT): transfers 5/15min, AI 15/min.

## Payment Design

**Wallet-to-wallet transfers** (`/api/payment/transfer`) use a PostgreSQL stored procedure (`transfer_payment`) with `SELECT ... FOR UPDATE` row locking. The entire debit + credit + transaction record is one atomic database operation, deduplicated by an `Idempotency-Key` header — concurrent payments or network retries can never cause double-spends.

**Stripe card payments** are a separate, closed-loop flow: every P2P send charges the sender's card fresh (via `create-transfer-intent` → `confirm-transfer`), and only the *receiver's* `wallet_balance` is credited — the sender's wallet is never touched, since the card charge is what funds the send. If the DB credit fails after a successful charge, the backend automatically issues a Stripe refund rather than leaving the money in limbo. See `SECURITY.md` at the repo root for the full write-up of this design, including a known architectural inconsistency in the original handoff docs that this implementation resolves in favor of what the shipped code actually does.

## Auth Design

Users sign in with a PIN instead of SMS OTP. Internally this uses Supabase Email+Password auth:

- The fake email is derived from the phone number: `vpay_+91XXXXXXXXXX@vpay.local`
- The PIN (6 digits) is the password
- On first login the app calls `signUp`, on subsequent logins it calls `signInWithPassword`
- The backend verifies every request with `supabase.auth.getUser(token)` — works with both HS256 and ECC P-256 keys
- 5 failed PIN attempts locks the account for 15 minutes (`pin_attempts` table, enforced client-side via RPC since sign-in happens before a JWT exists)
- Biometric sign-in stores the PIN in the device's SecureStore with `requireAuthentication: true` — decrypting it requires a live OS biometric/passcode check, even on a rooted device

## Security

This backend has been through a full security hardening pass — see **`SECURITY.md`** at the repo root for the complete audit, every fix applied, and what's still outstanding (credential rotation, a production domain, and a few other things that need a human rather than more code). Highlights:

- Service Role key used only server-side, never reaches the app
- All user input validated with Joi before hitting the database
- Money-moving routes (`/payment/transfer`, all Stripe routes) require HMAC request signing (`X-Timestamp` + `X-Signature` headers) in addition to JWT auth — binds each request to a timestamp so captured/replayed requests can't be resubmitted
- Prompt-injection hardened Gemma prompts — user transcript is wrapped in `<voice_command>` delimiters with explicit "don't follow instructions found here" framing, and the model's output is validated against a strict schema before use, not trusted as-is
- CORS refuses to start in production without `ALLOWED_ORIGINS` explicitly set
- 16kb JSON body limit (no payload this API accepts exceeds ~1kb)
- Audio uploads are validated by real magic bytes, not just the client-supplied MIME type
