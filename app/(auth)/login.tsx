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
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { Mail, Lock, LogIn } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>📦</Text>
          </View>
          <Text style={styles.appName}>خذه</Text>
          <Text style={styles.tagline}>بدّل أو اعطِ، بكل سهولة</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Mail size={20} color={Colors.primary[500]} />
            <TextInput
              style={styles.input}
              placeholder="البريد الإلكتروني"
              placeholderTextColor={Colors.neutral[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color={Colors.primary[500]} />
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور"
              placeholderTextColor={Colors.neutral[400]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LogIn size={20} color={Colors.white} />
            <Text style={styles.loginBtnText}>
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>ليس لديك حساب؟ </Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>إنشاء حساب جديد</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
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
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: FontSizes.xxxl,
    fontWeight: '700',
    color: Colors.primary[700],
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.md,
  },
  errorBox: {
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[400],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.error[600],
    fontSize: FontSizes.sm,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    paddingVertical: Spacing.md,
    textAlign: 'right',
  },
  loginBtn: {
    backgroundColor: Colors.primary[600],
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: FontSizes.md,
    color: Colors.primary[600],
    fontWeight: '700',
  },
});
