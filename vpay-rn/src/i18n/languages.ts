export type AppLang = 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa';

export interface LangConfig {
  code:    AppLang;
  native:  string;  // name in that language
  english: string;  // name in English
  tts:     string;  // BCP-47 for expo-speech
  whisper: string;  // ISO 639-1 for Groq Whisper
}

export const LANGUAGES: LangConfig[] = [
  { code: 'en', native: 'English',   english: 'English',   tts: 'en-US', whisper: 'en' },
  { code: 'hi', native: 'हिंदी',     english: 'Hindi',     tts: 'hi-IN', whisper: 'hi' },
  { code: 'bn', native: 'বাংলা',     english: 'Bengali',   tts: 'bn-IN', whisper: 'bn' },
  { code: 'te', native: 'తెలుగు',    english: 'Telugu',    tts: 'te-IN', whisper: 'te' },
  { code: 'mr', native: 'मराठी',     english: 'Marathi',   tts: 'mr-IN', whisper: 'mr' },
  { code: 'ta', native: 'தமிழ்',     english: 'Tamil',     tts: 'ta-IN', whisper: 'ta' },
  { code: 'gu', native: 'ગુજરાતી',   english: 'Gujarati',  tts: 'gu-IN', whisper: 'gu' },
  { code: 'kn', native: 'ಕನ್ನಡ',     english: 'Kannada',   tts: 'kn-IN', whisper: 'kn' },
  { code: 'ml', native: 'മലയാളം',    english: 'Malayalam', tts: 'ml-IN', whisper: 'ml' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ',    english: 'Punjabi',   tts: 'pa-IN', whisper: 'pa' },
];

export const getLang      = (code: AppLang): LangConfig => LANGUAGES.find(l => l.code === code)!;
export const getTTSLocale = (code: AppLang): string => getLang(code).tts;
