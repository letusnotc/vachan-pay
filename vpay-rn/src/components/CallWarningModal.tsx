import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, shadow } from '../theme';

type Props = {
  visible:    boolean;
  /** Primary action label — e.g. "Continue anyway". */
  confirmLabel?: string;
  onConfirm:  () => void;
  onCancel:   () => void;
};

/**
 * Non-blocking safety warning shown when the microphone appears to be in use
 * by another app — most commonly an active phone / VoIP call. It does NOT stop
 * the user; it just makes them pause and confirm they trust the recipient
 * before money moves (a common scam pattern is a caller walking a victim
 * through a payment while on the line).
 */
export default function CallWarningModal({ visible, confirmLabel = 'Continue anyway', onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.iconCircle}>
            <Text style={s.icon}>📞</Text>
          </View>
          <Text style={s.title}>You may be on a call</Text>
          <Text style={s.body}>
            Your microphone looks like it's being used by another app — you might be on a
            phone call right now.{'\n\n'}
            If someone on a call is guiding you to send money,{' '}
            <Text style={s.bold}>stop and make sure you fully trust them.</Text> VPay will
            never call you and ask you to pay anyone.
          </Text>

          <TouchableOpacity style={s.confirmBtn} onPress={onConfirm} activeOpacity={0.88}>
            <Text style={s.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card:       { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 26, alignItems: 'center', ...shadow.md },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF1E6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  icon:       { fontSize: 30 },
  title:      { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3, marginBottom: 10, textAlign: 'center' },
  body:       { fontSize: 14, lineHeight: 21, color: C.textSub, textAlign: 'center', marginBottom: 22 },
  bold:       { fontWeight: '800', color: C.text },
  confirmBtn: { alignSelf: 'stretch', backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', ...shadow.primary },
  confirmText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn:  { alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: C.textSub, fontSize: 15, fontWeight: '600' },
});
