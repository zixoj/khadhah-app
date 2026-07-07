import { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'ar' | 'en';

const STORAGE_KEY = 'app_language';

export const translations = {
  ar: {
    tagline: 'بدّل أو اعطِ بكل سهولة',
    emailPlaceholder: 'البريد الإلكتروني',
    passwordPlaceholder: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    signingIn: 'جاري الدخول...',
    or: 'أو',
    createAccount: 'إنشاء حساب جديد',
    guestMain: 'المتابعة كزائر',
    guestSub: 'Continue as Guest',
    emptyFields: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور',
    networkError: 'مشكلة اتصال بالسيرفر. تحقق من الإنترنت وأعد المحاولة',
    langLabel: 'العربية',
  },
  en: {
    tagline: 'Trade or give with ease',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    or: 'or',
    createAccount: 'Create new account',
    guestMain: 'Continue as Guest',
    guestSub: 'تصفح بدون حساب',
    emptyFields: 'Please enter your email and password',
    networkError: 'Connection error. Check your internet and try again',
    langLabel: 'EN',
  },
};

type TranslationKey = keyof typeof translations.ar;

interface LanguageContextType {
  language: Language;
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  isRTL: true,
  setLanguage: () => {},
  t: (key) => translations.ar[key],
});

function applyDirection(rtl: boolean) {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = rtl ? 'ar' : 'en';
    }
  } else {
    // On native, forceRTL takes effect after reload — acceptable trade-off
    I18nManager.forceRTL(rtl);
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>('ar');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      const lang: Language = saved === 'en' ? 'en' : 'ar';
      setLangState(lang);
      applyDirection(lang === 'ar');
      setLoaded(true);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLangState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
    applyDirection(lang === 'ar');
  };

  const t = (key: TranslationKey): string =>
    (translations[language] as typeof translations.ar)[key] ?? translations.ar[key];

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, isRTL: language === 'ar', setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
