const axios    = require('axios');
const FormData = require('form-data');
const { replaceNumberWords } = require('../utils/numberWords');
const { isRecognizedAudio }  = require('../utils/audioMagicBytes');

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL       = 'whisper-large-v3';

// Whisper vocab hints per language — primes the model for financial terms and
// the number words most likely to be transcribed incorrectly.
const PROMPTS = {
  en: 'UPI payment app. Amount in rupees. For example: ten, fifty, hundred, five hundred, one thousand.',
  hi: 'UPI भुगतान ऐप। राशि रुपये में। जैसे: दस, बीस, पचास, सौ, पाँच सौ, हज़ार, उनसठ, उनहत्तर।',
  bn: 'UPI পেমেন্ট অ্যাপ। টাকায় পরিমাণ। যেমন: দশ, পঞ্চাশ, একশো, পাঁচশো, হাজার।',
  te: 'UPI పేమెంట్ యాప్. మొత్తం రూపాయలలో. ఉదా: పది, యాభై, వంద, ఐదువందలు, వేయి.',
  mr: 'UPI पेमेंट अॅप. रक्कम रुपयांमध्ये. उदा: दहा, पन्नास, शंभर, पाचशे, हजार, एकोणसाठ.',
  ta: 'UPI பணம் செலுத்தும் செயலி. தொகை ரூபாயில். எ.கா: பத்து, ஐம்பது, நூறு, ஐந்நூறு, ஆயிரம்.',
  gu: 'UPI પેમેંટ એપ. રકમ રૂપિયામાં. ઉદા: દસ, પચાસ, સો, પાંચ સો, હજાર.',
  kn: 'UPI ಪಾವತಿ ಅಪ್ಲಿಕೇಶನ್. ಮೊತ್ತ ರೂಪಾಯಿಯಲ್ಲಿ. ಉದಾ: ಹತ್ತು, ಐವತ್ತು, ನೂರು, ಐನೂರು, ಸಾವಿರ.',
  ml: 'UPI പേമെൻ്റ് ആപ്പ്. തുക രൂപയിൽ. ഉദാ: പത്ത്, അമ്പത്, നൂറ്, അഞ്ഞൂറ്, ആയിരം.',
  pa: 'UPI ਭੁਗਤਾਨ ਐਪ। ਰਾਸ਼ੀ ਰੁਪਿਆਂ ਵਿੱਚ। ਜਿਵੇਂ: ਦਸ, ਪੰਜਾਹ, ਸੌ, ਪੰਜ ਸੌ, ਹਜ਼ਾਰ।',
};

const SUPPORTED = new Set(Object.keys(PROMPTS));

exports.transcribeAudio = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

    // M-3: multer's fileFilter only checked the client-supplied MIME type
    // and filename, both attacker-controlled. Verify the actual bytes.
    if (!isRecognizedAudio(req.file.buffer)) {
      return res.status(400).json({ error: 'File does not match a supported audio format' });
    }

    const lang = SUPPORTED.has(req.body.language) ? req.body.language : 'en';

    const form = new FormData();
    form.append('file', Buffer.from(req.file.buffer), {
      filename:    req.file.originalname || 'recording.m4a',
      contentType: req.file.mimetype     || 'audio/m4a'
    });
    form.append('model',           GROQ_MODEL);
    form.append('response_format', 'json');
    form.append('language',        lang);
    form.append('prompt',          PROMPTS[lang]);

    const response = await axios.post(GROQ_WHISPER_URL, form, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 30_000
    });

    // Post-process: replace spoken number words with digits before sending to Gemma
    const raw  = response.data.text;
    const text = replaceNumberWords(raw, lang);

    res.json({ text });
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(400).json({ error: 'Audio too short or invalid format' });
    }
    next(err);
  }
};
