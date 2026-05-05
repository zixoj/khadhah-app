export const Neon = {
  green: '#00FF87',
  greenDim: '#00CC6A',
  greenGlow: 'rgba(0,255,135,0.25)',
  greenGlowStrong: 'rgba(0,255,135,0.45)',
};

export const DarkColors = {
  // Backgrounds
  background: '#080E12',
  surface: '#0F1923',
  card: '#142028',
  cardBorder: 'rgba(0,255,135,0.12)',
  // Text
  text: '#F0F6FF',
  textSecondary: '#8A9BB0',
  textMuted: '#4A5568',
  // Accent
  primary: Neon.green,
  primaryDim: Neon.greenDim,
  primaryGlow: Neon.greenGlow,
  // UI
  border: 'rgba(255,255,255,0.08)',
  navBar: '#0B1520',
  tabBar: '#0B1520',
  tabBarBorder: 'rgba(0,255,135,0.15)',
  input: '#142028',
  inputBorder: 'rgba(255,255,255,0.12)',
  // Status
  success: '#00CC6A',
  error: '#FF4757',
  errorBg: 'rgba(255,71,87,0.12)',
  warning: '#FFB300',
  warningBg: 'rgba(255,179,0,0.12)',
  // Others
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.75)',
  glass: 'rgba(15,25,35,0.85)',
  // Exchange/Free
  exchange: '#3B82F6',
  exchangeBg: 'rgba(59,130,246,0.15)',
  free: '#00CC6A',
  freeBg: 'rgba(0,204,106,0.15)',
  // Whatsapp
  whatsapp: '#25D366',
};

export const LightColors = {
  background: '#F4F7FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E8EDF2',
  text: '#0F1923',
  textSecondary: '#5A6B7D',
  textMuted: '#9AACBD',
  primary: '#00A558',
  primaryDim: '#007A40',
  primaryGlow: 'rgba(0,165,88,0.18)',
  border: '#E0E8EF',
  navBar: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E0E8EF',
  input: '#F4F7FA',
  inputBorder: '#D0DBE5',
  success: '#00A558',
  error: '#E53E3E',
  errorBg: '#FFF5F5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
  glass: 'rgba(255,255,255,0.92)',
  exchange: '#2563EB',
  exchangeBg: '#EFF6FF',
  free: '#059669',
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
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  exchange: '#16a34a',
  free: '#059669',
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
  xl: 24,
  xxl: 32,
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
