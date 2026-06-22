import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import bn from './bn.json';
import te from './te.json';
import mr from './mr.json';
import ta from './ta.json';
import gu from './gu.json';
import kn from './kn.json';
import ml from './ml.json';
import pa from './pa.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      bn: { translation: bn },
      te: { translation: te },
      mr: { translation: mr },
      ta: { translation: ta },
      gu: { translation: gu },
      kn: { translation: kn },
      ml: { translation: ml },
      pa: { translation: pa },
    },
    lng:               'en',
    fallbackLng:       'en',
    compatibilityJSON: 'v3',
    interpolation:     { escapeValue: false }
  });

export default i18n;
