import { Audio } from 'expo-av';

/**
 * Best-effort "is the user on a call?" probe, used proactively (on app open and
 * on return-to-foreground) — not tied to the user pressing the mic button.
 *
 * How it works: there is NO OS API that passively tells a normal app "the mic
 * is busy". But we found a reliable proxy — when the user is on a call the OS
 * hands our app a DEAD microphone: recording still "starts", but captures pure
 * digital silence. Off a call, the mic always picks up some room/ambient sound.
 * So we open the mic for a fraction of a second, measure the loudest level
 * (dBFS metering), and if it's essentially silent we conclude the mic is
 * occupied — almost always by a phone / VoIP call.
 *
 * Conservative by design (a false alarm is just one dismissible warning):
 *   - no mic permission            -> false (never warn on our own missing perm)
 *   - device gives no metering      -> false (can't tell, don't guess)
 *   - mic won't open at all         -> true  (something else holds it, e.g. VoIP)
 *   - mic opens but stays silent     -> true  (dead mic == on a call)
 *   - mic opens and hears sound      -> false (free)
 */

// Below this loudness (dBFS: 0 = max, -160 = pure silence) we treat the mic as
// "dead / occupied". Measured on-device: a normal room floors around -60 dB,
// while an on-call dead mic reads exactly -160 dB. -100 sits cleanly between
// the two with a wide safety margin, so a quiet room never false-triggers.
const SILENCE_DB = -100;
const PROBE_MS   = 600;

export interface MicProbeResult {
  busy:   boolean;
  /** Loudest level captured during the probe (dBFS), or null if unmeasured. */
  peakDb: number | null;
}

export async function isMicBusy(): Promise<MicProbeResult> {
  let rec: Audio.Recording | null = null;
  try {
    let { status } = await Audio.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Audio.requestPermissionsAsync()).status;
      if (status !== 'granted') return { busy: false, peakDb: null };
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

    const options = { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true };
    rec = new Audio.Recording();

    let peak        = -160;
    let gotMetering = false;
    await rec.prepareToRecordAsync(options);
    rec.setProgressUpdateInterval(100);
    rec.setOnRecordingStatusUpdate((st) => {
      if (typeof st.metering === 'number') {
        gotMetering = true;
        if (st.metering > peak) peak = st.metering;
      }
    });
    await rec.startAsync();

    // Listen briefly, then tear down.
    await new Promise((resolve) => setTimeout(resolve, PROBE_MS));
    await rec.stopAndUnloadAsync();
    rec = null;

    const busy = gotMetering && peak < SILENCE_DB;
    console.log(`[micProbe] peak dB=${peak.toFixed(1)} gotMetering=${gotMetering} -> busy=${busy}`);

    // Device didn't report levels — don't guess.
    if (!gotMetering) return { busy: false, peakDb: null };
    return { busy, peakDb: peak };   // silent capture == mic is occupied (call)
  } catch (err) {
    // Couldn't even open the mic — something else is holding it (often VoIP).
    console.log('[micProbe] mic would not open -> assuming busy:', err);
    return { busy: true, peakDb: null };
  } finally {
    if (rec) { try { await rec.stopAndUnloadAsync(); } catch {} }
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
  }
}
