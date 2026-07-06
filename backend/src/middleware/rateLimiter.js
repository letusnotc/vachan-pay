const rateLimit = require('express-rate-limit');

const make = (max, message) =>
  rateLimit({
    windowMs: 60 * 1000,   // 1-minute window
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });

// Tightest limit on paid external APIs
const whisperLimiter  = make(5,  'Too many transcription requests — wait 1 minute and try again');
const aiLimiter       = make(15, 'Too many AI requests — wait 1 minute and try again');
const paymentLimiter  = make(10, 'Too many payment requests — wait 1 minute and try again');
const stripeLimiter   = make(10, 'Too many Stripe requests — wait 1 minute and try again');
const generalLimiter  = make(60, 'Too many requests — slow down');

// ─────────────────────────────────────────────────────────────────────────────
// H-1: per-user rate limiting, keyed by req.user.id instead of IP.
// IP-only limits are bypassable via VPN/NAT — many users can share one IP,
// and one attacker can rotate IPs. This closes that gap for payment routes.
//
// In-memory Map — fine for a single backend instance. If this API is ever
// scaled horizontally, swap this for a Redis-backed store (see
// SECURITY.md "External Dependencies Needed" — Upstash Redis) so limits are
// shared across instances instead of reset per-process.
// ─────────────────────────────────────────────────────────────────────────────
const userWindows = new Map(); // userId -> { count, resetAt }

const makeUserLimiter = (max, windowMs, message) => (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(); // auth middleware already rejects unauthenticated requests

  const now = Date.now();
  const entry = userWindows.get(userId);

  if (!entry || now >= entry.resetAt) {
    userWindows.set(userId, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (entry.count >= max) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: message });
  }

  entry.count += 1;
  next();
};

// Periodically clear stale entries so the Map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of userWindows) {
    if (now >= entry.resetAt) userWindows.delete(userId);
  }
}, 5 * 60 * 1000).unref();

// 5 transfers per user per 15 minutes (payment + stripe P2P routes)
const userPaymentLimiter = makeUserLimiter(5, 15 * 60 * 1000, 'Too many transfer attempts — wait 15 minutes and try again');
// Match the existing per-IP AI cap, but per-user too
const userAiLimiter      = makeUserLimiter(15, 60 * 1000, 'Too many AI requests — wait 1 minute and try again');
// Call-risk audit events fire at most a handful of times per session; 20/min
// per user is generous while still blunting any attempt to flood the log.
const userEventLimiter   = makeUserLimiter(20, 60 * 1000, 'Too many events — slow down');

module.exports = {
  whisperLimiter, aiLimiter, paymentLimiter, stripeLimiter, generalLimiter,
  userPaymentLimiter, userAiLimiter, userEventLimiter,
};
