const axios    = require('axios');
const FormData = require('form-data');

exports.transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    const lang = (req.body.language || 'en').slice(0, 2); // 'en' or 'hi'

    const form = new FormData();
    form.append('file', Buffer.from(req.file.buffer), {
      filename:    req.file.originalname || 'recording.m4a',
      contentType: req.file.mimetype     || 'audio/m4a'
    });
    form.append('model',    'whisper-1');
    form.append('language', lang);

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders()
        },
        timeout: 30_000
      }
    );

    res.json({ text: response.data.text });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(400).json({ error: 'Audio too short or invalid format' });
    }
    next(err);
  }
};
