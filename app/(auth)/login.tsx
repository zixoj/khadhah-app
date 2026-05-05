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
import { Mail, Lock, LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { colors: C, isDark } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const inputBg = isDark ? '#1A2020' : '#F5F5F5';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';
  const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: C.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#F0FDF4' }]}>
            <Text style={styles.logoEmoji}>📦</Text>
          </View>
          <Text style={[styles.appName, { color: C.primary }]}>خذه</Text>
          <Text style={[styles.tagline, { color: C.textSecondary }]}>بدّل أو اعطِ، بكل سهولة</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5', borderColor: isDark ? 'rgba(255,59,48,0.30)' : '#FECACA' }]}>
              <Text style={[styles.errorText, { color: isDark ? '#FF6B6B' : '#CC2222' }]}>{error}</Text>
            </View>
          )}

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
            style={[styles.loginBtn, { backgroundColor: C.primary, shadowColor: C.primary }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LogIn size={20} color="#000" />
            <Text style={styles.loginBtnText}>
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: C.textSecondary }]}>ليس لديك حساب؟ </Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={[styles.linkText, { color: C.primary }]}>إنشاء حساب جديد</Text>
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
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  tagline: { fontSize: FontSizes.md },
  form: { gap: Spacing.md },
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
  loginBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: {
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
