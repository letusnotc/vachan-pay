const { supabase } = require('../config/supabase');

// Records a call-risk event (mic detected busy → user warned) as a server-owned
// audit trail. profile_id is resolved from the auth token inside the RPC, never
// taken from the client, so an event can only ever be logged against the caller.
exports.logEvent = async (req, res, next) => {
  try {
    const { eventType, outcome, micPeakDb, receiverPhone, amount, transcript } = req.body;

    const { data, error } = await supabase.rpc('log_call_risk_event', {
      p_user_id:        req.user.id,
      p_event_type:     eventType,
      p_outcome:        outcome,
      p_mic_peak_db:    micPeakDb    ?? null,
      p_receiver_phone: receiverPhone ?? null,
      p_amount:         amount       ?? null,
      p_transcript:     transcript   ?? null,
    });

    if (error) throw error;

    // Never trust the RPC's shape blindly — validate before use.
    if (!data || typeof data.success !== 'boolean') {
      throw new Error('Unexpected response shape from log_call_risk_event()');
    }
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.status(201).json({ success: true, eventId: data.event_id });
  } catch (err) {
    next(err);
  }
};
