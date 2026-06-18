import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, Animated, NativeScrollEvent,
  NativeSyntheticEvent, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../lib/api';
import { useStore } from '../store/store';
import { RootStackParamList } from '../../App';
import { C, shadow } from '../theme';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'> };

const { width } = Dimensions.get('window');

// ── Illustrations ──────────────────────────────────────────────────────────────

function WaveformIllustration() {
  const bars = [32, 52, 72, 88, 72, 52, 32];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[ill.container, { opacity: pulseAnim }]}>
      <View style={ill.inner}>
        {bars.map((h, i) => (
          <View key={i} style={[ill.bar, { height: h }]} />
        ))}
      </View>
    </Animated.View>
  );
}

function TransferIllustration() {
  return (
    <View style={ill.container}>
      <View style={ill.inner}>
        {/* Left circle — sender, shows rupee symbol */}
        <View style={ill.circle}>
          <Text style={ill.circleSymbol}>₹</Text>
        </View>
        {/* Arrow */}
        <View style={ill.arrow}>
          <View style={ill.arrowLine} />
          <View style={ill.arrowHead} />
        </View>
        {/* Right circle — receiver, success green with checkmark */}
        <View style={[ill.circle, ill.circleRight]}>
          <Text style={ill.circleCheck}>✓</Text>
        </View>
      </View>
    </View>
  );
}

function LanguageIllustration() {
  return (
    <View style={ill.container}>
      <View style={ill.langStack}>
        <View style={ill.langChipFilled}>
          <Text style={ill.langChipFilledText}>हिंदी</Text>
        </View>
        <View style={ill.langChipOutline}>
          <Text style={ill.langChipOutlineText}>English</Text>
        </View>
      </View>
    </View>
  );
}

const ill = StyleSheet.create({
  container: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: C.primaryBg,
    justifyContent: 'center', alignItems: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  bar:   { width: 9, borderRadius: 5, backgroundColor: C.primary },

  // Transfer
  arrow:     { flexDirection: 'row', alignItems: 'center' },
  arrowLine: { width: 36, height: 2.5, backgroundColor: C.primary },
  arrowHead: { width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: C.primary },

  circle:       { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  circleRight:  { backgroundColor: C.success },
  circleSymbol: { fontSize: 16, fontWeight: '700', color: '#fff' },
  circleCheck:  { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Language
  langStack:            { gap: 12, alignItems: 'center' },
  langChipFilled:       { backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 9 },
  langChipFilledText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  langChipOutline:      { borderWidth: 2, borderColor: C.primary, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 9 },
  langChipOutlineText:  { color: C.primary, fontSize: 16, fontWeight: '700' },
});

// ── Slides data ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'voice',
    Illustration: WaveformIllustration,
    title: 'Just Speak',
    desc: 'Pay anyone hands-free. VPay understands your voice in Hindi and English — no typing needed.',
  },
  {
    key: 'transfer',
    Illustration: TransferIllustration,
    title: 'Send in Seconds',
    desc: 'Money reaches your contacts instantly. Just say the name and amount and you\'re done.',
  },
  {
    key: 'language',
    Illustration: LanguageIllustration,
    title: 'Your Language',
    desc: 'Switch between Hindi and English any time. VPay speaks the way you do.',
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completing,   setCompleting]   = useState(false);

  const flatRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      complete();
    }
  };

  const complete = async () => {
    setCompleting(true);
    try {
      const res = await api.patch('/profile/onboarding');
      if (profile) {
        setProfile({ ...profile, onboarding_completed: true, ...res.data.profile });
      }
    } catch {
      // Fallback: update store directly so app moves forward even if network fails
      if (profile) setProfile({ ...profile, onboarding_completed: true });
    } finally {
      setCompleting(false);
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={[s.skip, { top: insets.top + 12 }]} onPress={complete} activeOpacity={0.7}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <item.Illustration />
            <Text style={s.slideTitle}>{item.title}</Text>
            <Text style={s.slideDesc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.progressDot,
                i === currentIndex && s.progressDotActive,
                i < currentIndex && s.progressDotDone,
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          style={s.nextBtn}
          onPress={goNext}
          activeOpacity={0.88}
          disabled={completing}
        >
          {completing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },

  skip:     { position: 'absolute', right: 24, zIndex: 10 },
  skipText: { fontSize: 14, color: C.textSub, fontWeight: '600' },

  slide:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 28 },
  slideTitle: { fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -0.5 },
  slideDesc:  { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 23 },

  footer:      { paddingHorizontal: 28, gap: 24 },
  dotsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  progressDotActive: { backgroundColor: C.primary, width: 22 },
  progressDotDone:   { backgroundColor: C.primaryLight },

  nextBtn:     { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', ...shadow.primary },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
