import { api } from './api';

export type RiskEventType = 'proactive_warning' | 'payment_warning';
export type RiskOutcome   = 'shown' | 'acknowledged' | 'proceeded' | 'cancelled';

export interface RiskEvent {
  eventType:     RiskEventType;
  outcome:       RiskOutcome;
  micPeakDb?:    number | null;
  receiverPhone?: string;
  amount?:       number;
  transcript?:   string;
}

/**
 * Fire-and-forget audit log for "user may be on a call" events. Deliberately
 * never awaited by callers and never throws — logging must not slow down or
 * break the payment/warning UX. The backend derives the profile from the auth
 * token, so this only ever records against the signed-in user.
 */
export function logRiskEvent(event: RiskEvent): void {
  const body: RiskEvent = { ...event };
  if (body.micPeakDb == null) delete body.micPeakDb; // omit rather than send null
  api.post('/risk/event', body).catch((err) => {
    console.log('[riskLog] failed to log event (ignored):', err?.message ?? err);
  });
}
