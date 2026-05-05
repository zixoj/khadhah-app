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
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { usePhoneVerification } from '@/lib/usePhoneVerification';

interface Props {
  visible: boolean;
  currentPhone: string;
  onClose: () => void;
  onVerified: () => void;
}

export default function PhoneVerifyModal({ visible, currentPhone, onClose, onVerified }: Props) {
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <X size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>توثيق رقم الجوال</Text>
            <View style={{ width: 22 }} />
          </View>

          {step === 'done' ? (
            <View style={styles.successState}>
              <View style={styles.successCircle}>
                <ShieldCheck size={36} color={Colors.white} />
              </View>
              <Text style={styles.successTitle}>تم التوثيق بنجاح!</Text>
              <Text style={styles.successSub}>رقمك الآن موثق ✓</Text>
            </View>
          ) : step === 'verifying' ? (
            <View style={styles.form}>
              <Text style={styles.instructions}>
                أدخل رمز التحقق المرسل إلى {phone}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="الرمز المكوّن من 6 أرقام"
                placeholderTextColor={Colors.neutral[400]}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
              <TouchableOpacity style={styles.btn} onPress={handleVerify}>
                <Text style={styles.btnText}>تحقق</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => reset()} style={styles.back}>
                <Text style={styles.backText}>تغيير الرقم</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.iconRow}>
                <Phone size={28} color={Colors.primary[600]} />
              </View>
              <Text style={styles.instructions}>
                أدخل رقم جوالك لاستلام رمز التحقق
              </Text>
              <TextInput
                style={styles.input}
                placeholder="05xxxxxxxx"
                placeholderTextColor={Colors.neutral[400]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign="right"
              />
              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.btn, step === 'sending' && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={step === 'sending'}
              >
                {step === 'sending'
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>إرسال رمز التحقق</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  form: { gap: Spacing.md },
  iconRow: { alignItems: 'center', paddingVertical: Spacing.sm },
  instructions: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  input: {
    backgroundColor: Colors.neutral[50], borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSizes.lg, color: Colors.text,
  },
  error: { fontSize: FontSizes.sm, color: Colors.error[500], textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
  back: { alignItems: 'center' },
  backText: { fontSize: FontSizes.sm, color: Colors.primary[600] },
  successState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  successCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text },
  successSub: { fontSize: FontSizes.md, color: Colors.textSecondary },
});
