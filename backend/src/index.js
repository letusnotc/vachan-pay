require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');

const aiRoutes      = require('./routes/ai');
const whisperRoutes = require('./routes/whisper');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payment');
const stripeRoutes  = require('./routes/stripe');
const callRiskRoutes = require('./routes/callRisk');
const errorHandler   = require('./middleware/errorHandler');
const requestSigning  = require('./middleware/requestSigning');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// --- Security headers ---
app.use(helmet());

// --- Network Security Layer 1: HTTPS redirect ───────────────────────────────
// Railway/Render terminate TLS at their edge and forward plain HTTP to this
// process, setting x-forwarded-proto so we know the original scheme. Only
// enforced in production — local dev has no TLS termination in front of it.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});

// --- CORS ---
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS must be set in production — refusing to start with an open CORS policy.');
}
const allowed = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true
}));

// --- Logging ---
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- Stripe webhook needs raw body (MUST come before express.json) ---
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// --- Body parsing ---
// 16kb comfortably covers every JSON payload this API accepts (largest is a
// payment/profile request, well under 1kb). Audio uploads go through multer
// as multipart/form-data on a separate route and are unaffected by this.
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// --- Global rate limit (60 req/min per IP) ---
app.use(generalLimiter);

// --- Health check (no auth) ---
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// --- Routes ---
app.use('/api/ai',      aiRoutes);
app.use('/api/whisper', whisperRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/stripe',  stripeRoutes);
app.use('/api/risk',    callRiskRoutes);

// --- 404 ---
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// --- Central error handler (must be last) ---
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`[VPay] API listening on port ${PORT}  [${process.env.NODE_ENV || 'development'}]`)
);
