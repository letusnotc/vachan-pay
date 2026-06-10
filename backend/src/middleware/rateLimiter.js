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
const generalLimiter  = make(60, 'Too many requests — slow down');

module.exports = { whisperLimiter, aiLimiter, paymentLimiter, generalLimiter };
