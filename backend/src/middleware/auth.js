const { supabase } = require('../config/supabase');

// Uses Supabase admin client to verify the token — works with any signing
// algorithm (HS256, ECC P-256, or whatever Supabase migrates to next).
module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = header.slice(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      id:    user.id,
      phone: user.phone  || null,
      email: user.email  || null
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
