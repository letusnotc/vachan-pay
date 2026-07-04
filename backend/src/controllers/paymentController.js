const { supabase } = require('../config/supabase');

exports.transfer = async (req, res, next) => {
  try {
    const { receiverPhone, amount } = req.body;
    const senderPhone = req.user.phone;

    // C-2: client sends a UUID per attempt in this header. A network retry
    // or replayed request with the same key returns the original result
    // instead of creating a second debit/credit.
    const idempotencyKey = req.headers['idempotency-key'] || null;

    if (!senderPhone) {
      return res.status(400).json({ error: 'Sender phone not found in token' });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Delegate the entire debit+credit to the atomic PostgreSQL function
    const { data, error } = await supabase.rpc('transfer_payment', {
      p_sender_phone:    senderPhone,
      p_receiver_phone:  receiverPhone,
      p_amount:          parsed,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw error;

    // M-4: never trust the RPC's shape blindly — validate before use
    if (!data || typeof data.success !== 'boolean') {
      throw new Error('Unexpected response shape from transfer_payment()');
    }

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({
      success:       true,
      transactionId: data.transaction_id,
      amount:        parsed
    });
  } catch (err) {
    next(err);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pErr || !profile) return res.status(404).json({ error: 'Profile not found' });

    const { data: txns, error } = await supabase
      .from('transactions')
      .select(`
        id, amount, status, created_at,
        sender:profiles!sender_id(name, phone_number),
        receiver:profiles!receiver_id(name, phone_number)
      `)
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const annotated = txns.map(t => ({
      ...t,
      type: t.sender?.phone_number === req.user.phone ? 'sent' : 'received'
    }));

    res.json({ transactions: annotated });
  } catch (err) {
    next(err);
  }
};

// H-2: any authenticated user could previously enumerate whether any phone
// is registered AND get the account holder's full name. Now: boolean only,
// and capped at 20 lookups/day per user to blunt enumeration attempts.
exports.lookupReceiver = async (req, res, next) => {
  try {
    const { phone } = req.params;

    const { data: limitData, error: limitErr } = await supabase.rpc('increment_lookup_count', {
      p_user_id: req.user.id,
    });
    if (limitErr) throw limitErr;
    if (!limitData?.allowed) {
      return res.status(429).json({ error: 'Daily lookup limit reached — try again tomorrow' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'User not found on VPay' });
    }

    res.json({ exists: true });
  } catch (err) {
    next(err);
  }
};
