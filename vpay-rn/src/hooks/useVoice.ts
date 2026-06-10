import { useState, useRef } from 'react';
import { Audio }            from 'expo-av';
import * as Speech          from 'expo-speech';
import { api }              from '../lib/api';
import { useStore }         from '../store/store';

export interface VoiceResult {
  intent:                'make_payment' | 'check_balance' | 'check_history' | 'unknown';
  parameters:            { name?: string | null; amount?: number | null };
  clarification_message: string;
}

export const useVoice = () => {
  const [isRecording,  setIsRecording]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript,   setTranscript]   = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const { language } = useStore();

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: language === 'hi' ? 'hi-IN' : 'en-US', rate: 0.9 });
  };

  const stopSpeaking = () => Speech.stop();

  const startRecording = async (): Promise<boolean> => {
    try {
      setError(null);
      setTranscript('');

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        return false;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
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

  const stopAndProcess = async (): Promise<VoiceResult | null> => {
    if (!recordingRef.current) return null;

    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error('Recording URI is null');

      // --- Step 1: Whisper transcription ---
      const form = new FormData();
      form.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
      form.append('language', language === 'hi' ? 'hi' : 'en');

      const whisperRes = await api.post('/whisper/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const text = (whisperRes.data.text as string).trim();
      if (!text) throw new Error('Empty transcript from Whisper');
      setTranscript(text);

      // --- Step 2: Mistral intent analysis ---
      const aiRes  = await api.post('/ai/analyze-transcript', { transcript: text });
      return aiRes.data as VoiceResult;

    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to process voice command';
      setError(msg);
      speak(msg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { isRecording, isProcessing, transcript, error, startRecording, stopAndProcess, speak, stopSpeaking };
};
