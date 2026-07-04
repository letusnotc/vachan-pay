-- ============================================================
-- VPay Stripe Integration — Database Migration
-- Run this in: Supabase Dashboard > SQL Editor
-- Safe to run on an existing VPay database (all IF NOT EXISTS).
-- ============================================================

-- ── 1. Add stripe_customer_id to profiles ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON public.profiles(stripe_customer_id);

-- ── 2. Add stripe_payment_intent_id to transactions ─────────────────────────
-- This links a Stripe charge to the VPay transaction record.
-- NULL for old internal wallet transfers, populated for Stripe card payments.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_transactions_stripe_intent
  ON public.transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── 3. Top-up log table ─────────────────────────────────────────────────────
-- Records every wallet top-up via Stripe.
-- Idempotency key: stripe_payment_intent_id (UNIQUE prevents double-credit).
CREATE TABLE IF NOT EXISTS public.topup_log (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount                   DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status                   TEXT        NOT NULL DEFAULT 'completed'
                             CHECK (status IN ('pending', 'completed', 'failed')),
  stripe_payment_intent_id TEXT        UNIQUE NOT NULL,
  stripe_customer_id       TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_log_user_id
  ON public.topup_log(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_log_created_at
  ON public.topup_log(created_at DESC);

-- ── 4. Row Level Security for topup_log ─────────────────────────────────────
ALTER TABLE public.topup_log ENABLE ROW LEVEL SECURITY;

-- Drop and recreate so this is safe to run multiple times
DROP POLICY IF EXISTS "topup_log_select_own" ON public.topup_log;
CREATE POLICY "topup_log_select_own"
  ON public.topup_log FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topup_log TO service_role;

-- ── 5. Atomic wallet credit function (for top-ups) ──────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet_topup(
  p_user_id             UUID,
  p_amount              DECIMAL,
  p_stripe_intent_id    TEXT,
  p_stripe_customer_id  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL;
BEGIN
  -- Idempotency: already credited this intent?
  IF EXISTS (
    SELECT 1 FROM public.topup_log
    WHERE stripe_payment_intent_id = p_stripe_intent_id
  ) THEN
    SELECT wallet_balance INTO v_new_balance
    FROM   public.profiles WHERE user_id = p_user_id;
    RETURN json_build_object('success', true, 'already_done', true, 'new_balance', v_new_balance);
  END IF;

  -- Credit the wallet
  UPDATE public.profiles
  SET    wallet_balance     = wallet_balance + p_amount,
         stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
         updated_at         = NOW()
  WHERE  user_id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  INSERT INTO public.topup_log (
    user_id, amount, status, stripe_payment_intent_id, stripe_customer_id
  ) VALUES (
    p_user_id, p_amount, 'completed', p_stripe_intent_id, p_stripe_customer_id
  );

  RETURN json_build_object('success', true, 'new_balance', v_new_balance, 'amount', p_amount);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- ── 6. Atomic P2P credit function (for card-charged sends) ──────────────────
-- Used by /stripe/confirm-transfer. The sender's card was ALREADY charged by
-- Stripe — this only credits the receiver's wallet_balance and writes the
-- transaction row. It must NOT also debit the sender's wallet_balance
-- (that would require them to have pre-existing balance, which defeats the
-- purpose of a card-funded transfer, and would double-charge them: once via
-- card, once via wallet debit).
CREATE OR REPLACE FUNCTION credit_p2p_card_transfer(
  p_sender_profile_id   UUID,
  p_receiver_profile_id UUID,
  p_amount              DECIMAL,
  p_stripe_intent_id    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance    DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Idempotency: already recorded this charge?
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE stripe_payment_intent_id = p_stripe_intent_id
  ) THEN
    SELECT id INTO v_transaction_id
    FROM   public.transactions WHERE stripe_payment_intent_id = p_stripe_intent_id;
    RETURN json_build_object('success', true, 'already_done', true, 'transaction_id', v_transaction_id);
  END IF;

  -- Lock + credit the receiver only
  UPDATE public.profiles
  SET    wallet_balance = wallet_balance + p_amount,
         updated_at     = NOW()
  WHERE  id = p_receiver_profile_id
  RETURNING wallet_balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Receiver profile not found');
  END IF;

  INSERT INTO public.transactions (
    sender_id, receiver_id, amount, status, stripe_payment_intent_id, note
  ) VALUES (
    p_sender_profile_id, p_receiver_profile_id, p_amount, 'completed', p_stripe_intent_id, 'Card payment via Stripe'
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object('success', true, 'transaction_id', v_transaction_id, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
