# VPay Backend

Express.js REST API for the VPay voice-payment app. Handles authentication, atomic payment transfers, audio transcription via Groq Whisper, and AI intent parsing via Gemma 4.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth — PIN-based (email+password), JWT via `supabase.auth.getUser()` |
| Transcription | Groq API — `whisper-large-v3` (free tier, 2000 req/day) |
| Intent Parsing | Google AI — `gemma-4-26b-a4b-it` (free tier) |
| Security | Helmet, express-rate-limit, Joi validation, CORS |
| Logging | Morgan |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase admin client (service role)
│   ├── controllers/
│   │   ├── aiController.js      # Gemma 4 intent parsing
│   │   ├── paymentController.js # Atomic transfer via Postgres RPC
│   │   ├── profileController.js # User profile CRUD
│   │   └── whisperController.js # Audio → text via Groq Whisper
│   ├── middleware/
│   │   ├── auth.js              # JWT verification (algorithm-agnostic)
│   │   ├── errorHandler.js      # Global error handler
│   │   └── rateLimiter.js       # Per-route rate limits
│   ├── routes/
│   │   ├── ai.js
│   │   ├── payment.js
│   │   ├── profile.js
│   │   └── whisper.js
│   └── index.js                 # App entry point
├── supabase_schema.sql           # DB schema + RLS policies + atomic transfer function
├── .env.example
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Supabase project (free tier works)
- Groq API key — [console.groq.com/keys](https://console.groq.com/keys) (free, no card required)
- Google AI API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free)

### 2. Apply the Database Schema

In **Supabase Dashboard → SQL Editor**, run `supabase_schema.sql`. This creates:

- `profiles` table (user info + wallet balance)
- `transactions` table (payment history)
- `transfer_payment()` stored procedure (atomic debit/credit with row locking)
- RLS policies (users see only their own data)
- Service-role grants (required for the backend API to write to tables)

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
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (include `exp://<your-LAN-IP>:8081`) |

### 4. Install and Run

```bash
npm install

# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

## API Endpoints

All routes except `/health` require `Authorization: Bearer <supabase-jwt>`.

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

### Payments
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payment/transfer` | Atomic transfer between two users |
| `GET` | `/api/payment/history` | Paginated transaction history |
| `GET` | `/api/payment/lookup/:phone` | Look up a user by phone number |

### Voice / AI
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/whisper/transcribe` | Upload audio → returns transcript |
| `POST` | `/api/ai/analyze-transcript` | Transcript → `{ intent, parameters, clarification_message }` |
| `POST` | `/api/ai/analyze-choice` | Spoken choice → `{ choice: number }` |

### Rate Limits (per IP, 15-minute window)
- Whisper: 5 requests
- AI: 15 requests
- Payments: 10 requests
- General: 60 requests

## Payment Atomicity

Transfers use a PostgreSQL stored procedure (`transfer_payment`) with `SELECT ... FOR UPDATE` row locking. The entire debit + credit + transaction record is one atomic database operation — concurrent payments can never cause double-spends or partial updates.

## Auth Design

Users sign in with a PIN instead of SMS OTP. Internally this uses Supabase Email+Password auth:

- The fake email is derived from the phone number: `vpay_+91XXXXXXXXXX@vpay.local`
- The PIN (6 digits) is the password
- On first login the app calls `signUp`, on subsequent logins it calls `signInWithPassword`
- The backend verifies every request with `supabase.auth.getUser(token)` — works with both HS256 and ECC P-256 keys

## Security Notes

- Service Role key is used only server-side; it never reaches the app
- All user input is validated with Joi before hitting the database
- Helmet sets secure HTTP headers on every response
- CORS is restricted to explicitly listed origins
