const router = require('express').Router();
const auth   = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { analyzeTranscript, analyzeChoice } = require('../controllers/aiController');

router.use(auth, aiLimiter);

router.post('/analyze-transcript', analyzeTranscript);
router.post('/analyze-choice',     analyzeChoice);

module.exports = router;
