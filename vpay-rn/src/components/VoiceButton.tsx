import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, Animated, View } from 'react-native';

interface Props {
  isRecording:  boolean;
  isProcessing: boolean;
  onPress:      () => void;
}

const VoiceButton: React.FC<Props> = ({ isRecording, isProcessing, onPress }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  return (
    <TouchableOpacity onPress={onPress} disabled={isProcessing} activeOpacity={0.85}>
      <Animated.View style={[styles.ring, isRecording && styles.ringActive, { transform: [{ scale: pulse }] }]}>
        <View style={[styles.btn, isRecording && styles.btnActive]}>
          {isProcessing
            ? <ActivityIndicator size="large" color="#fff" />
            : <Animated.Text style={styles.icon}>{isRecording ? '⏹' : '🎤'}</Animated.Text>
          }
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: 'transparent',
    justifyContent: 'center', alignItems: 'center'
  },
  ringActive: {
    borderColor: '#FF6B6B44'
  },
  btn: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  btnActive: {
    backgroundColor: '#FF6B6B'
  },
  icon: {
    fontSize: 34
  }
});

export default VoiceButton;
