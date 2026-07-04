const crypto = require('crypto');

const hmacSHA256 = (message, secret) =>
  crypto.createHmac('sha256', secret).update(message).digest('hex');

// ─────────────────────────────────────────────────────────────────────────────
// Network Security Layer 4 — HMAC request signing.
// Binds each request to a timestamp + shared secret, so a captured/replayed
// request (even over a compromised network path) can't be resubmitted, and
// a stolen JWT alone isn't enough to forge a valid request. Applied to
// payment-moving routes only (not Whisper — audio bodies are too large to
// sign cheaply, and it's not a money-moving endpoint).
// ─────────────────────────────────────────────────────────────────────────────
module.exports = (req, res, next) => {
  const secret = process.env.APP_SIGNING_SECRET;

  // Fails open only in local dev when the secret isn't configured yet, so
  // this doesn't block getting the rest of the app running. Must be set
  // before any production deploy — see backend/.env.example.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('APP_SIGNING_SECRET must be set in production.');
    }
    console.warn('[requestSigning] APP_SIGNING_SECRET not set — skipping signature check (dev mode)');
    return next();
  }

  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Missing request signature' });
  }

  if (Date.now() - Number(timestamp) > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Request expired' });
  }

  // req.body has already been parsed by express.json() by this point; since
  // both client and server serialize with standard JSON.stringify on an
  // object built from the same key order, this reliably reconstructs the
  // exact string the client signed.
  const body     = JSON.stringify(req.body ?? '');
  const expected = hmacSHA256(`${timestamp}.${body}`, secret);

  // Constant-time comparison — avoid leaking signature bytes via timing
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'Invalid request signature' });
  }

  next();
};
