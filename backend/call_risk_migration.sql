-- ============================================================
-- VPay — Call-Risk Audit Trail (mic-occupancy / "on a call" events)
-- Run this in: Supabase Dashboard > SQL Editor
-- Safe to run on an existing VPay database (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================
--
-- Records every time the app detects the microphone is occupied (almost always
-- an active phone / VoIP call) and warns the user, plus what the user then did.
-- Purpose: a tamper-resistant, server-owned evidence trail for scam scenarios
-- where a victim is walked through a payment while on a call.

CREATE TABLE IF NOT EXISTS public.call_risk_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Where the warning fired.
  --   proactive_warning : shown automatically on app open / return-to-foreground
  --   payment_warning   : shown at the moment a payment was about to be sent
  event_type     TEXT        NOT NULL CHECK (event_type IN ('proactive_warning', 'payment_warning')),

  -- What the user did with the warning.
  outcome        TEXT        NOT NULL CHECK (outcome IN ('shown', 'acknowledged', 'proceeded', 'cancelled')),

  -- Evidence: the loudest mic level measured during detection (dBFS, ~ -160..0).
  mic_peak_db    NUMERIC(6,1),

  -- Optional payment context (only present for payment_warning events).
  receiver_phone TEXT,
  amount         NUMERIC(12,2),

  -- Optional captured voice-command text, if one was involved.
  transcript     TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_risk_events_profile
  ON public.call_risk_events (profile_id, created_at DESC);

-- Only the backend (service_role) ever touches this table — no client policies.
ALTER TABLE public.call_risk_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.call_risk_events TO service_role;

-- Insert an event, resolving profile_id from the authenticated user_id INSIDE
-- the function (SECURITY DEFINER) so a caller can never log against someone
-- else's profile. Free-text fields are length-capped defensively.
CREATE OR REPLACE FUNCTION log_call_risk_event(
  p_user_id        UUID,
  p_event_type     TEXT,
  p_outcome        TEXT,
  p_mic_peak_db    NUMERIC DEFAULT NULL,
  p_receiver_phone TEXT    DEFAULT NULL,
  p_amount         NUMERIC DEFAULT NULL,
  p_transcript     TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_event_id   UUID;
BEGIN
  SELECT id INTO v_profile_id
  FROM   public.profiles
  WHERE  user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  INSERT INTO public.call_risk_events
    (profile_id, event_type, outcome, mic_peak_db, receiver_phone, amount, transcript)
  VALUES
    (v_profile_id, p_event_type, p_outcome, p_mic_peak_db, p_receiver_phone, p_amount,
     LEFT(p_transcript, 500))
  RETURNING id INTO v_event_id;

  RETURN json_build_object('success', true, 'event_id', v_event_id);
END;
$$;
