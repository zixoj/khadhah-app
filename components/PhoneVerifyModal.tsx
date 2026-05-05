import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { X, Phone, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { usePhoneVerification } from '@/lib/usePhoneVerification';

interface Props {
  visible: boolean;
  currentPhone: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function PhoneVerifyModal({ visible, currentPhone, onClose, onVerified }: Props) {
  const { colors: C, isDark } = useTheme();
  const { step, errorMsg, sendOtp, verifyOtp, reset } = usePhoneVerification();
  const [phone, setPhone] = useState(currentPhone || '');
  const [otp, setOtp] = useState('');

  const handleSend = async () => {
    if (!phone.trim()) return;
    await sendOtp(phone.trim());
  };

  const handleVerify = async () => {
    if (!otp.trim()) return;
    const ok = await verifyOtp(phone.trim(), otp.trim());
    if (ok) onVerified();
  };

  const handleClose = () => {
    reset();
    setOtp('');
    onClose();
  };

  const sheetBg = isDark ? '#111714' : '#FFFFFF';
  const inputBg = isDark ? '#1A2020' : '#F5F5F5';
  const inputBorder = isDark ? 'rgba(255,255,255,0.20)' : '#D1D5DB';
  const headerBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.50)' }]}>
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: headerBorder }]}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1E2A24' : '#F3F4F6' }]}
              hitSlop={8}
            >
              <X size={18} color={C.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: C.text }]}>توثيق رقم الجوال</Text>
            <View style={{ width: 34 }} />
          </View>

          {/* Success */}
          {step === 'done' ? (
            <View style={styles.successState}>
              <View style={[styles.successCircle, { backgroundColor: C.primary }]}>
                <ShieldCheck size={36} color="#000" />
              </View>
              <Text style={[styles.successTitle, { color: C.text }]}>تم التوثيق بنجاح!</Text>
              <Text style={[styles.successSub, { color: C.textSecondary }]}>رقمك الآن موثق</Text>
            </View>

          /* OTP entry */
          ) : step === 'verifying' ? (
            <View style={styles.form}>
              <Text style={[styles.instructions, { color: C.textSecondary }]}>
                أدخل رمز التحقق المرسل إلى {phone}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
                placeholder="الرمز المكوّن من 6 أرقام"
                placeholderTextColor={placeholderColor}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              {errorMsg ? (
                <Text style={[styles.error, { color: C.error }]}>{errorMsg}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.primary }]}
                onPress={handleVerify}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnText, { color: '#000' }]}>تحقق</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => reset()} style={styles.back}>
                <Text style={[styles.backText, { color: C.primary }]}>تغيير الرقم</Text>
              </TouchableOpacity>
            </View>

          /* Phone entry */
          ) : (
            <View style={styles.form}>
              <View style={styles.iconRow}>
                <Phone size={28} color={C.primary} />
              </View>
              <Text style={[styles.instructions, { color: C.textSecondary }]}>
                أدخل رقم جوالك لاستلام رمز التحقق
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
                placeholder="05xxxxxxxx"
                placeholderTextColor={placeholderColor}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign="right"
              />
              {errorMsg ? (
                <Text style={[styles.error, { color: C.error }]}>{errorMsg}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: C.primary, opacity: step === 'sending' ? 0.6 : 1 }]}
                onPress={handleSend}
                disabled={step === 'sending'}
                activeOpacity={0.85}
              >
                {step === 'sending'
                  ? <ActivityIndicator color="#000" />
                  : <Text style={[styles.btnText, { color: '#000' }]}>إرسال رمز التحقق</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  form: { gap: Spacing.md },
  iconRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  instructions: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.lg,
  },
  error: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  btn: {
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  back: { alignItems: 'center' },
  backText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  successState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
  successSub: { fontSize: FontSizes.md },
});
