# VPay Backend

Production-ready Express.js API server for the VPay voice-payment app. Handles authentication, atomic payment transactions, audio transcription (Whisper), and AI intent parsing (Mistral).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4 |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth — phone OTP, JWT via `supabase.auth.getUser()` |
| Transcription | OpenAI Whisper API (`whisper-1`) |
| Intent Parsing | Mistral Small 3.1 via OpenRouter (free tier) |
| Security | Helmet, express-rate-limit, Joi validation, CORS |
| Logging | Morgan |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase admin client (service role)
│   ├── controllers/
│   │   ├── aiController.js      # Mistral intent parsing
│   │   ├── paymentController.js # Atomic transfer via Postgres RPC
│   │   ├── profileController.js # User profile CRUD
│   │   └── whisperController.js # Audio → text transcription
│   ├── middleware/
│   │   ├── auth.js              # JWT verification (algorithm-agnostic)
│   │   ├── rateLimiter.js       # Per-route rate limits
│   │   └── validate.js          # Joi request validation
│   ├── routes/
│   │   ├── ai.js
│   │   ├── payment.js
│   │   ├── profile.js
│   │   └── whisper.js
│   └── index.js                 # App entry point
├── supabase_schema.sql           # DB schema + RLS policies + atomic transfer function
├── .env.example
├── .gitignore
└── package.json
```

## Setup

### 1. Prerequisites

- Node.js 18+
- A Supabase project with the schema applied (see below)
- OpenAI API key (for Whisper)
- OpenRouter API key (for Mistral, free tier available)

### 2. Apply the Database Schema

In the Supabase Dashboard → SQL Editor, run `supabase_schema.sql`. This creates:
- `profiles` table (user info, balance)
- `transactions` table (payment history)
- `transfer_payment()` stored procedure (atomic debit/credit with row-level locking)
- RLS policies (users can only read their own data)

### 3. Environment Variables

```bash
cp .env.example .env
```

Fill in your values:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `3000`) |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (never expose to clients) |
| `OPENAI_API_KEY` | OpenAI key for Whisper transcription |
| `OPENROUTER_API_KEY` | OpenRouter key for Mistral intent parsing |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

### 4. Install and Run

```bash
npm install

# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

## API Endpoints

All routes except health-check require `Authorization: Bearer <supabase-jwt>`.

### Profile
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profile` | Get current user's profile |
| `POST` | `/api/profile` | Create profile (first-time setup) |
| `PATCH` | `/api/profile` | Update display name / UPI handle |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/payment/transfer` | Atomic transfer between two users |
| `GET` | `/api/payment/history` | Paginated transaction history |
| `GET` | `/api/payment/balance` | Current wallet balance |

### Voice / AI
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/whisper/transcribe` | Upload audio → returns transcript |
| `POST` | `/api/ai/analyze-transcript` | Transcript → structured payment intent |

### Rate Limits (per IP, 15-minute window)
- Whisper: 5 requests
- AI: 15 requests
- Payments: 10 requests
- General: 60 requests

## Payment Atomicity

Transfers use a PostgreSQL stored procedure (`transfer_payment`) with `SELECT ... FOR UPDATE` row locking. This guarantees that concurrent payments never result in double-spends or partial updates — the entire debit + credit + transaction record is one atomic database operation.

## Security Notes

- JWT verification uses `supabase.auth.getUser()` — works with both HS256 and the newer ECC P-256 signing keys Supabase now uses by default.
- Service Role key is used only server-side; the anon key is never loaded here.
- All user input is validated with Joi before hitting the database.
- Helmet sets secure HTTP headers on every response.
