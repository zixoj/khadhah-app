import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { COUNTRIES, type Country } from '@/lib/countries';
import { User, Mail, Lock, Phone, Truck, Megaphone, ChevronLeft, Eye, EyeOff, Globe, ChevronDown, X } from 'lucide-react-native';
import type { UserRole } from '@/types/database';

const G = {
  bg: '#050B08',
  surface: '#0D1410',
  card: 'rgba(17,23,20,0.90)',
  cardSolid: '#111714',
  primary: '#00C853',
  primaryBright: '#00E676',
  primaryGlow: 'rgba(0,200,83,0.30)',
  border: 'rgba(0,200,83,0.18)',
  borderFocus: 'rgba(0,200,83,0.65)',
  inputBg: 'rgba(255,255,255,0.04)',
  text: '#FFFFFF',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.28)',
  error: '#FF4444',
  errorBg: 'rgba(255,68,68,0.10)',
  modalBg: '#0D1410',
  modalCard: '#111714',
};

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<UserRole>('advertiser');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const fullPhone = selectedCountry
    ? `${selectedCountry.code}${phoneNumber.replace(/^0/, '')}`
    : phoneNumber;

  const handleRegister = async () => {
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); return; }
    if (!email.trim()) { setError('الرجاء إدخال البريد الإلكتروني'); return; }
    if (!selectedCountry) { setError('الرجاء اختيار الدولة'); return; }
    if (!phoneNumber.trim()) { setError('الرجاء إدخال رقم الجوال'); return; }
    if (/[a-zA-Z]/.test(phoneNumber)) { setError('رقم الجوال يجب أن يحتوي على أرقام فقط'); return; }
    if (!password) { setError('الرجاء إدخال كلمة المرور'); return; }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }

    setLoading(true);
    setError(null);
    try {
      const { error: err } = await signUp(
        email.trim(),
        password,
        fullName.trim(),
        role,
        fullPhone,
        {
          country: selectedCountry.nameEn,
          countryCode: selectedCountry.code,
          phoneNumber: phoneNumber.trim(),
          fullPhoneNumber: fullPhone,
        }
      );
      if (err) setError(err);
    } catch (e: any) {
      console.error('[Register] Network error:', e);
      setError('مشكلة اتصال بالسيرفر. تحقق من الإنترنت وأعد المحاولة');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => [
    styles.inputWrap,
    focused === field && styles.inputWrapFocus,
  ];

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.ambientTop} />
      <View pointerEvents="none" style={styles.ambientBottom} />

      {/* Country picker modal */}
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر دولتك</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.modalClose}>
                <X size={20} color={G.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.nameEn}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryRow,
                    selectedCountry?.nameEn === item.nameEn && styles.countryRowActive,
                  ]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setShowCountryPicker(false);
                    setError(null);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>{item.code}</Text>
                  </View>
                  <Text style={[
                    styles.countryName,
                    selectedCountry?.nameEn === item.nameEn && styles.countryNameActive,
                  ]}>
                    {item.nameAr}
                  </Text>
                  {selectedCountry?.nameEn === item.nameEn && (
                    <View style={styles.activeCheck} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <ChevronLeft size={22} color={G.text} />
          </TouchableOpacity>

          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>إنشاء حساب</Text>
              <View style={styles.titleUnderline} />
              <Text style={styles.subtitle}>انضم وابدأ التبادل الآن</Text>
            </View>

            {/* Role picker */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>نوع الحساب</Text>
              <View style={styles.roleRow}>
                {([
                  { key: 'advertiser', Icon: Megaphone, label: 'معلن', desc: 'نشر إعلانات التبديل والعطاء' },
                  { key: 'delivery_agent', Icon: Truck, label: 'مندوب', desc: 'استلام وتوصيل الطلبات' },
                ] as const).map(({ key, Icon, label, desc }) => {
                  const active = role === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.roleCard, active && styles.roleCardActive]}
                      onPress={() => setRole(key)}
                      activeOpacity={0.8}
                    >
                      {active && <View style={styles.roleCardGlow} />}
                      <View style={[styles.roleIconWrap, active ? styles.roleIconWrapActive : styles.roleIconWrapIdle]}>
                        <Icon size={26} color={active ? '#000' : G.primary} />
                      </View>
                      <Text style={[styles.roleName, active && styles.roleNameActive]}>{label}</Text>
                      <Text style={styles.roleDesc}>{desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Form */}
            <View style={styles.sectionGroup}>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Full name */}
              <View style={inputStyle('name')}>
                <TextInput
                  style={styles.input}
                  placeholder="الاسم الكامل"
                  placeholderTextColor={G.textMuted}
                  value={fullName}
                  onChangeText={(t) => { setFullName(t); setError(null); }}
                  textAlign="right"
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                />
                <View style={[styles.inputIcon, focused === 'name' && styles.inputIconActive]}>
                  <User size={17} color={focused === 'name' ? G.primary : G.textMuted} />
                </View>
              </View>

              {/* Email */}
              <View style={inputStyle('email')}>
                <TextInput
                  style={styles.input}
                  placeholder="البريد الإلكتروني"
                  placeholderTextColor={G.textMuted}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign="right"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
                <View style={[styles.inputIcon, focused === 'email' && styles.inputIconActive]}>
                  <Mail size={17} color={focused === 'email' ? G.primary : G.textMuted} />
                </View>
              </View>

              {/* Country selector */}
              <Text style={styles.fieldLabel}>الدولة</Text>
              <TouchableOpacity
                style={[styles.inputWrap, !selectedCountry && styles.inputWrapRequired]}
                onPress={() => setShowCountryPicker(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.inputIcon]}>
                  <ChevronDown size={17} color={selectedCountry ? G.primary : G.textMuted} />
                </View>
                <Text style={[styles.input, { paddingVertical: 16 }, !selectedCountry && { color: G.textMuted }]}>
                  {selectedCountry ? selectedCountry.nameAr : 'اختر دولتك'}
                </Text>
                <View style={[styles.inputIcon]}>
                  <Globe size={17} color={selectedCountry ? G.primary : G.textMuted} />
                </View>
              </TouchableOpacity>

              {/* Phone with country code */}
              <Text style={styles.fieldLabel}>رقم الجوال</Text>
              <View style={[styles.inputWrap, focused === 'phone' && styles.inputWrapFocus, styles.phoneWrap]}>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="اكتب رقم جوالك"
                  placeholderTextColor={G.textMuted}
                  value={phoneNumber}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, '');
                    setPhoneNumber(digits);
                    setError(null);
                  }}
                  keyboardType="phone-pad"
                  textAlign="right"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
                <View style={styles.phoneCodeBadge}>
                  <Phone size={14} color={focused === 'phone' ? G.primary : G.textMuted} />
                  <Text style={[styles.phoneCodeText, { color: selectedCountry ? G.primary : G.textMuted }]}>
                    {selectedCountry ? selectedCountry.code : '+---'}
                  </Text>
                </View>
              </View>

              {/* Password */}
              <View style={inputStyle('pass')}>
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  {showPass ? <EyeOff size={17} color={G.textMuted} /> : <Eye size={17} color={G.textMuted} />}
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="كلمة المرور"
                  placeholderTextColor={G.textMuted}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  secureTextEntry={!showPass}
                  textAlign="right"
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                />
                <View style={[styles.inputIcon, focused === 'pass' && styles.inputIconActive]}>
                  <Lock size={17} color={focused === 'pass' ? G.primary : G.textMuted} />
                </View>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.82}
            >
              <View style={styles.submitBtnShine} />
              <Text style={styles.submitBtnText}>
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>لديك حساب؟</Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.8}>
                <Text style={styles.footerLink}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 22, gap: 0 },

  ambientTop: {
    position: 'absolute', top: -100, right: -80,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(0,200,83,0.08)',
  },
  ambientBottom: {
    position: 'absolute', bottom: 60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(0,100,40,0.06)',
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },

  content: { gap: 22 },

  header: { alignItems: 'center', gap: 6, paddingTop: 4 },
  title: { fontSize: 36, fontWeight: '900', color: G.text, letterSpacing: -1 },
  titleUnderline: {
    width: 44, height: 3, borderRadius: 2,
    backgroundColor: G.primary, shadowColor: G.primary,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, marginTop: -2,
  },
  subtitle: { fontSize: 14, color: G.textSub, letterSpacing: 0.2 },

  sectionGroup: { gap: 12 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: G.textSub,
    textAlign: 'right', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: G.textSub,
    textAlign: 'right', marginBottom: -4,
  },

  roleRow: { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex: 1, backgroundColor: 'rgba(17,23,20,0.80)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22, padding: 16, alignItems: 'center', gap: 8, overflow: 'hidden',
  },
  roleCardActive: {
    borderColor: G.primary, backgroundColor: 'rgba(0,200,83,0.08)',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 0,
  },
  roleCardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
    backgroundColor: 'rgba(0,200,83,0.06)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  roleIconWrap: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  roleIconWrapIdle: { backgroundColor: 'rgba(0,200,83,0.10)', borderWidth: 1, borderColor: 'rgba(0,200,83,0.20)' },
  roleIconWrapActive: { backgroundColor: G.primary, shadowColor: G.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  roleName: { fontSize: 17, fontWeight: '800', color: 'rgba(255,255,255,0.65)' },
  roleNameActive: { color: G.primary },
  roleDesc: { fontSize: 11, color: G.textMuted, textAlign: 'center', lineHeight: 16 },

  errorBox: {
    backgroundColor: G.errorBg, borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  errorText: { color: G.error, fontSize: 13, textAlign: 'right', fontWeight: '600' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: G.inputBg, borderWidth: 1.5,
    borderColor: G.border, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    gap: 10, minHeight: 54,
  },
  inputWrapFocus: {
    borderColor: G.borderFocus, backgroundColor: 'rgba(0,200,83,0.04)',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22, shadowRadius: 8,
  },
  inputWrapRequired: { borderColor: 'rgba(0,200,83,0.35)' },
  inputIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
  },
  inputIconActive: { backgroundColor: 'rgba(0,200,83,0.10)' },
  input: { flex: 1, fontSize: 15, color: G.text, paddingVertical: 12, textAlign: 'right' },
  eyeBtn: { padding: 6 },

  phoneWrap: { paddingHorizontal: 10 },
  phoneInput: { textAlign: 'right' },
  phoneCodeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,200,83,0.08)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,200,83,0.20)',
  },
  phoneCodeText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  submitBtn: {
    height: 58, borderRadius: 20, backgroundColor: G.primary,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    shadowColor: G.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 8, marginTop: 4,
  },
  submitBtnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  submitBtnText: { fontSize: 17, fontWeight: '800', color: '#000', letterSpacing: 0.3 },

  footerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingBottom: 8,
  },
  footerText: { fontSize: 14, color: G.textMuted },
  footerLink: { fontSize: 14, fontWeight: '800', color: G.primary },

  // Country picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: G.modalBg,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 8, maxHeight: '75%',
    borderTopWidth: 1, borderColor: 'rgba(0,200,83,0.15)',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: G.text },
  modalClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center', alignItems: 'center',
  },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  countryRowActive: { backgroundColor: 'rgba(0,200,83,0.07)' },
  countryCodeBadge: {
    minWidth: 56, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(0,200,83,0.10)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,200,83,0.20)',
    alignItems: 'center',
  },
  countryCodeText: { fontSize: 13, fontWeight: '700', color: G.primary },
  countryName: { flex: 1, fontSize: 15, color: G.text, textAlign: 'right' },
  countryNameActive: { color: G.primary, fontWeight: '700' },
  activeCheck: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: G.primary,
  },
});
