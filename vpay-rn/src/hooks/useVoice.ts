import { useState, useRef } from 'react';
import { Audio }            from 'expo-av';
import * as Speech          from 'expo-speech';
import { api }              from '../lib/api';
import { useStore }         from '../store/store';
import { getTTSLocale }     from '../i18n/languages';

export interface VoiceResult {
  intent:                'make_payment' | 'check_balance' | 'check_history' | 'unknown';
  parameters:            { name?: string | null; amount?: number | null };
  clarification_message: string;
}

export interface PendingContext {
  name?:   string | null;
  amount?: number | null;
}

export const useVoice = () => {
  const [isRecording,  setIsRecording]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Loudest dB level heard during the current recording, and whether the device
  // gave us metering at all. Used to detect "captured only silence" — which is
  // what happens when the user is on a call and the OS hands us a dead mic.
  const peakDbRef      = useRef<number>(-160);
  const gotMeteringRef = useRef<boolean>(false);
  const { language } = useStore();

  // Below this loudness (dBFS, where 0 = max, -160 = pure silence) we treat the
  // recording as "no speech captured". Measured on-device: an on-call dead mic
  // reads -160, a normal room floors near -60, and actual speech is far louder.
  // -100 catches only the dead-mic (on-call) case, never a real (if quiet) room.
  const SILENCE_DB = -100;

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: getTTSLocale(language), rate: 0.9 });
  };

  const stopSpeaking = () => Speech.stop();

  const startRecording = async (): Promise<boolean> => {
    // Don't start if already mid-recording or processing
    if (isRecording || isProcessing) return false;

    // Force-unload any lingering recording from a previous failed session
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }

    try {
      setError(null);
      setTranscript('');

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        return false;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      // Enable metering so we can measure how loud the captured audio actually
      // is — the signal we use to catch a call-occupied (silent) mic.
      const options = { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true };

      peakDbRef.current      = -160;
      gotMeteringRef.current = false;

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(options);
      rec.setProgressUpdateInterval(100);
      rec.setOnRecordingStatusUpdate((st) => {
        if (typeof st.metering === 'number') {
          gotMeteringRef.current = true;
          if (st.metering > peakDbRef.current) peakDbRef.current = st.metering;
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('[useVoice] startRecording:', err);
      setError('Failed to start recording');
      return false;
    }
  };

  // Shared: stop mic + run Whisper → returns transcript text or null
  const _stopAndTranscribe = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      // If the device gave us metering and the whole clip was near-silent, the
      // mic captured nothing — almost always because the user is on a call and
      // the OS handed our app a dead microphone. Warn instead of shipping
      // silence to Whisper (which hallucinates junk like "Subtitles by the
      // Amara.org community" on empty audio).
      if (gotMeteringRef.current && peakDbRef.current < SILENCE_DB) {
        const msg = "We couldn't hear you. If you're on a call, your microphone may be in use — please end the call and try again.";
        setError(msg);
        speak(msg);
        setIsProcessing(false);
        return null;
      }

      if (!uri) throw new Error('Recording URI is null');

      const form = new FormData();
      form.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
      form.append('language', language);

      const whisperRes = await api.post('/whisper/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = (whisperRes.data.text as string).trim();
      if (!text) throw new Error('Empty transcript');
      setTranscript(text);
      return text;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to process voice';
      setError(msg);
      speak(msg);
      setIsProcessing(false);
      return null;
    }
  };

  // Main intent flow — pass context from prior partial turn
  const stopAndProcess = async (context?: PendingContext): Promise<VoiceResult | null> => {
    const text = await _stopAndTranscribe();
    if (!text) return null;

    try {
      const aiRes = await api.post('/ai/analyze-transcript', {
        transcript: text,
        context:    context ?? null,
        language,
      });
      return aiRes.data as VoiceResult;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to analyse command';
      setError(msg);
      speak(msg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Choice flow — called when user is picking between multiple contacts
  const stopAndProcessChoice = async (): Promise<number | null> => {
    const text = await _stopAndTranscribe();
    if (!text) return null;

    try {
      const res = await api.post('/ai/analyze-choice', { transcript: text });
      return res.data?.choice ?? null;
    } catch {
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isRecording, isProcessing, transcript, error,
    startRecording, stopAndProcess, stopAndProcessChoice,
    speak, stopSpeaking,
  };
};
