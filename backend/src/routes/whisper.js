const router = require('express').Router();
const multer = require('multer');
const auth   = require('../middleware/auth');
const { whisperLimiter } = require('../middleware/rateLimiter');
const { transcribeAudio } = require('../controllers/whisperController');

const ALLOWED_TYPES = /\.(m4a|mp4|mp3|wav|webm|ogg|flac)$/i;
const ALLOWED_MIME  = ['audio/m4a','audio/mp4','audio/mpeg','audio/wav',
                        'audio/webm','audio/ogg','audio/flac'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB — Whisper hard limit
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_MIME.includes(file.mimetype) ||
               ALLOWED_TYPES.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Unsupported audio format'));
  }
});

router.use(auth, whisperLimiter);

router.post('/transcribe', upload.single('audio'), transcribeAudio);

module.exports = router;
