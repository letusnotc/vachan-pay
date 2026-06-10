const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = 'mistralai/mistral-small-3.1-24b-instruct:free';

const callMistral = async (prompt, maxTokens = 200) => {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model:      MODEL,
      messages:   [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens:  maxTokens
    })
  });

  if (!res.ok) {
    const err = new Error(`AI service error: ${res.status}`);
    err.status = 503;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
};

const parseJson = (raw) => {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
};

exports.analyzeTranscript = async (req, res, next) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });

    const prompt = `You are a payment assistant for an Indian UPI app. Parse the voice command below and respond ONLY with valid JSON (no markdown, no explanation):

{
  "intent": "make_payment" | "check_balance" | "check_history" | "unknown",
  "parameters": { "name": string | null, "amount": number | null },
  "clarification_message": string
}

Rules:
- For make_payment extract recipient name and rupee amount if present
- clarification_message must be a natural sentence asking for what is missing, or "" if all info is present
- Amounts may be spoken as "five hundred", "500 rupees", "₹500" — normalise to a number

Voice command: "${transcript}"`;

    const raw    = await callMistral(prompt, 200);
    const parsed = parseJson(raw);

    if (!parsed) {
      return res.status(422).json({ error: 'Could not parse AI response', raw });
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

    const raw    = await callMistral(prompt, 50);
    const parsed = parseJson(raw);

    res.json(parsed ?? { choice: null });
  } catch (err) {
    next(err);
  }
};
