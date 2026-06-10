const { supabase } = require('../config/supabase');

exports.transfer = async (req, res, next) => {
  try {
    const { receiverPhone, amount } = req.body;
    const senderPhone = req.user.phone;

    if (!senderPhone) {
      return res.status(400).json({ error: 'Sender phone not found in token' });
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Delegate the entire debit+credit to the atomic PostgreSQL function
    const { data, error } = await supabase.rpc('transfer_payment', {
      p_sender_phone:   senderPhone,
      p_receiver_phone: receiverPhone,
      p_amount:         parsed
    });

    if (error) throw error;

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

exports.lookupReceiver = async (req, res, next) => {
  try {
    const { phone } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('name, phone_number')
      .eq('phone_number', phone)
      .single();

    if (error?.code === 'PGRST116' || !data) {
      return res.status(404).json({ error: 'User not found on VPay' });
    }
    if (error) throw error;

    res.json({ user: data });
  } catch (err) {
    next(err);
  }
};
