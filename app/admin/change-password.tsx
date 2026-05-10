import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.18)',
  borderFocus: 'rgba(0,200,83,0.60)', red: '#FF3B30', errorBg: 'rgba(255,59,48,0.10)',
};

function validate(p: string): string | null {
  if (p.length < 12) return 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل';
  if (!/[A-Z]/.test(p)) return 'يجب أن تحتوي على حرف كبير';
  if (!/[a-z]/.test(p)) return 'يجب أن تحتوي على حرف صغير';
  if (!/[0-9]/.test(p)) return 'يجب أن تحتوي على رقم';
  if (!/[^A-Za-z0-9]/.test(p)) return 'يجب أن تحتوي على رمز خاص';
  return null;
}

export default function AdminChangePassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!current || !next || !confirm) {
      setError('يرجى ملء جميع الحقول');
      return;
    }
    if (next !== confirm) {
      setError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    const validationError = validate(next);
    if (validationError) { setError(validationError); return; }
    if (next === current) {
      setError('يجب أن تختلف كلمة المرور الجديدة عن الحالية');
      return;
    }

    setLoading(true);

    // Re-authenticate with current password to verify it is correct
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) { setError('خطأ في الجلسة'); setLoading(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: current,
    });
    if (signInErr) {
      setError('كلمة المرور الحالية غير صحيحة');
      setLoading(false);
      return;
    }

    // Update to new password (Supabase stores as bcrypt hash)
    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    // Clear the force-change flag in profile
    await supabase.rpc('admin_clear_force_password');
    await refreshProfile();

    setLoading(false);
    Alert.alert('تم بنجاح', 'تم تغيير كلمة المرور. سيتم توجيهك للوحة التحكم.', [
      { text: 'حسناً', onPress: () => router.replace('/admin') },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconOuter}>
            <ShieldCheck size={32} color={C.primary} />
          </View>
        </View>

        <Text style={styles.title}>تغيير كلمة المرور</Text>
        <Text style={styles.subtitle}>
          لأسباب أمنية، يجب عليك تغيير كلمة المرور المؤقتة قبل استخدام لوحة التحكم.
        </Text>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Current password */}
        <Field
          label="كلمة المرور الحالية"
          value={current}
          onChange={(v) => { setCurrent(v); setError(null); }}
          secure={!showCurrent}
          onToggle={() => setShowCurrent(p => !p)}
          show={showCurrent}
        />

        {/* New password */}
        <Field
          label="كلمة المرور الجديدة"
          value={next}
          onChange={(v) => { setNext(v); setError(null); }}
          secure={!showNext}
          onToggle={() => setShowNext(p => !p)}
          show={showNext}
        />

        {/* Confirm */}
        <Field
          label="تأكيد كلمة المرور الجديدة"
          value={confirm}
          onChange={(v) => { setConfirm(v); setError(null); }}
          secure={!showConfirm}
          onToggle={() => setShowConfirm(p => !p)}
          show={showConfirm}
        />

        {/* Requirements */}
        <View style={styles.requirements}>
          <Text style={styles.reqTitle}>متطلبات كلمة المرور:</Text>
          {[
            '12 حرفاً على الأقل',
            'حرف كبير واحد على الأقل (A-Z)',
            'حرف صغير واحد على الأقل (a-z)',
            'رقم واحد على الأقل (0-9)',
            'رمز خاص واحد على الأقل (!@#$...)',
          ].map((r, i) => (
            <Text key={i} style={styles.reqItem}>· {r}</Text>
          ))}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Lock size={18} color="#000" />
          <Text style={styles.submitText}>{loading ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, secure, onToggle, show }: {
  label: string; value: string; onChange: (v: string) => void;
  secure: boolean; onToggle: () => void; show: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <Lock size={16} color={C.muted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure}
          autoCapitalize="none"
          textAlign="right"
          placeholderTextColor={C.muted}
          placeholder="••••••••••••"
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          {show ? <EyeOff size={16} color={C.muted} /> : <Eye size={16} color={C.muted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, gap: 20 },

  iconWrap: { alignItems: 'center', marginBottom: 4 },
  iconOuter: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(0,200,83,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(0,200,83,0.35)',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20,
  },

  title: { color: C.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  errorBox: {
    backgroundColor: C.errorBg, borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  errorText: { color: C.red, fontSize: 13, textAlign: 'right', fontWeight: '600' },

  fieldWrap: { gap: 8 },
  fieldLabel: { color: C.sub, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 16, paddingHorizontal: 14, minHeight: 54, gap: 10,
  },
  inputIcon: {},
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 12 },
  eyeBtn: { padding: 4 },

  requirements: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, gap: 6,
  },
  reqTitle: { color: C.sub, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  reqItem: { color: C.muted, fontSize: 12 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.primary, borderRadius: 18, height: 58,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 16,
  },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
