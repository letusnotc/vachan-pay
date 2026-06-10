-- ============================================================
-- VPay Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Profiles table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  phone_number     TEXT UNIQUE NOT NULL,
  name             TEXT,
  email            TEXT,
  wallet_balance   DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID REFERENCES profiles(id) NOT NULL,
  receiver_id  UUID REFERENCES profiles(id) NOT NULL,
  amount       DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone      ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_transactions_sender  ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(created_at DESC);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users access only their own row
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Transactions: users see only transactions they're party to
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT USING (
  sender_id   IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================================
-- Atomic transfer function (SECURITY DEFINER bypasses RLS so
-- it can read/write both the sender and receiver rows)
-- ============================================================
CREATE OR REPLACE FUNCTION transfer_payment(
  p_sender_phone   TEXT,
  p_receiver_phone TEXT,
  p_amount         DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id      UUID;
  v_receiver_id    UUID;
  v_sender_balance DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Lock sender row to prevent race conditions, grab balance
  SELECT id, wallet_balance
  INTO   v_sender_id, v_sender_balance
  FROM   profiles
  WHERE  phone_number = p_sender_phone
  FOR UPDATE;

  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Sender not found');
  END IF;

  IF v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Get receiver (no lock needed — we only credit them)
  SELECT id INTO v_receiver_id
  FROM   profiles
  WHERE  phone_number = p_receiver_phone;

  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Receiver not found on VPay');
  END IF;

  IF v_sender_id = v_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Atomic debit + credit
  UPDATE profiles
  SET    wallet_balance = wallet_balance - p_amount,
         updated_at     = NOW()
  WHERE  id = v_sender_id;

  UPDATE profiles
  SET    wallet_balance = wallet_balance + p_amount,
         updated_at     = NOW()
  WHERE  id = v_receiver_id;

  -- Record transaction
  INSERT INTO transactions (sender_id, receiver_id, amount, status)
  VALUES (v_sender_id, v_receiver_id, p_amount, 'completed')
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success',        true,
    'transaction_id', v_transaction_id,
    'amount',         p_amount
  );

EXCEPTION WHEN OTHERS THEN
  RAISE; -- rolls back the transaction automatically
END;
$$;
