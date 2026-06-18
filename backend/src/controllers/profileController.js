const { supabase } = require('../config/supabase');

exports.getProfile = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, phone_number, name, email, wallet_balance, created_at')
      .eq('user_id', req.user.id)
      .single();

    if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Profile not found' });
    if (error) throw error;

    res.json({ profile: data });
  } catch (err) {
    next(err);
  }
};

exports.upsertProfile = async (req, res, next) => {
  console.log('[profile] upsert → user_id:', req.user.id, '| phone:', req.user.phone);
  try {
    const { name, email } = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id:      req.user.id,
          phone_number: req.user.phone,
          name:         name.trim(),
          email:        email?.trim() || null,
          updated_at:   new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select('id, phone_number, name, email, wallet_balance')
      .single();

    if (error) throw error;

    res.json({ profile: data });
  } catch (err) {
    next(err);
  }
};

exports.getBalance = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;

    res.json({ balance: data.wallet_balance });
  } catch (err) {
    next(err);
  }
};
