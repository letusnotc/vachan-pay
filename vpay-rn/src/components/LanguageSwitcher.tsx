import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useStore } from '../store/store';
import i18n         from '../i18n';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useStore();

  const toggle = () => {
    const next = language === 'en' ? 'hi' : 'en';
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <TouchableOpacity onPress={toggle} style={styles.btn}>
      <Text style={styles.label}>{language === 'en' ? 'हिंदी' : 'English'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14, backgroundColor: '#EEF0FF'
  },
  label: {
    fontSize: 13, fontWeight: '600', color: '#6C63FF'
  }
});

export default LanguageSwitcher;
