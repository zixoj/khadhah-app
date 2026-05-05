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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>إنشاء حساب جديد</Text>
          <Text style={styles.subtitle}>اختر نوع حسابك وابدأ الآن</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>نوع الحساب</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[
                styles.roleCard,
                role === 'advertiser' && styles.roleCardActive,
              ]}
              onPress={() => setRole('advertiser')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.roleIconCircle,
                  role === 'advertiser' && styles.roleIconCircleActive,
                ]}
              >
                <Megaphone
                  size={28}
                  color={
                    role === 'advertiser' ? Colors.white : Colors.primary[600]
                  }
                />
              </View>
              <Text
                style={[
                  styles.roleName,
                  role === 'advertiser' && styles.roleNameActive,
                ]}
              >
                معلن
              </Text>
              <Text
                style={[
                  styles.roleDesc,
                  role === 'advertiser' && styles.roleDescActive,
                ]}
              >
                نشر إعلانات التبديل والعطاء
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleCard,
                role === 'delivery_agent' && styles.roleCardActive,
              ]}
              onPress={() => setRole('delivery_agent')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.roleIconCircle,
                  role === 'delivery_agent' && styles.roleIconCircleActive,
                ]}
              >
                <Truck
                  size={28}
                  color={
                    role === 'delivery_agent'
                      ? Colors.white
                      : Colors.primary[600]
                  }
                />
              </View>
              <Text
                style={[
                  styles.roleName,
                  role === 'delivery_agent' && styles.roleNameActive,
                ]}
              >
                مندوب
              </Text>
              <Text
                style={[
                  styles.roleDesc,
                  role === 'delivery_agent' && styles.roleDescActive,
                ]}
              >
                استلام وتوصيل الطلبات
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <User size={20} color={Colors.primary[500]} />
            <TextInput
              style={styles.input}
              placeholder="الاسم الكامل"
              placeholderTextColor={Colors.neutral[400]}
              value={fullName}
              onChangeText={setFullName}
              textAlign="right"
            />
          </View>

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
            <Phone size={20} color={Colors.primary[500]} />
            <TextInput
              style={styles.input}
              placeholder="رقم الهاتف"
              placeholderTextColor={Colors.neutral[400]}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>تسجيل الدخول</Text>
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
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  roleCard: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roleCardActive: {
    backgroundColor: Colors.primary[50],
    borderColor: Colors.primary[500],
    borderWidth: 2.5,
  },
  roleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconCircleActive: {
    backgroundColor: Colors.primary[600],
  },
  roleName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  roleNameActive: {
    color: Colors.primary[700],
  },
  roleDesc: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  roleDescActive: {
    color: Colors.primary[600],
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
  submitBtn: {
    backgroundColor: Colors.primary[600],
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
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
  submitBtnText: {
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
