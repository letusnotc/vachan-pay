-- ============================================================
-- VPay Security Hardening — Database Migration
-- Run this in: Supabase Dashboard > SQL Editor
-- Safe to run on an existing VPay database (all IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================

-- ── C-2: Idempotency key for /payment/transfer ──────────────────────────────
-- Client sends an Idempotency-Key header (UUID per attempt). A network retry
-- or replayed request with the same key returns the original result instead
-- of creating a second debit/credit.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE OR REPLACE FUNCTION transfer_payment(
  p_sender_phone    TEXT,
  p_receiver_phone  TEXT,
  p_amount          DECIMAL,
  p_idempotency_key TEXT DEFAULT NULL
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
  -- Idempotency: if this exact key was already used, return the prior result
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM   transactions
    WHERE  idempotency_key = p_idempotency_key;

    IF v_transaction_id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'already_done', true, 'transaction_id', v_transaction_id);
    END IF;
  END IF;

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
  INSERT INTO transactions (sender_id, receiver_id, amount, status, idempotency_key)
  VALUES (v_sender_id, v_receiver_id, p_amount, 'completed', p_idempotency_key)
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

-- ── C-3: PIN lockout tracking ────────────────────────────────────────────────
-- Tracks failed PIN attempts per phone number. After 5 failures, lock for 15
-- minutes. Independent of Supabase Auth's own state — this is app-level.
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  phone_number    TEXT        PRIMARY KEY,
  failed_count    INT         NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
-- No client-facing policies — only the backend (service_role) touches this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pin_attempts TO service_role;

-- Returns {locked: bool, retry_after_seconds: int|null}
CREATE OR REPLACE FUNCTION check_pin_lockout(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM   public.pin_attempts
  WHERE  phone_number = p_phone;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN json_build_object(
      'locked', true,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_locked_until - NOW()))::INT
    );
  END IF;

  RETURN json_build_object('locked', false);
END;
$$;

-- Records a failed PIN attempt. Locks for 15 minutes after the 5th failure.
CREATE OR REPLACE FUNCTION record_pin_failure(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.pin_attempts (phone_number, failed_count, updated_at)
  VALUES (p_phone, 1, NOW())
  ON CONFLICT (phone_number) DO UPDATE
    SET failed_count = pin_attempts.failed_count + 1,
        updated_at   = NOW()
  RETURNING failed_count INTO v_count;

  IF v_count >= 5 THEN
    UPDATE public.pin_attempts
    SET    locked_until = NOW() + INTERVAL '15 minutes',
           failed_count = 0
    WHERE  phone_number = p_phone;
    RETURN json_build_object('locked', true, 'retry_after_seconds', 900);
  END IF;

  RETURN json_build_object('locked', false, 'attempts_remaining', 5 - v_count);
END;
$$;

-- Clears failed-attempt state after a successful PIN sign-in.
CREATE OR REPLACE FUNCTION clear_pin_failures(p_phone TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.pin_attempts WHERE phone_number = p_phone;
$$;

-- ── H-2: per-user daily lookup limit ─────────────────────────────────────────
-- Tracks how many /payment/lookup/:phone calls each user has made today.
CREATE TABLE IF NOT EXISTS public.lookup_log (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day         DATE        NOT NULL DEFAULT CURRENT_DATE,
  count       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.lookup_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lookup_log TO service_role;

-- Returns {allowed: bool, count: int}. Increments atomically.
CREATE OR REPLACE FUNCTION increment_lookup_count(p_user_id UUID, p_daily_limit INT DEFAULT 20)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.lookup_log (user_id, day, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET count = lookup_log.count + 1
  RETURNING count INTO v_count;

  IF v_count > p_daily_limit THEN
    RETURN json_build_object('allowed', false, 'count', v_count);
  END IF;

  RETURN json_build_object('allowed', true, 'count', v_count);
END;
$$;
