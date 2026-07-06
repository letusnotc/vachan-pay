const router = require('express').Router();
const Joi    = require('joi');
const auth   = require('../middleware/auth');
const requestSigning = require('../middleware/requestSigning');
const { userEventLimiter } = require('../middleware/rateLimiter');
const { logEvent } = require('../controllers/callRiskController');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
  next();
};

// Strict enums keep the audit trail's categorical columns clean; optional
// context fields are type/length/range-bounded so a client can't bloat rows.
const eventSchema = Joi.object({
  eventType: Joi.string().valid('proactive_warning', 'payment_warning').required(),
  outcome:   Joi.string().valid('shown', 'acknowledged', 'proceeded', 'cancelled').required(),
  micPeakDb: Joi.number().min(-160).max(0).optional(),
  receiverPhone: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .messages({ 'string.pattern.base': 'receiverPhone must be E.164 format (e.g. +919876543210)' })
    .optional(),
  amount:     Joi.number().min(0).max(100_000).precision(2).optional(),
  transcript: Joi.string().max(500).allow('', null).optional(),
});

router.use(auth);

// HMAC-signed like the money-moving routes so a captured request can't be
// replayed or tampered with in flight (X-Timestamp / X-Signature headers).
router.post('/event', userEventLimiter, requestSigning, validate(eventSchema), logEvent);

module.exports = router;
