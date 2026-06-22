import { create }  from 'zustand';
import { Session } from '@supabase/supabase-js';
import { AppLang } from '../i18n/languages';

export interface Profile {
  id:                   string;
  name:                 string;
  email:                string | null;
  phone_number:         string;
  wallet_balance:       number;
  onboarding_completed: boolean;
}

interface AppState {
  session:     Session | null;
  profile:     Profile | null;
  language:    AppLang;
  setSession:  (s: Session | null) => void;
  setProfile:  (p: Profile | null) => void;
  setLanguage: (l: AppLang)        => void;
}

export const useStore = create<AppState>((set) => ({
  session:     null,
  profile:     null,
  language:    'en',
  setSession:  (session)  => set({ session }),
  setProfile:  (profile)  => set({ profile }),
  setLanguage: (language) => set({ language })
}));
