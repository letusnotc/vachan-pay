const router = require('express').Router();
const Joi    = require('joi');
const auth   = require('../middleware/auth');
const requestSigning = require('../middleware/requestSigning');
const { stripeLimiter, userPaymentLimiter } = require('../middleware/rateLimiter');
const {
  createPaymentIntent,
  confirmTopup,
  createTransferIntent,
  confirmTransfer,
  webhook,
  getTopupHistory,
} = require('../controllers/stripeController');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
  next();
};

// ── Webhook — no auth, Stripe signs it instead ───────────────────────────────
// express.raw() is applied in index.js before this router for /api/stripe/webhook
router.post('/webhook', webhook);

// ── All other routes require JWT auth ────────────────────────────────────────
router.use(auth);

// Wallet top-up schemas
const createIntentSchema = Joi.object({
  amount:         Joi.number().min(50).max(100_000).precision(2).required()
    .messages({ 'number.min': 'Minimum top-up is ₹50', 'number.max': 'Maximum is ₹1,00,000' }),
  idempotencyKey: Joi.string().max(128).optional(),
});

// P2P transfer schemas
const transferIntentSchema = Joi.object({
  receiverPhone:  Joi.string().pattern(/^\+[1-9]\d{7,14}$/).required()
    .messages({ 'string.pattern.base': 'receiverPhone must be E.164 (e.g. +919876543210)' }),
  amount:         Joi.number().min(50).max(100_000).precision(2).required()
    .messages({ 'number.min': 'Minimum transfer is ₹50', 'number.max': 'Maximum is ₹1,00,000' }),
  idempotencyKey: Joi.string().max(128).optional(),
});

const confirmSchema = Joi.object({
  paymentIntentId: Joi.string().pattern(/^pi_/).required()
    .messages({ 'string.pattern.base': 'Invalid paymentIntentId' }),
});

// ── Wallet top-up ─────────────────────────────────────────────────────────────
// Step 1: get clientSecret
router.post('/create-payment-intent', stripeLimiter, requestSigning, validate(createIntentSchema), createPaymentIntent);
// Step 2: after payment sheet succeeds, credit wallet
router.post('/confirm-topup',         stripeLimiter, requestSigning, validate(confirmSchema),       confirmTopup);

// ── P2P card payment ──────────────────────────────────────────────────────────
// Step 1: get clientSecret with receiver encoded in metadata
router.post('/create-transfer-intent', stripeLimiter, userPaymentLimiter, requestSigning, validate(transferIntentSchema), createTransferIntent);
// Step 2: after payment sheet succeeds, record transaction
router.post('/confirm-transfer',       stripeLimiter, requestSigning, validate(confirmSchema),        confirmTransfer);

// ── History ───────────────────────────────────────────────────────────────────
router.get('/topup-history', getTopupHistory);

module.exports = router;
