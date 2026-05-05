export const Neon = {
  green: '#00C853',
  greenBright: '#00E676',
  greenDim: '#00A844',
  greenGlow: 'rgba(0,200,83,0.22)',
  greenGlowStrong: 'rgba(0,200,83,0.40)',
  greenGlowSoft: 'rgba(0,200,83,0.10)',
};

export const DarkColors = {
  // Backgrounds — pure black base
  background: '#0A0A0A',
  surface: '#111111',
  card: '#161616',
  cardBorder: 'rgba(0,200,83,0.10)',
  // Text
  text: '#F2F2F2',
  textSecondary: '#888888',
  textMuted: '#444444',
  // Accent — neon green
  primary: Neon.green,
  primaryBright: Neon.greenBright,
  primaryDim: Neon.greenDim,
  primaryGlow: Neon.greenGlow,
  primaryGlowStrong: Neon.greenGlowStrong,
  primaryGlowSoft: Neon.greenGlowSoft,
  // UI
  border: 'rgba(255,255,255,0.07)',
  navBar: '#0A0A0A',
  tabBar: '#0D0D0D',
  tabBarBorder: 'rgba(0,200,83,0.18)',
  input: '#161616',
  inputBorder: 'rgba(255,255,255,0.10)',
  // Status
  success: '#00C853',
  error: '#FF3B30',
  errorBg: 'rgba(255,59,48,0.10)',
  warning: '#FF9F0A',
  warningBg: 'rgba(255,159,10,0.10)',
  // Others
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.85)',
  glass: 'rgba(14,14,14,0.92)',
  // Exchange/Free
  exchange: '#0A84FF',
  exchangeBg: 'rgba(10,132,255,0.12)',
  free: '#00C853',
  freeBg: 'rgba(0,200,83,0.12)',
  // Whatsapp
  whatsapp: '#25D366',
};

export const LightColors = {
  background: '#F4F7FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E8EDF2',
  text: '#0A0A0A',
  textSecondary: '#5A6B7D',
  textMuted: '#9AACBD',
  primary: '#00A844',
  primaryBright: '#00C853',
  primaryDim: '#007A30',
  primaryGlow: 'rgba(0,168,68,0.15)',
  primaryGlowStrong: 'rgba(0,168,68,0.28)',
  primaryGlowSoft: 'rgba(0,168,68,0.08)',
  border: '#E0E8EF',
  navBar: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E0E8EF',
  input: '#F4F7FA',
  inputBorder: '#D0DBE5',
  success: '#00A844',
  error: '#E53E3E',
  errorBg: '#FFF5F5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  glass: 'rgba(255,255,255,0.92)',
  exchange: '#0066CC',
  exchangeBg: '#EFF6FF',
  free: '#00A844',
  freeBg: '#ECFDF5',
  whatsapp: '#25D366',
};

// Semantic color palette (static, for backwards compat)
export const Colors = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  accent: {
    50: '#fffbeb',
    100: '#fef3c7',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  white: '#ffffff',
  black: '#000000',
  background: '#0A0A0A',
  card: '#161616',
  text: '#F2F2F2',
  textSecondary: '#888888',
  border: '#222222',
  exchange: '#0A84FF',
  free: '#00C853',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
} as const;
