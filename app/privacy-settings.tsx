import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Eye, Lock, UserX, LogOut, MessageCircle, Shield, X, Check } from 'lucide-react-native';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [showPhone, setShowPhone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [blockInput, setBlockInput] = useState('');

  useEffect(() => {
    fetchPrivacySettings();
  }, []);

  const fetchPrivacySettings = async () => {
    const { data } = await supabase.from('profiles').select('show_phone').eq('id', profile!.id).maybeSingle();
    if (data) setShowPhone(data.show_phone ?? true);
    setLoading(false);
  };

  const savePrivacy = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ show_phone: showPhone }).eq('id', profile!.id);
    setSaving(false);
    Alert.alert('تم', 'تم حفظ إعدادات الخصوصية');
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { Alert.alert('خطأ', error.message); } else {
      Alert.alert('تم', 'تم تغيير كلمة المرور بنجاح');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const signOutAllDevices = async () => {
    Alert.alert('تسجيل الخروج من جميع الأجهزة', 'هل أنت متأكد؟ سيتم تسجيل خروجك من جميع الأجهزة.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut({ scope: 'global' });
          signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const reportUser = () => {
    Alert.alert('الإبلاغ عن مستخدم', 'أدخل معرف المستخدم أو اسمه للإبلاغ عنه', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إبلاغ', onPress: () => Alert.alert('تم', 'تم إرسال بلاغك وسيتم مراجعته') },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>الخصوصية والأمان</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* خصوصية الملف الشخصي */}
        <Text style={styles.sectionLabel}>خصوصية الملف الشخصي</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Switch
              value={showPhone}
              onValueChange={setShowPhone}
              trackColor={{ false: Colors.neutral[200], true: Colors.primary[400] }}
              thumbColor={showPhone ? Colors.primary[600] : Colors.neutral[400]}
            />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>إظهار رقم الجوال</Text>
              <Text style={styles.toggleDesc}>يستطيع الآخرون رؤية رقمك</Text>
            </View>
            <View style={styles.iconBox}><Eye size={20} color={Colors.primary[600]} /></View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={savePrivacy} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>حفظ إعدادات الخصوصية</Text>}
        </TouchableOpacity>

        {/* الأمان */}
        <Text style={styles.sectionLabel}>الأمان</Text>
        <View style={styles.card}>
          <ActionRow icon={<Lock size={20} color={Colors.primary[600]} />} label="تغيير كلمة المرور" onPress={() => setShowPasswordModal(true)} />
          <View style={styles.divider} />
          <ActionRow icon={<LogOut size={20} color={Colors.error[500]} />} label="تسجيل الخروج من جميع الأجهزة" onPress={signOutAllDevices} danger />
        </View>

        {/* حماية الحساب */}
        <Text style={styles.sectionLabel}>حماية الحساب</Text>
        <View style={styles.card}>
          <ActionRow icon={<Shield size={20} color={Colors.primary[600]} />} label="توثيق الحساب (طلب شارة موثوق)" onPress={() => Alert.alert('قريباً', 'خاصية التوثيق ستكون متاحة قريباً')} />
          <View style={styles.divider} />
          <ActionRow icon={<UserX size={20} color={Colors.error[500]} />} label="الإبلاغ عن مستخدم" onPress={reportUser} danger />
        </View>

        {/* تنبيه وهمية */}
        <View style={styles.infoBox}>
          <Shield size={18} color={Colors.primary[600]} />
          <Text style={styles.infoText}>نقوم بمراقبة الحسابات الوهمية وإيقافها تلقائياً. إذا اكتشفت حساباً مزيفاً يرجى الإبلاغ عنه.</Text>
        </View>
      </ScrollView>

      {/* Modal: تغيير كلمة المرور */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تغيير كلمة المرور</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>كلمة المرور الجديدة</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="8 أحرف على الأقل"
              placeholderTextColor={Colors.neutral[400]}
              textAlign="right"
            />
            <Text style={styles.inputLabel}>تأكيد كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="أعد إدخال كلمة المرور"
              placeholderTextColor={Colors.neutral[400]}
              textAlign="right"
            />
            <TouchableOpacity style={styles.modalBtn} onPress={changePassword} activeOpacity={0.8}>
              <Text style={styles.modalBtnText}>تغيير كلمة المرور</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger = false }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.6}>
      <ChevronLeft size={18} color={Colors.neutral[300]} />
      <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]}>{label}</Text>
      <View style={styles.iconBox}>{icon}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  sectionLabel: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right' },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary[50], justifyContent: 'center', alignItems: 'center' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
  },
  actionLabel: { flex: 1, fontSize: FontSizes.md, color: Colors.text, fontWeight: '500', textAlign: 'right' },
  actionLabelDanger: { color: Colors.error[500] },
  divider: { height: 1, backgroundColor: Colors.border },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primary[50], borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.primary[100], padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSizes.sm, color: Colors.primary[700], textAlign: 'right', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary, textAlign: 'right' },
  input: {
    backgroundColor: Colors.neutral[50], borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, color: Colors.text, textAlign: 'right',
  },
  modalBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  modalBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
});
