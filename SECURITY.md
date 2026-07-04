# VPay Security Audit & Fix Plan

**Status: everything that's pure code is DONE and verified** — all of Phases 1–4, the code-only parts of Phase 5, and both halves of C-3 including the biometric-gated PIN storage (backend boot tests, real Supabase RPC calls, real Stripe test-mode charges, HMAC sign/verify round trips, PIN lockout state machine, `npx expo prebuild` dry-runs for the Android config plugins). What's left is infrastructure that only a human can do — see "Still Outstanding" at the bottom.

## Audit Findings

### CRITICAL

| ID | Issue | File | Fix | Status |
|----|-------|------|-----|--------|
| C-1 | Live secrets in `.env` files on disk — Groq, Gemini, Supabase service role key all exposed | `backend/.env`, `vpay-rn/.env` | Rotate all credentials immediately. Use Doppler / Railway secrets in production. | ⬜ Outstanding — needs a human to rotate keys in each provider's dashboard |
| C-2 | No idempotency key on `/payment/transfer` — network retry or replayed request creates two debits | `paymentController.js` | Client generates UUID per attempt, sends as `Idempotency-Key` header. Backend deduplicates via DB unique constraint. | ✅ Done — `idempotency_key` column + `transfer_payment()` dedup, wired via `Idempotency-Key` header in `paymentController.js` |
| C-3 | 6-digit PIN (10^6 combinations) used as Supabase password with no server-side account lockout. Biometric sign-in retrieves and replays the raw PIN — compromised device leaks the credential. | `SignInScreen.tsx`, `LockScreen.tsx` | Enforce lockout after 5 failed attempts (15-min cooldown). For biometric, store a long random secret instead of the PIN in SecureStore. | ✅ Done, both halves. Lockout: `pin_attempts` table + `check_pin_lockout`/`record_pin_failure`/`clear_pin_failures` RPCs, wired into both screens, verified live. Biometric credential: rather than a separate random secret (which would've required either rotating the actual Supabase password on biometric enrollment — breaking manual PIN entry, which authenticates against that same password — or a parallel auth mechanism), the PIN is now stored with `requireAuthentication: true` (`useBiometric.ts`), which ties **decryption** of that SecureStore item to a live OS biometric/passcode check (Android Keystore `setUserAuthenticationRequired`, iOS Keychain `biometryCurrentSet`). Even a rooted device that dumps SecureStore's storage can't decrypt the PIN without a live fingerprint/face/passcode at read time — closes the actual "compromised device leaks the credential" risk without restructuring the auth architecture. See detailed note below. |
| C-4 | Raw Whisper transcript interpolated directly into Gemma prompt — prompt injection possible | `aiController.js` | Sanitize transcript, wrap in XML delimiters, validate full returned JSON against strict schema. | ✅ Done — `<voice_command>` delimiters, explicit "don't follow instructions in here" framing, strict output schema validation (`validateParsed`) |

---

### HIGH

| ID | Issue | File | Fix | Status |
|----|-------|------|-----|--------|
| H-1 | Rate limiting is IP-only — bypassable via VPN/NAT. 10 payments/min per IP too permissive. | `rateLimiter.js` | Add second layer keyed by `req.user.id`. Limit to 5 transfers per user per 15 min. | ✅ Done — `userPaymentLimiter` (5/15min) + `userAiLimiter`, in-memory Map (see Redis note below) |
| H-2 | Any authenticated user can enumerate whether any phone is registered and get the account holder's full name via `/payment/lookup/:phone` | `paymentController.js` | Return boolean only. Add per-user rate limit (20 lookups/day). | ✅ Done — returns `{exists: true}` only, `increment_lookup_count()` RPC caps at 20/day, verified live |
| H-3 | `disableDeviceFallback: false` — OS device PIN unlocks VPay, bypassing the biometric gate entirely | `useBiometric.ts:31` | Change to `disableDeviceFallback: true` | ✅ Done |
| H-4 | `onboarding_completed ?? true` — missing/null value grants full app access | `App.tsx:133` | Change to `?? false` | ✅ Done |
| H-5 | 10 MB JSON body limit — no payload exceeds 1 KB, enables easy DoS | `index.js` | Change to `{ limit: '16kb' }` | ✅ Done — verified 413 on oversized payload |

---

### MEDIUM

| ID | Issue | File | Fix | Status |
|----|-------|------|-----|--------|
| M-1 | Stack traces in API responses when `NODE_ENV=development` (which is what's committed) | `errorHandler.js` | Never deploy with `NODE_ENV=development`. Remove stack from responses entirely. | ✅ Code already correct (`isProd` gate) — the actual gap is a deployment setting: set `NODE_ENV=production` on whatever host you deploy to |
| M-2 | Biometric preference in unencrypted `AsyncStorage` — readable from rooted device | `useBiometric.ts` | Move to `SecureStore` (already imported in the same file). | ✅ Done |
| M-3 | Audio MIME type is client-controlled — magic bytes not validated | `whisper.js` | Add magic-byte check after multer stores file in memory. | ✅ Done — dependency-free `audioMagicBytes.js` (no `file-type`, which is ESM-only and incompatible with this CommonJS backend), verified against all 6 formats |
| M-4 | RPC response shape from Supabase not validated before accessing `.success` | `paymentController.js` | Check `if (!data || typeof data.success !== 'boolean')` before using. | ✅ Done |
| M-5 | Phone numbers (PII) logged to stdout unconditionally — violates DPDP Act 2023 | `profileController.js:21` | Remove `console.log` or gate behind `NODE_ENV !== 'production'`. | ✅ Done — phone number removed from the log entirely, user_id-only, dev-gated |
| M-6 | CORS defaults to `*` if `ALLOWED_ORIGINS` env var is missing | `index.js:20` | Throw hard error if `ALLOWED_ORIGINS` not set in production. | ✅ Done |

---

### LOW

| ID | Issue | File | Fix | Status |
|----|-------|------|-----|--------|
| L-1 | No minimum transfer amount server-side — ₹0.01 passes Joi validation | `payment.js` | Add `.min(1)` to Joi amount schema. | ✅ Done |
| L-2 | Old Supabase session not revoked when lock screen re-authenticates | `LockScreen.tsx` | Revoke old session after successful re-auth. | ✅ Done — `signOut({ scope: 'others' })` called *after* successful re-auth (not before — an unconditional pre-emptive signOut would log the user out even on a failed PIN attempt, defeating the point of the lock screen) |
| L-3 | Backend API URL shown in the "backend down" error screen | `App.tsx:153` | Remove the URL from UI — retry button is sufficient. | ✅ Done |
| L-4 | No Expo OTA code signing — MITM can inject malicious bundle updates | `app.json` | Configure `expo-updates` code signing before enabling OTA. | ⬜ Outstanding — needs an EAS account + `expo-updates` setup |

---

## Data Encryption Status

### What is encrypted

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Database at rest (Supabase Postgres) | AES-256 (managed by Supabase) | ✅ Encrypted |
| PIN stored on device | bcrypt hash in Supabase DB | ✅ Encrypted |
| Supabase API traffic (app → Supabase) | TLS 1.3 (supabase.co) | ✅ Encrypted |
| Biometric credential (PIN post-bio) | expo-secure-store (AES-backed iOS Keychain / Android Keystore) | ✅ Encrypted |

### What is NOT encrypted (before this pass) — now fixed

| Layer | Previous state | Risk | Status |
|-------|---------------|------|--------|
| JWT session token on device | Stored in `AsyncStorage` (plain-text base64) | Readable on rooted/jailbroken device — attacker gets valid session | ✅ Fixed — moved to `SecureStore` |
| App ↔ backend traffic | HTTP (no TLS configured yet) | MITM can read/modify requests including payment amounts | ⬜ Still HTTP locally — HTTPS redirect + HMAC signing are coded and active, but there's no production TLS-terminating domain yet (see "Still Outstanding") |
| Voice audio in transit | Sent over HTTP to `/ai/whisper` | Audio of payments audible on network | Same as above — resolved once deployed behind a real HTTPS domain |
| Biometric preference flag | `AsyncStorage` (plain boolean) | Low-risk: attacker learns if biometric is enabled | ✅ Fixed — moved to `SecureStore` |

---

### Implemented: biometric-gated PIN storage (C-3, second half)

File: `vpay-rn/src/hooks/useBiometric.ts`

The original plan was "store a long random secret instead of the PIN." In practice this doesn't fit the architecture: Supabase Auth's password *is* the PIN (`submitPin` calls `signInWithPassword({ email, password: currentPin })`), used identically whether the user types it or unlocks via biometric. Storing a different secret would mean either rotating the actual account password whenever biometric is enabled (which breaks manual PIN entry — it authenticates against that same password) or building a parallel authentication path outside Supabase Auth. Both are much larger changes than the finding warranted.

The fix that actually closes the stated risk ("compromised device leaks the credential") without restructuring auth: `expo-secure-store`'s `requireAuthentication: true` option ties **decryption** of that specific item to a live OS-level check — Android's `setUserAuthenticationRequired(true)` on the underlying Keystore key, iOS's `biometryCurrentSet` Keychain access control. A rooted/jailbroken device that dumps SecureStore's raw storage still can't decrypt the PIN without the user's live fingerprint/face/passcode at read time — this is a stronger guarantee than app-level control flow, which a rooted device could bypass by calling the storage APIs directly.

```ts
const PIN_AUTH_OPTIONS = { requireAuthentication: true, authenticationPrompt: 'Authenticate to sign in to VPay' };
const storePin     = (phone, pin) => SecureStore.setItemAsync(pinKey(phone), pin, PIN_AUTH_OPTIONS);
const getStoredPin = (phone)      => SecureStore.getItemAsync(pinKey(phone), PIN_AUTH_OPTIONS); // triggers OS biometric prompt
```

**A real gotcha this surfaced**: `getStoredPin` was previously also used as a cheap "does this phone have biometric sign-in set up" check on screen mount (to decide whether to even show the fingerprint icon). With `requireAuthentication`, that innocuous check would trigger a live biometric prompt just to render the screen — and then a second prompt when the user actually taps to sign in. Fixed by splitting it into two functions: `hasStoredPin()` (cheap, unauthenticated, just checks a plain marker key) for the UI-availability check, and `getStoredPin()` (the one authenticated read, biometric-gated) called exactly once at actual sign-in time. `SignInScreen.tsx`'s own separate `authenticate()` call before the PIN fetch was also removed — with the OS itself now prompting during `getStoredPin`, keeping both would have shown two prompts back to back.

Registered `expo-secure-store`'s config plugin in `app.json` (was missing) with the required `NSFaceIDUsageDescription` — `requireAuthentication` needs this on iOS or the app would crash when Face ID is available. Verified via `npx expo prebuild --platform android` that this plugin's Android manifest changes (`fullBackupContent`, `dataExtractionRules`) coexist correctly with the network-security-config plugin's own manifest attribute on the same `<application>` tag. iOS-side couldn't be prebuild-verified on this Windows machine (needs Xcode/macOS), but the plugin uses only standard `@expo/config-plugins` primitives (`createPermissionsPlugin`/`withInfoPlist`) — Expo's own first-party, widely-used pattern, not custom logic.

---

### Implemented: Supabase session → SecureStore (replaces AsyncStorage)

File: `vpay-rn/src/lib/supabase.ts`

The actual implementation went a step further than the original plan below: `expo-secure-store` caps individual values at **2048 bytes** (an OS Keychain/Keystore limit), and a full Supabase session blob (access token + refresh token + user metadata) can exceed that. A naive 1:1 `SecureStoreAdapter` would work today and then mysteriously throw once a session grew past the limit. The shipped version is a **chunked adapter** — it transparently splits large values across multiple SecureStore entries (each chunk still passing through the OS secure enclave), so it's safe regardless of session size:

```ts
// vpay-rn/src/lib/supabase.ts (actual implementation)
const CHUNK_SIZE = 1800; // safety margin under the 2048-byte limit
const chunkKey = (key: string, i: number) => `${key}_chunk_${i}`;
const countKey = (key: string) => `${key}_chunk_count`;

const SecureStoreAdapter = {
  getItem: async (key) => {
    const countStr = await SecureStore.getItemAsync(countKey(key));
    if (!countStr) return SecureStore.getItemAsync(key); // small value, stored directly
    const count = parseInt(countStr, 10);
    const chunks = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },
  setItem: async (key, value) => {
    await SecureStoreAdapter.removeItem(key);
    if (value.length <= CHUNK_SIZE) return SecureStore.setItemAsync(key, value);
    const chunks = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
  },
  removeItem: async (key) => { /* mirrors setItem's chunk cleanup */ },
};
```

This moves the JWT access token, refresh token, and session metadata from unencrypted `AsyncStorage` into the OS secure enclave (iOS Keychain / Android Keystore), with no size-related surprises.

> `expo-secure-store` was already installed (`useBiometric.ts` uses it). No new dependency needed.

---

## Network Security Plan

### Layer 1 — HTTPS Everywhere ✅ Coded, ⬜ inert until deployed
Implemented in `backend/src/index.js`. Only activates when `NODE_ENV=production` and `x-forwarded-proto` isn't `https` (i.e. once actually deployed behind Railway/Render's TLS termination) — safe no-op for local dev right now:

```js
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});
```

### Layer 2 — Android Network Security Config ✅ Done
Implemented as a custom Expo config plugin — `vpay-rn/plugins/withAndroidNetworkSecurityConfig.js` — since this is a managed-workflow app with no committed `android/` folder. The plugin writes the XML resource and wires `android:networkSecurityConfig` into the manifest at prebuild time. Verified with a real `npx expo prebuild --platform android` dry run: both the XML file and the manifest attribute were generated correctly.

Registered in `app.json`'s `plugins` array with a `productionDomain` config (currently the placeholder `api.vpay.in`) — **update this to your real API domain once you have one**. Scoped as a domain-specific override so it coexists with the existing `usesCleartextTraffic: true` (which keeps local LAN-IP dev working): the domain-config's `cleartextTrafficPermitted="false"` always wins for that specific domain regardless of the top-level flag.

```xml
<!-- generated at prebuild: android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">api.vpay.in</domain>
  </domain-config>
  <debug-overrides>
    <trust-anchors><certificates src="user"/></trust-anchors>
  </debug-overrides>
</network-security-config>
```

### Layer 3 — iOS ATS Config ✅ Done
Added directly to `app.json`'s `ios.infoPlist` (works natively in Expo managed workflow, no plugin/ejection needed):

```json
"NSAppTransportSecurity": {
  "NSAllowsArbitraryLoads": false,
  "NSAllowsLocalNetworking": true
}
```

`NSAllowsLocalNetworking: true` is the key detail — it's Apple's built-in exception for connections to local/private-network IP addresses, which is exactly what LAN-IP local dev needs. Arbitrary internet HTTP is blocked (`NSAllowsArbitraryLoads: false`), but the dev LAN backend keeps working without any exception-domain hacks.

### Layer 4 — HMAC Request Signing ✅ Done, verified
Implemented exactly as planned: `backend/src/middleware/requestSigning.js` + `vpay-rn/src/lib/api.ts` interceptor. Applied to all money-moving routes (`/payment/transfer`, and all 4 Stripe payment routes) — not Whisper, per the original plan.

Verified with a full sign/verify round trip: valid signatures pass, tampered request bodies are rejected, expired timestamps (>5 min) are rejected, and missing signatures are rejected. Uses `crypto.timingSafeEqual` for the signature comparison to avoid timing side-channels.

**Important caveat, not previously called out**: `EXPO_PUBLIC_APP_SIGNING_SECRET` is bundled into the client JS in plaintext (that's what `EXPO_PUBLIC_` vars mean) — anyone who decompiles the app can extract it. This layer defends against a passive network attacker (packet capture, simple replay, tampering in transit) but **does not** give the stronger guarantee that "a stolen JWT alone is useless" against an attacker who also has the app binary — they could extract the secret too. It's still a real, standard, valuable layer (raises the bar meaningfully, requires reverse engineering rather than just a proxy), just not an unbreakable one. True protection against a fully-compromised client requires either server-side risk scoring or hardware attestation (Play Integrity API / DeviceCheck) — out of scope for now.

### Layer 5 — Certificate Pinning ⬜ Still outstanding
Requires a production domain first (needs the real server cert's hash to pin against). Plan unchanged from before:

```js
import { fetch } from 'react-native-ssl-pinning';

fetch('https://api.vpay.in/api/payment/transfer', {
  method: 'POST',
  pkPinning: true,
  sslPinning: { certs: ['vpay_cert'] },
  body: JSON.stringify(payload)
});
```

---

## Fix Plan by Phase

### Phase 1 — One-liners ✅ DONE
- [x] `useBiometric.ts` — `disableDeviceFallback: true` (H-3)
- [x] `App.tsx` — `onboarding_completed ?? false` (H-4)
- [x] `index.js` — JSON body limit `'16kb'` (H-5)
- [x] `payment.js` — `Joi.number().min(1)` (L-1)
- [x] `App.tsx` — Remove API URL from error screen (L-3)
- [x] `profileController.js` — Remove phone number from `console.log` (M-5)
- [x] `index.js` — Fail hard if `ALLOWED_ORIGINS` not set in production (M-6)

### Phase 2 — Backend hardening ✅ DONE
- [x] Idempotency keys on `/payment/transfer` (C-2) — `idempotency_key` column + updated `transfer_payment()` RPC
- [x] Transcript sanitization + delimiters in Gemma prompt (C-4) — `<voice_command>` tags + strict output schema validation
- [x] User-level rate limiting on payment + AI routes (H-1) — `userPaymentLimiter`, `userAiLimiter`
- [x] Lookup endpoint: boolean only + 20/day per-user limit (H-2) — verified live against real Supabase
- [x] M-1 — confirmed `errorHandler.js` already correctly gated; the actual gap is a deployment setting (`NODE_ENV=production`), not code
- [x] Validate RPC response shape before accessing `.success` (M-4)
- [x] Revoke old session after re-auth on lock screen (L-2) — `signOut({scope:'others'})` post-success, not pre-attempt

### Phase 3 — Frontend hardening ✅ DONE
- [x] Account lockout: 5 failed PIN attempts → 15-min lock (C-3) — `pin_attempts` table + 3 RPCs, wired into `SignInScreen.tsx` and `LockScreen.tsx`, verified live
- [x] Biometric-gated PIN storage (C-3, 2nd half) — `requireAuthentication: true` on the stored PIN, so decrypting it requires a live OS biometric/passcode check even on a rooted device
- [x] Move biometric preference from `AsyncStorage` → `SecureStore` (M-2)
- [x] Move full Supabase session/JWT from `AsyncStorage` → chunked `SecureStore` adapter (full encryption-at-rest fix, beyond the original M-2 scope)

### Phase 4 — Network security ✅ DONE (code-complete; TLS termination itself needs a domain)
- [x] HTTPS redirect in Express — active once `NODE_ENV=production` + deployed behind a TLS-terminating host
- [x] Android `network_security_config.xml` — via custom Expo config plugin, verified with real `expo prebuild`
- [x] iOS ATS `Info.plist` — via `app.json`, `NSAllowsLocalNetworking` keeps LAN dev working
- [x] HMAC request signing on payment + Stripe routes — verified sign/verify round trip (valid / tampered / expired / missing all behave correctly)

### Phase 5 — Infrastructure
- [ ] Rotate all credentials + move to Doppler / Railway secrets (C-1) — **still needs a human**, can't be done from code
- [x] Magic-byte validation on audio uploads (M-3) — dependency-free implementation, verified against all 6 supported formats
- [ ] Certificate pinning (needs production domain first) — **still needs a human** (domain + cert)
- [ ] Expo OTA code signing (L-4) — **still needs a human** (EAS account)

---

## Still Outstanding (needs a human, not more code)

Everything that was pure code is done. What's left genuinely requires an external account, a purchased domain, or a manual dashboard action — none of it can be resolved by writing more code in this repo:

1. **Rotate all credentials (C-1)** — the Groq, Gemini, and Supabase service-role keys currently in `backend/.env` were exposed in a zip file passed around outside this session. Rotate them in each provider's dashboard, then update `.env`.
2. **Buy a production domain + deploy behind it** — unlocks real effect for the HTTPS redirect, Android/iOS TLS enforcement, and is a prerequisite for certificate pinning.
3. **Set `NODE_ENV=production`** on whatever platform you deploy to (Railway/Render env var dashboard) — the code already behaves correctly, it just needs this flag set outside of this repo.
4. **Certificate pinning** — blocked on having a real server certificate to pin against.
5. **Expo OTA code signing** — needs an EAS account and `expo-updates` configuration.
6. **Move the in-memory rate limiters to Redis** if this API is ever scaled to more than one instance — `userPaymentLimiter`/`userAiLimiter` currently use a per-process `Map`, which resets per-instance and wouldn't share state across multiple servers. Fine for a single instance; Upstash Redis (free tier) is the documented upgrade path.

## External Dependencies Needed

| Thing | Where |
|-------|--------|
| Production domain | GoDaddy, Namecheap |
| TLS certificate | Free via Let's Encrypt / auto on Railway or Render |
| Secrets manager | Doppler (free tier) or Railway environment variables |
| Redis for distributed rate limiting | Upstash (free tier) |
