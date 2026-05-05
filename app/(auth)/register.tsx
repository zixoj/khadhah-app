import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { User, Mail, Lock, Phone, Truck, Megaphone } from 'lucide-react-native';
import type { UserRole } from '@/types/database';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('advertiser');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { colors: C, isDark } = useTheme();

  const handleRegister = async () => {
    if (!fullName || !email || !password || !phone) {
      setError('الرجاء تعبئة جميع الحقول');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signUp(email, password, fullName, role, phone);
    if (err) setError(err);
    setLoading(false);
  };

  const inputBg = isDark ? '#1A2020' : '#F5F5F5';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';
  const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = isDark ? '#111714' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const cardActiveBg = isDark ? 'rgba(0,200,83,0.10)' : '#F0FDF4';
  const cardActiveBorder = C.primary;
  const iconCircleBg = isDark ? '#1A2020' : '#F3F4F6';
  const roleNameColor = isDark ? C.text : '#111111';
  const roleNameActiveColor = C.primary;
  const roleDescColor = C.textSecondary;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: C.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: C.text }]}>إنشاء حساب جديد</Text>
          <Text style={[styles.subtitle, { color: C.textSecondary }]}>اختر نوع حسابك وابدأ الآن</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5', borderColor: isDark ? 'rgba(255,59,48,0.30)' : '#FECACA' }]}>
              <Text style={[styles.errorText, { color: isDark ? '#FF6B6B' : '#CC2222' }]}>{error}</Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: C.text }]}>نوع الحساب</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[
                styles.roleCard,
                { backgroundColor: role === 'advertiser' ? cardActiveBg : cardBg, borderColor: role === 'advertiser' ? cardActiveBorder : cardBorder },
              ]}
              onPress={() => setRole('advertiser')}
              activeOpacity={0.7}
            >
              <View style={[styles.roleIconCircle, { backgroundColor: role === 'advertiser' ? C.primary : iconCircleBg }]}>
                <Megaphone size={28} color={role === 'advertiser' ? '#000' : C.primary} />
              </View>
              <Text style={[styles.roleName, { color: role === 'advertiser' ? roleNameActiveColor : roleNameColor }]}>معلن</Text>
              <Text style={[styles.roleDesc, { color: roleDescColor }]}>نشر إعلانات التبديل والعطاء</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                { backgroundColor: role === 'delivery_agent' ? cardActiveBg : cardBg, borderColor: role === 'delivery_agent' ? cardActiveBorder : cardBorder },
              ]}
              onPress={() => setRole('delivery_agent')}
              activeOpacity={0.7}
            >
              <View style={[styles.roleIconCircle, { backgroundColor: role === 'delivery_agent' ? C.primary : iconCircleBg }]}>
                <Truck size={28} color={role === 'delivery_agent' ? '#000' : C.primary} />
              </View>
              <Text style={[styles.roleName, { color: role === 'delivery_agent' ? roleNameActiveColor : roleNameColor }]}>مندوب</Text>
              <Text style={[styles.roleDesc, { color: roleDescColor }]}>استلام وتوصيل الطلبات</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <User size={20} color={C.primary} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="الاسم الكامل"
              placeholderTextColor={placeholderColor}
              value={fullName}
              onChangeText={setFullName}
              textAlign="right"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Mail size={20} color={C.primary} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={placeholderColor}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Phone size={20} color={C.primary} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="رقم الهاتف"
              placeholderTextColor={placeholderColor}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Lock size={20} color={C.primary} />
            <TextInput
              style={[styles.input, { color: C.text }]}
              placeholder="كلمة المرور"
              placeholderTextColor={placeholderColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: C.primary, shadowColor: C.primary }, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: C.textSecondary }]}>لديك حساب بالفعل؟ </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: C.primary }]}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: { fontSize: FontSizes.md },
  form: { gap: Spacing.md },
  sectionLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  errorText: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },
  submitBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color: '#000',
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footerText: { fontSize: FontSizes.md },
  linkText: { fontSize: FontSizes.md, fontWeight: '700' },
});
