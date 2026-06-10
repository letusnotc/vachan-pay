import { create }  from 'zustand';
import { Session } from '@supabase/supabase-js';

export interface Profile {
  id:             string;
  name:           string;
  email:          string | null;
  phone_number:   string;
  wallet_balance: number;
}

interface AppState {
  session:    Session | null;
  profile:    Profile | null;
  language:   'en' | 'hi';
  setSession: (s: Session | null) => void;
  setProfile: (p: Profile | null) => void;
  setLanguage:(l: 'en' | 'hi')    => void;
}

export const useStore = create<AppState>((set) => ({
  session:    null,
  profile:    null,
  language:   'en',
  setSession: (session)  => set({ session }),
  setProfile: (profile)  => set({ profile }),
  setLanguage: (language) => set({ language })
}));
