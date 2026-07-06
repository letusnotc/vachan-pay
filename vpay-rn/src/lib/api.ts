import axios from 'axios';
import { HmacSHA256 } from 'crypto-js';
import { supabase } from './supabase';

const BASE_URL      = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const SIGNING_SECRET = process.env.EXPO_PUBLIC_APP_SIGNING_SECRET;

// Network Security Layer 4 — only money-moving routes are signed. Matches
// the backend's requestSigning middleware, which is only mounted on these.
const SIGNED_PATHS = [
  '/payment/transfer',
  '/stripe/create-payment-intent',
  '/stripe/confirm-topup',
  '/stripe/create-transfer-intent',
  '/stripe/confirm-transfer',
  '/risk/event',
];

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach the Supabase JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  // HMAC-sign money-moving requests so a captured/replayed request can't be
  // resubmitted, and binds the request body to this specific attempt.
  const path = (config.url ?? '').split('?')[0];
  if (SIGNING_SECRET && SIGNED_PATHS.some((p) => path.endsWith(p))) {
    const timestamp = Date.now().toString();
    const body      = JSON.stringify(config.data ?? '');
    const signature = HmacSHA256(`${timestamp}.${body}`, SIGNING_SECRET).toString();

    config.headers['X-Timestamp'] = timestamp;
    config.headers['X-Signature'] = signature;
  }

  return config;
});

// Sign out on 401 so the user is returned to the login screen
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await supabase.auth.signOut();
    }
    return Promise.reject(err);
  }
);
