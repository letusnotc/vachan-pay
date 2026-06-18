import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useStore } from '../store/store';
import i18n from '../i18n';
import { C } from '../theme';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useStore();
  const toggle = () => {
    const next = language === 'en' ? 'hi' : 'en';
    setLanguage(next);
    i18n.changeLanguage(next);
  };
  return (
    <TouchableOpacity onPress={toggle} style={s.btn} activeOpacity={0.72}>
      <Text style={s.label}>{language === 'en' ? 'हिंदी' : 'EN'}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: C.primaryBg,
    borderWidth: 1, borderColor: '#C9C4FF',
  },
  label: { fontSize: 13, fontWeight: '700', color: C.primary },
});