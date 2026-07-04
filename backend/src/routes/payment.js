const router = require('express').Router();
const Joi    = require('joi');
const auth   = require('../middleware/auth');
const requestSigning = require('../middleware/requestSigning');
const { paymentLimiter, userPaymentLimiter } = require('../middleware/rateLimiter');
const { transfer, getHistory, lookupReceiver } = require('../controllers/paymentController');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });
  next();
};

const transferSchema = Joi.object({
  receiverPhone: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .required()
    .messages({ 'string.pattern.base': 'receiverPhone must be E.164 format (e.g. +919876543210)' }),
  amount: Joi.number().min(1).max(100_000).precision(2).required()
});

router.use(auth);

router.post('/transfer',       paymentLimiter, userPaymentLimiter, requestSigning, validate(transferSchema), transfer);
router.get('/history',         getHistory);
router.get('/lookup/:phone',   lookupReceiver);

module.exports = router;
