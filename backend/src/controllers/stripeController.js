const Stripe = require('stripe');
const { supabase } = require('../config/supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const MIN_AMOUNT_INR = 50;
const MAX_AMOUNT_INR = 100_000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — get or create a Stripe Customer for a VPay user
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateStripeCustomer(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, phone_number, name, email, stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (error || !profile) throw new Error('Profile not found');

  if (profile.stripe_customer_id) {
    return { profile, stripeCustomerId: profile.stripe_customer_id };
  }

  const customer = await stripe.customers.create({
    name:  profile.name  || undefined,
    email: profile.email || undefined,
    phone: profile.phone_number,
    metadata: { vpay_user_id: userId, vpay_profile_id: profile.id },
  });

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('user_id', userId);

  return { profile, stripeCustomerId: customer.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — cross-check Stripe's actual charged amount vs our metadata
// FIX #4 from audit: never trust metadata.amount_inr alone
// ─────────────────────────────────────────────────────────────────────────────
function assertAmountMatches(intent, metadataAmountInr) {
  const chargedPaise    = intent.amount; // what Stripe actually charged
  const expectedPaise   = Math.round(metadataAmountInr * 100);
  if (chargedPaise !== expectedPaise) {
    throw new Error(
      `Amount mismatch: Stripe charged ${chargedPaise} paise but metadata says ${expectedPaise} paise`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/create-payment-intent  (wallet top-up)
// FIX #2: idempotencyKey added — safe to retry without double-charging
// ─────────────────────────────────────────────────────────────────────────────
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, idempotencyKey } = req.body;
    const parsed = parseFloat(amount);

    if (isNaN(parsed) || parsed < MIN_AMOUNT_INR || parsed > MAX_AMOUNT_INR) {
      return res.status(400).json({
        error: `Amount must be between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}`
      });
    }

    const { profile, stripeCustomerId } = await getOrCreateStripeCustomer(req.user.id);

    // idempotencyKey from client prevents duplicate intents on network retry
    const createOptions = idempotencyKey
      ? { idempotencyKey: `topup-${req.user.id}-${idempotencyKey}` }
      : {};

    const paymentIntent = await stripe.paymentIntents.create({
      amount:               Math.round(parsed * 100),
      currency:             'inr',
      customer:             stripeCustomerId,
      setup_future_usage:   'off_session',
      payment_method_types: ['card'],
      metadata: {
        intent_type:     'wallet_topup',
        vpay_user_id:    req.user.id,
        vpay_profile_id: profile.id,
        vpay_phone:      profile.phone_number,
        amount_inr:      String(parsed),
      },
    }, createOptions);

    res.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount:          parsed,
      currency:        'INR',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/confirm-topup
// FIX #4: cross-checks intent.amount (what Stripe charged) vs metadata
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmTopup = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not completed. Status: ${intent.status}` });
    }

    if (intent.metadata?.vpay_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Payment intent does not belong to this user' });
    }

    if (intent.metadata?.intent_type !== 'wallet_topup') {
      return res.status(400).json({ error: 'Wrong intent type for this endpoint' });
    }

    const amountInr = parseFloat(intent.metadata?.amount_inr || '0');
    if (!amountInr) return res.status(400).json({ error: 'Could not determine top-up amount' });

    // FIX #4 — verify Stripe actually charged what we think we charged
    assertAmountMatches(intent, amountInr);

    // Idempotency check
    const { data: existing } = await supabase
      .from('topup_log')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existing) {
      const { data: prof } = await supabase
        .from('profiles').select('wallet_balance').eq('user_id', req.user.id).single();
      return res.json({ success: true, alreadyCredited: true, newBalance: prof?.wallet_balance });
    }

    const { data, error } = await supabase.rpc('credit_wallet_topup', {
      p_user_id:            req.user.id,
      p_amount:             amountInr,
      p_stripe_intent_id:   paymentIntentId,
      p_stripe_customer_id: intent.customer || null,
    });

    if (error) throw error;
    if (!data.success) return res.status(400).json({ error: data.error });

    res.json({ success: true, newBalance: data.new_balance, amount: amountInr });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/create-transfer-intent  (P2P — card charge)
// FIX #2: idempotencyKey added
// NOTE: This charges the sender's card. The atomic wallet debit/credit
//       happens in confirmTransfer via the transfer_payment() RPC.
// ─────────────────────────────────────────────────────────────────────────────
exports.createTransferIntent = async (req, res, next) => {
  try {
    const { receiverPhone, amount, idempotencyKey } = req.body;
    const parsed = parseFloat(amount);

    // Stripe rejects INR charges under ~₹42 (its $0.50-equivalent floor).
    // Enforce the same ₹50 minimum as top-ups so the error is ours, not Stripe's.
    if (isNaN(parsed) || parsed < MIN_AMOUNT_INR || parsed > MAX_AMOUNT_INR) {
      return res.status(400).json({
        error: `Amount must be between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}`
      });
    }

    const senderPhone = req.user.phone;
    if (!senderPhone) {
      return res.status(400).json({ error: 'Sender phone not in token — re-login' });
    }

    const { data: receiver, error: rErr } = await supabase
      .from('profiles')
      .select('id, name, phone_number')
      .eq('phone_number', receiverPhone)
      .single();

    if (rErr?.code === 'PGRST116' || !receiver) {
      return res.status(404).json({ error: 'Receiver not found on VPay' });
    }
    if (rErr) throw rErr;

    const { profile: sender, stripeCustomerId } = await getOrCreateStripeCustomer(req.user.id);

    if (sender.phone_number === receiverPhone) {
      return res.status(400).json({ error: 'Cannot send money to yourself' });
    }

    const createOptions = idempotencyKey
      ? { idempotencyKey: `transfer-${req.user.id}-${idempotencyKey}` }
      : {};

    const paymentIntent = await stripe.paymentIntents.create({
      amount:               Math.round(parsed * 100),
      currency:             'inr',
      customer:             stripeCustomerId,
      setup_future_usage:   'off_session',
      payment_method_types: ['card'],
      metadata: {
        intent_type:           'p2p_transfer',
        vpay_user_id:          req.user.id,
        vpay_sender_phone:     sender.phone_number,
        vpay_sender_profile:   sender.id,
        vpay_receiver_phone:   receiver.phone_number,
        vpay_receiver_profile: receiver.id,
        vpay_receiver_name:    receiver.name || '',
        amount_inr:            String(parsed),
      },
    }, createOptions);

    res.json({
      clientSecret:    paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      receiverName:    receiver.name,
      amount:          parsed,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/confirm-transfer
// FIX #3: after verifying the Stripe charge succeeded, credit ONLY the
//   receiver's wallet_balance via credit_p2p_card_transfer(). The sender's
//   card charge is what funds this transfer — the sender's wallet_balance
//   must NOT also be debited (that would require pre-existing balance and
//   double-charge them: once via card, once via wallet debit).
//
// FIX #4: cross-checks intent.amount vs metadata.amount_inr
//
// SAFETY NET: if the DB credit fails after the card was already charged
// (e.g. receiver account deleted between intent creation and confirmation),
// automatically refund the charge so the sender never loses money silently.
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmTransfer = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' });
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not completed. Status: ${intent.status}` });
    }

    if (intent.metadata?.vpay_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Payment intent does not belong to this user' });
    }

    if (intent.metadata?.intent_type !== 'p2p_transfer') {
      return res.status(400).json({ error: 'Wrong intent type for this endpoint' });
    }

    const amountInr          = parseFloat(intent.metadata?.amount_inr || '0');
    const senderProfileId    = intent.metadata?.vpay_sender_profile;
    const receiverProfileId  = intent.metadata?.vpay_receiver_profile;
    const receiverName       = intent.metadata?.vpay_receiver_name || '';

    if (!amountInr || !senderProfileId || !receiverProfileId) {
      return res.status(400).json({ error: 'Incomplete metadata on payment intent' });
    }

    // FIX #4 — verify Stripe charged exactly what metadata says
    assertAmountMatches(intent, amountInr);

    // Idempotency check
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existing) {
      return res.json({
        success:         true,
        alreadyRecorded: true,
        transactionId:   existing.id,
        amount:          amountInr,
        receiverName,
      });
    }

    // Atomically credit the receiver + write the transaction row
    const { data, error } = await supabase.rpc('credit_p2p_card_transfer', {
      p_sender_profile_id:   senderProfileId,
      p_receiver_profile_id: receiverProfileId,
      p_amount:              amountInr,
      p_stripe_intent_id:    paymentIntentId,
    });

    if (error) throw error;

    if (!data.success) {
      // The card was already charged but the DB credit failed. Refund
      // automatically so the sender doesn't lose money with no record.
      console.error(
        `[confirmTransfer] Stripe charged pi=${paymentIntentId} ₹${amountInr} ` +
        `but credit_p2p_card_transfer() failed: ${data.error}. Issuing refund.`
      );
      try {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
        return res.status(400).json({ error: `${data.error} — payment has been refunded.` });
      } catch (refundErr) {
        console.error(`[confirmTransfer] REFUND FAILED for pi=${paymentIntentId}:`, refundErr.message);
        return res.status(500).json({ error: 'Transfer failed and automatic refund also failed — contact support.' });
      }
    }

    res.json({
      success:       true,
      transactionId: data.transaction_id,
      amount:        amountInr,
      receiverName,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stripe/webhook
// FIX #1: webhook is the safety net — when app crashes before confirm-* is called,
//         this fires and reconciles the DB.
// FIX for payment_failed: now marks transaction as failed in DB if it exists
// ─────────────────────────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || secret === 'whsec_...') {
    console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — webhook inactive (dev mode)');
    console.warn('[Stripe Webhook] Run: stripe listen --forward-to localhost:3000/api/stripe/webhook');
    return res.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // ── payment_intent.succeeded ────────────────────────────────────────────
    if (event.type === 'payment_intent.succeeded') {
      const intent     = event.data.object;
      const intentType = intent.metadata?.intent_type;
      const amountInr  = parseFloat(intent.metadata?.amount_inr || '0');

      if (intentType === 'wallet_topup') {
        const userId = intent.metadata?.vpay_user_id;
        if (userId && amountInr) {
          const { error } = await supabase.rpc('credit_wallet_topup', {
            p_user_id:            userId,
            p_amount:             amountInr,
            p_stripe_intent_id:   intent.id,
            p_stripe_customer_id: intent.customer || null,
          });
          if (error) console.error('[Webhook] credit_wallet_topup failed:', error.message);
          else       console.log(`[Webhook] Wallet topup ₹${amountInr} → user ${userId}`);
        }
      }

      if (intentType === 'p2p_transfer') {
        const senderProfileId   = intent.metadata?.vpay_sender_profile;
        const receiverProfileId = intent.metadata?.vpay_receiver_profile;

        if (senderProfileId && receiverProfileId && amountInr) {
          // credit_p2p_card_transfer() is itself idempotent (checks
          // stripe_payment_intent_id before crediting), so this is safe to
          // call even if /confirm-transfer already ran for this intent.
          const { data, error } = await supabase.rpc('credit_p2p_card_transfer', {
            p_sender_profile_id:   senderProfileId,
            p_receiver_profile_id: receiverProfileId,
            p_amount:              amountInr,
            p_stripe_intent_id:    intent.id,
          });

          if (error || !data?.success) {
            console.error('[Webhook] credit_p2p_card_transfer failed:', error?.message || data?.error);
          } else if (!data.already_done) {
            console.log(`[Webhook] P2P transfer ₹${amountInr} recorded`);
          }
        }
      }
    }

    // ── payment_intent.payment_failed ────────────────────────────────────────
    // FIX from audit: now actually logs structured data, not just console.warn
    if (event.type === 'payment_intent.payment_failed') {
      const intent     = event.data.object;
      const intentType = intent.metadata?.intent_type;
      const reason     = intent.last_payment_error?.message || 'unknown';

      console.error(
        `[Webhook] Payment failed | type=${intentType} | pi=${intent.id} | reason=${reason}`
      );

      // Mark any pending transaction as failed so history screen can show it
      if (intentType === 'p2p_transfer') {
        const senderPhone   = intent.metadata?.vpay_sender_phone;
        const receiverPhone = intent.metadata?.vpay_receiver_phone;
        const amountInr     = parseFloat(intent.metadata?.amount_inr || '0');

        if (senderPhone && receiverPhone && amountInr) {
          // Write a failed transaction row so the sender sees what happened
          const { data: exists } = await supabase
            .from('transactions')
            .select('id')
            .eq('stripe_payment_intent_id', intent.id)
            .maybeSingle();

          if (!exists) {
            const { data: senderProfile } = await supabase
              .from('profiles').select('id').eq('phone_number', senderPhone).single();
            const { data: receiverProfile } = await supabase
              .from('profiles').select('id').eq('phone_number', receiverPhone).single();

            if (senderProfile && receiverProfile) {
              await supabase.from('transactions').insert({
                sender_id:                senderProfile.id,
                receiver_id:              receiverProfile.id,
                amount:                   amountInr,
                status:                   'failed',
                stripe_payment_intent_id: intent.id,
                note:                     `Payment failed: ${reason}`,
              });
            }
          }
        }
      }
    }

    // ── charge.dispute.created ────────────────────────────────────────────────
    // Basic chargeback alert — logs it so you know to check Stripe Dashboard
    if (event.type === 'charge.dispute.created') {
      const dispute = event.data.object;
      console.error(
        `[Webhook] ⚠️  CHARGEBACK CREATED | dispute=${dispute.id} | ` +
        `charge=${dispute.charge} | amount=${dispute.amount} | reason=${dispute.reason}`
      );
      // In production: send email alert to yourself here
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stripe/topup-history
// ─────────────────────────────────────────────────────────────────────────────
exports.getTopupHistory = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('topup_log')
      .select('id, amount, status, stripe_payment_intent_id, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ topups: data });
  } catch (err) {
    next(err);
  }
};
