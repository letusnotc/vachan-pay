// VPay design tokens — single source of truth for all screens

export const C = {
  primary:       '#5B4FE8',
  primaryDark:   '#3B30C4',
  primaryLight:  '#8478F0',
  primaryBg:     '#EEEDFF',
  primaryShadow: 'rgba(91,79,232,0.28)',

  success:   '#10B981',
  successBg: '#ECFDF5',
  error:     '#EF4444',
  errorBg:   '#FFF1F2',

  bg:        '#F4F5FF',
  card:      '#FFFFFF',

  text:      '#0F172A',
  textSub:   '#64748B',
  textMuted: '#94A3B8',

  border:  '#E2E8F0',
  white:   '#FFFFFF',
} as const;

export const shadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
  primary: {
    shadowColor: '#5B4FE8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 10,
  },
  success: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;