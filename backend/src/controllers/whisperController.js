const axios    = require('axios');
const FormData = require('form-data');

// Groq hosts whisper-large-v3 — OpenAI-compatible API, free tier (2000 req/day)
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL       = 'whisper-large-v3';

exports.transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const form = new FormData();
    form.append('file', Buffer.from(req.file.buffer), {
      filename:    req.file.originalname || 'recording.m4a',
      contentType: req.file.mimetype     || 'audio/m4a'
    });
    form.append('model',           GROQ_MODEL);
    form.append('response_format', 'json');

    // Pass language hint so Whisper uses Devanagari (not Urdu/Arabic script)
    const lang = req.body.language;
    if (lang === 'hi') {
      form.append('language', 'hi');
      // Prime Whisper for Hindi financial vocab and number words
      form.append('prompt', 'UPI भुगतान ऐप। राशि रुपये में। जैसे: दस, बीस, पचास, सौ, पाँच सौ, हज़ार, उनसठ, उनहत्तर।');
    } else {
      form.append('language', 'en');
      form.append('prompt', 'UPI payment app. Amount in rupees. For example: ten, fifty, hundred, five hundred, one thousand.');
    }

    const response = await axios.post(GROQ_WHISPER_URL, form, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 30_000
    });

    res.json({ text: response.data.text });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(400).json({ error: 'Audio too short or invalid format' });
    }
    next(err);
  }
};
