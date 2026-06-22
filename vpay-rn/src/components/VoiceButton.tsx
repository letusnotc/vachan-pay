import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity, ActivityIndicator, StyleSheet,
  Animated, View, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, shadow } from '../theme';

const BTN       = 110;
const CONTAINER = 280;
const OFFSET    = (CONTAINER - BTN) / 2;

interface Props {
  isRecording:  boolean;
  isProcessing: boolean;
  onPressIn:    () => void;
  onPressOut:   () => void;
}

export default function VoiceButton({ isRecording, isProcessing, onPressIn, onPressOut }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const r1    = useRef(new Animated.Value(0)).current;
  const r2    = useRef(new Animated.Value(0)).current;
  const r3    = useRef(new Animated.Value(0)).current;

  const makeRipple = (v: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1, duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

  useEffect(() => {
    if (isRecording) {
      const anim = Animated.parallel([
        makeRipple(r1, 0),
        makeRipple(r2, 600),
        makeRipple(r3, 1200),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 0.93, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1.0,  duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ),
      ]);
      anim.start();
      return () => {
        anim.stop();
        r1.setValue(0); r2.setValue(0); r3.setValue(0);
        Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      };
    }
  }, [isRecording]);

  const ringColor  = isRecording ? C.error : C.primary;
  const btnBg      = isRecording ? C.error : C.primary;
  const btnBorder  = isRecording
    ? 'rgba(239,68,68,0.3)'
    : isProcessing
      ? 'rgba(91,79,232,0.25)'
      : 'rgba(91,79,232,0.15)';
  const btnShd = isRecording
    ? { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 }
    : shadow.primary;

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    top: OFFSET, left: OFFSET,
    width: BTN, height: BTN,
    borderRadius: BTN / 2,
    borderWidth: 1.5,
    borderColor: ringColor,
    opacity:   v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3.0] }) }],
  });

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isProcessing}
      activeOpacity={0.88}
    >
      <View style={{ width: CONTAINER, height: CONTAINER, alignItems: 'center', justifyContent: 'center' }}>
        {(isRecording || isProcessing) && (
          <>
            <Animated.View style={ringStyle(r1)} />
            <Animated.View style={ringStyle(r2)} />
            <Animated.View style={ringStyle(r3)} />
          </>
        )}

        <Animated.View
          style={[
            s.btn,
            { backgroundColor: btnBg, borderWidth: 4, borderColor: btnBorder, ...btnShd },
            { transform: [{ scale: pulse }] },
          ]}
        >
          {isProcessing
            ? <ActivityIndicator size="large" color="#fff" />
            : <Ionicons name="mic" size={44} color="#fff" />
          }
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: BTN, height: BTN,
    borderRadius: BTN / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
