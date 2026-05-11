import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Eye, Lock, UserX, LogOut, MessageCircle, Shield, X, Check } from 'lucide-react-native';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [showPhone, setShowPhone] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    fetchPrivacySettings();
  }, [profile?.id]);

  const fetchPrivacySettings = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('profiles').select('show_phone').eq('id', profile.id).maybeSingle();
      if (data) setShowPhone(data.show_phone ?? true);
    } catch (e) {
      console.error('[privacy-settings] fetchPrivacySettings:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePrivacy = async () => {
    if (!profile?.id) return;
    setSaving(true);
    await supabase.from('profiles').update({ show_phone: showPhone }).eq('id', profile.id);
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) { setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('كلمتا المرور غير متطابقتين'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    }
  };

  const signOutAllDevices = () => setSignOutConfirm(true);

  const confirmSignOut = async () => {
    setSignOutConfirm(false);
    await supabase.auth.signOut({ scope: 'global' });
    signOut();
    router.replace('/(auth)/login');
  };

  const cardBg = isDark ? '#111714' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const navBg = isDark ? '#0D1410' : '#FFFFFF';
  const inputBg = isDark ? '#1A2020' : '#F5F5F5';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';
  const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
  const sheetBg = isDark ? '#111714' : '#FFFFFF';
  const iconBoxBg = isDark ? '#1E2A24' : '#F0FDF4';

  if (loading) return <View style={[styles.center, { backgroundColor: C.background }]}><ActivityIndicator size="large" color={C.primary} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: navBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>الخصوصية والأمان</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {saveSuccess && (
          <View style={[styles.successBanner, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(0,200,83,0.30)' : '#6EE7B7' }]}>
            <Check size={16} color={isDark ? '#00C853' : '#166534'} />
            <Text style={[styles.successText, { color: isDark ? '#00C853' : '#166534' }]}>تم حفظ إعدادات الخصوصية</Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>خصوصية الملف الشخصي</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.toggleRow}>
            <Switch
              value={showPhone}
              onValueChange={setShowPhone}
              trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: C.primary }}
              thumbColor={showPhone ? '#000' : isDark ? '#9CA3AF' : '#6B7280'}
            />
            <View style={styles.toggleText}>
              <Text style={[styles.toggleLabel, { color: C.text }]}>إظهار رقم الجوال</Text>
              <Text style={[styles.toggleDesc, { color: C.textSecondary }]}>يستطيع الآخرون رؤية رقمك</Text>
            </View>
            <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}><Eye size={20} color={C.primary} /></View>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={savePrivacy} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>حفظ إعدادات الخصوصية</Text>}
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>الأمان</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ActionRow icon={<Lock size={20} color={C.primary} />} label="تغيير كلمة المرور" onPress={() => setShowPasswordModal(true)} textColor={C.text} iconBg={iconBoxBg} dividerColor={cardBorder} chevronColor={C.textMuted} />
          <View style={[styles.divider, { backgroundColor: cardBorder }]} />
          <ActionRow icon={<LogOut size={20} color={C.error} />} label="تسجيل الخروج من جميع الأجهزة" onPress={signOutAllDevices} danger textColor={C.text} iconBg={isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5'} dividerColor={cardBorder} chevronColor={C.textMuted} />
        </View>

        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>حماية الحساب</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <ActionRow icon={<Shield size={20} color={C.primary} />} label="توثيق الحساب (طلب شارة موثوق)" onPress={() => {}} textColor={C.text} iconBg={iconBoxBg} dividerColor={cardBorder} chevronColor={C.textMuted} />
          <View style={[styles.divider, { backgroundColor: cardBorder }]} />
          <ActionRow icon={<UserX size={20} color={C.error} />} label="الإبلاغ عن مستخدم" onPress={() => {}} danger textColor={C.text} iconBg={isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5'} dividerColor={cardBorder} chevronColor={C.textMuted} />
        </View>

        <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(0,200,83,0.08)' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.20)' : '#BBF7D0' }]}>
          <Shield size={18} color={C.primary} />
          <Text style={[styles.infoText, { color: isDark ? '#A0A0A0' : '#166534' }]}>نقوم بمراقبة الحسابات الوهمية وإيقافها تلقائياً. إذا اكتشفت حساباً مزيفاً يرجى الإبلاغ عنه.</Text>
        </View>
      </ScrollView>

      {/* تغيير كلمة المرور */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.50)' }]}>
          <View style={[styles.modalSheet, { backgroundColor: sheetBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.text }]}>تغيير كلمة المرور</Text>
              <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPasswordError(null); setPasswordSuccess(false); }}>
                <X size={22} color={C.text} />
              </TouchableOpacity>
            </View>

            {passwordSuccess ? (
              <View style={[styles.successBanner, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(0,200,83,0.30)' : '#6EE7B7' }]}>
                <Check size={16} color={isDark ? '#00C853' : '#166534'} />
                <Text style={[styles.successText, { color: isDark ? '#00C853' : '#166534' }]}>تم تغيير كلمة المرور بنجاح</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: C.textSecondary }]}>كلمة المرور الجديدة</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="8 أحرف على الأقل"
                  placeholderTextColor={placeholderColor}
                  textAlign="right"
                />
                <Text style={[styles.inputLabel, { color: C.textSecondary }]}>تأكيد كلمة المرور</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="أعد إدخال كلمة المرور"
                  placeholderTextColor={placeholderColor}
                  textAlign="right"
                />
                {passwordError && (
                  <Text style={[styles.errorText, { color: isDark ? '#FF6B6B' : '#CC2222' }]}>{passwordError}</Text>
                )}
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: C.primary }]} onPress={changePassword} activeOpacity={0.8}>
                  <Text style={styles.modalBtnText}>تغيير كلمة المرور</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* تسجيل الخروج */}
      <Modal visible={signOutConfirm} transparent animationType="fade" onRequestClose={() => setSignOutConfirm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.50)' }]}>
          <View style={[styles.confirmSheet, { backgroundColor: sheetBg }]}>
            <Text style={[styles.confirmTitle, { color: C.text }]}>تسجيل الخروج من جميع الأجهزة</Text>
            <Text style={[styles.confirmDesc, { color: C.textSecondary }]}>هل أنت متأكد؟ سيتم تسجيل خروجك من جميع الأجهزة.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={[styles.confirmCancelBtn, { borderColor: cardBorder }]} onPress={() => setSignOutConfirm(false)} activeOpacity={0.7}>
                <Text style={[styles.confirmCancelText, { color: C.text }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDangerBtn, { backgroundColor: C.error }]} onPress={confirmSignOut} activeOpacity={0.7}>
                <Text style={styles.confirmDangerText}>تأكيد الخروج</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActionRow({ icon, label, onPress, danger = false, textColor, iconBg, dividerColor, chevronColor }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  textColor: string;
  iconBg: string;
  dividerColor: string;
  chevronColor: string;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.6}>
      <ChevronLeft size={18} color={chevronColor} />
      <Text style={[styles.actionLabel, { color: danger ? '#EF4444' : textColor }]}>{label}</Text>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  successText: { fontSize: FontSizes.sm, fontWeight: '600' },
  sectionLabel: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right' },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, textAlign: 'right' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
  },
  actionLabel: { flex: 1, fontSize: FontSizes.md, fontWeight: '500', textAlign: 'right' },
  divider: { height: 1 },
  saveBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#000', fontSize: FontSizes.lg, fontWeight: '700' },
  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSizes.sm, textAlign: 'right', lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, textAlign: 'right',
  },
  errorText: { fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },
  modalBtn: {
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center',
  },
  modalBtnText: { color: '#000', fontSize: FontSizes.lg, fontWeight: '700' },
  confirmSheet: {
    margin: Spacing.lg, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.md,
  },
  confirmTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  confirmDesc: { fontSize: FontSizes.md, textAlign: 'center', lineHeight: 22 },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md },
  confirmCancelBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  confirmCancelText: { fontSize: FontSizes.md, fontWeight: '600' },
  confirmDangerBtn: {
    flex: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center',
  },
  confirmDangerText: { color: '#FFF', fontSize: FontSizes.md, fontWeight: '700' },
});
