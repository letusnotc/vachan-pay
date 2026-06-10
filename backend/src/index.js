require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');

const aiRoutes      = require('./routes/ai');
const whisperRoutes = require('./routes/whisper');
const profileRoutes = require('./routes/profile');
const paymentRoutes = require('./routes/payment');
const errorHandler  = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// --- Security headers ---
app.use(helmet());

// --- CORS ---
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

// --- Body parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Global rate limit (60 req/min per IP) ---
app.use(generalLimiter);

// --- Health check (no auth) ---
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// --- Routes ---
app.use('/api/ai',      aiRoutes);
app.use('/api/whisper', whisperRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payment', paymentRoutes);

// --- 404 ---
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// --- Central error handler (must be last) ---
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`[VPay] API listening on port ${PORT}  [${process.env.NODE_ENV || 'development'}]`)
);
