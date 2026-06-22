const { GoogleGenAI } = require('@google/genai');

const ai    = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemma-4-26b-a4b-it';

const callGemma = async (prompt) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemma timeout after 45s')), 45_000)
  );

  const gemmaCall = ai.models.generateContent({
    model:    MODEL,
    contents: prompt,
    config:   { temperature: 0 }
  });

  const response = await Promise.race([gemmaCall, timeout]);
  return response.text ?? '';
};

const parseJson = (raw) => {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
};

const FALLBACK = {
  intent: 'unknown',
  parameters: { name: null, amount: null },
  clarification_message: "Sorry, I couldn't understand that. Please try again."
};

// Human-readable language names for the Gemma prompt
const LANG_NAMES = {
  en: 'English', hi: 'Hindi', bn: 'Bengali', te: 'Telugu',
  mr: 'Marathi', ta: 'Tamil', gu: 'Gujarati', kn: 'Kannada',
  ml: 'Malayalam', pa: 'Punjabi',
};

exports.analyzeTranscript = async (req, res, next) => {
  try {
    const { transcript, context, language = 'en' } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });

    const langName   = LANG_NAMES[language] ?? 'English';
    const hasContext = context && (context.name || context.amount);
    const contextLine = hasContext
      ? `\nPreviously understood from this conversation: name="${context.name ?? 'unknown'}", amount=${context.amount ?? 'unknown'}. Merge with the new input — do NOT discard prior values unless the user explicitly changes them.`
      : '';

    const prompt = `You are a payment assistant for an Indian UPI app. The user is speaking in ${langName} (or a mix with English).
Parse the voice command and respond ONLY with valid JSON (no markdown, no explanation):

{
  "intent": "make_payment" | "check_balance" | "check_history" | "unknown",
  "parameters": { "name": string | null, "amount": number | null },
  "clarification_message": string
}

Rules:
- For make_payment extract recipient name and rupee amount if present
- clarification_message must be in ${langName} — a natural sentence asking for what is missing, or "" if all info is present
- Amounts may appear as number words or digits — normalise to a number
- Hindi example: "Rahul ko pachaas rupaye bhejo" → make_payment, name: Rahul, amount: 50
- "mera balance check karo" → check_balance
- If context is provided, treat this as a follow-up answer and merge it with prior values${contextLine}

Voice command: "${transcript}"`;

    let raw;
    try {
      raw = await callGemma(prompt);
    } catch (gemmaErr) {
      console.error('[AI] Gemma call failed:', gemmaErr?.message || gemmaErr);
      return res.json(FALLBACK);
    }

    const parsed = parseJson(raw);
    if (!parsed) {
      console.error('[AI] Could not parse Gemma response:', raw?.slice(0, 200));
      return res.json(FALLBACK);
    }

    // Frontend safety-net merge: if Gemma dropped a context value, restore it
    if (hasContext) {
      parsed.parameters = parsed.parameters ?? {};
      if (!parsed.parameters.name   && context.name)   parsed.parameters.name   = context.name;
      if (!parsed.parameters.amount && context.amount) parsed.parameters.amount = context.amount;
      if (parsed.parameters.name && parsed.parameters.amount) parsed.intent = 'make_payment';
    }

    if (
      parsed.intent === 'make_payment' &&
      parsed.parameters?.name &&
      parsed.parameters?.amount
    ) {
      parsed.clarification_message = '';
    }

    res.json(parsed);
  } catch (err) {
    console.error('[AI] analyzeTranscript unexpected error:', err?.message || err);
    next(err);
  }
};

exports.analyzeChoice = async (req, res, next) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });

    const prompt = `The user was choosing between numbered options and said: "${transcript}".
Extract the chosen number. Respond ONLY with JSON: {"choice": <number>}
If the intent is unclear respond with: {"choice": null}`;

    let raw;
    try {
      raw = await callGemma(prompt);
    } catch (gemmaErr) {
      console.error('[AI] Gemma analyzeChoice failed:', gemmaErr?.message || gemmaErr);
      return res.json({ choice: null });
    }

    const parsed = parseJson(raw);
    res.json(parsed ?? { choice: null });
  } catch (err) {
    next(err);
  }
};
