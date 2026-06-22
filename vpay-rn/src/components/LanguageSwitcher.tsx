import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { useStore }              from '../store/store';
import i18n                      from '../i18n';
import { LANGUAGES, getLang }    from '../i18n/languages';
import { C, shadow }             from '../theme';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useStore();
  const [open, setOpen] = useState(false);

  const select = (code: typeof language) => {
    setLanguage(code);
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const current = getLang(language);

  return (
    <>
      {/* Dropdown trigger — shows current language */}
      <TouchableOpacity onPress={() => setOpen(true)} style={s.trigger} activeOpacity={0.72}>
        <Text style={s.triggerLabel}>{current.native}</Text>
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      {/* Dropdown modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select Language</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {LANGUAGES.map((lang, i) => {
                const selected = lang.code === language;
                return (
                  <React.Fragment key={lang.code}>
                    {i > 0 && <View style={s.rowDivider} />}
                    <TouchableOpacity
                      style={[s.row, selected && s.rowSelected]}
                      onPress={() => select(lang.code)}
                      activeOpacity={0.65}
                    >
                      <View style={s.rowText}>
                        <Text style={[s.nativeName, selected && s.selectedText]}>
                          {lang.native}
                        </Text>
                        <Text style={s.englishName}>{lang.english}</Text>
                      </View>
                      {selected && <Text style={s.check}>✓</Text>}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: C.primaryBg, borderWidth: 1, borderColor: '#C9C4FF' },
  triggerLabel: { fontSize: 13, fontWeight: '700', color: C.primary },
  chevron:      { fontSize: 10, color: C.primary, marginTop: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, maxHeight: '75%', ...shadow.lg },

  sheetHeader: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle:  { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },

  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  rowSelected: { backgroundColor: C.primaryBg },
  rowText:     { gap: 2 },
  rowDivider:  { height: 1, backgroundColor: C.border, marginHorizontal: 20 },

  nativeName:   { fontSize: 16, fontWeight: '700', color: C.text },
  englishName:  { fontSize: 12, color: C.textMuted },
  selectedText: { color: C.primary },
  check:        { fontSize: 16, color: C.primary, fontWeight: '700' },
});
