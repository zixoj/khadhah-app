import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft, Eye, Lock, UserX, LogOut, MessageCircle,
  Shield, X, Phone, Trash2, AlertTriangle,
} from 'lucide-react-native';

interface PrivacyState {
  show_phone: boolean;
  allow_whatsapp: boolean;
  allow_messages: boolean;
}

interface BlockedUser {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
}

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const [privacy, setPrivacy] = useState<PrivacyState>({
    show_phone: true,
    allow_whatsapp: true,
    allow_messages: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Blocked users modal
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    fetchPrivacySettings();
  }, []);

  const fetchPrivacySettings = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('show_phone, allow_whatsapp, allow_messages')
      .eq('id', profile!.id)
      .maybeSingle();
    if (data) {
      setPrivacy({
        show_phone: data.show_phone ?? true,
        allow_whatsapp: data.allow_whatsapp ?? true,
        allow_messages: data.allow_messages ?? true,
      });
    }
    setLoading(false);
  };

  const savePrivacy = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    const { error: updateError } = await supabase
      .from('profiles')
      .update(privacy)
      .eq('id', profile!.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  };

  const changePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمتا المرور غير متطابقتين');
      return;
    }
    setPasswordSaving(true);
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) {
      setPasswordError(pwError.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 1500);
    }
    setPasswordSaving(false);
  };

  const fetchBlockedUsers = async () => {
    setBlockedLoading(true);
    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', profile!.id);

    if (blocks && blocks.length > 0) {
      const ids = blocks.map((b: any) => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', ids);
      if (profiles) setBlockedUsers(profiles as BlockedUser[]);
    } else {
      setBlockedUsers([]);
    }
    setBlockedLoading(false);
  };

  const openBlockedModal = () => {
    setShowBlockedModal(true);
    fetchBlockedUsers();
  };

  const unblockUser = async (blockedId: string) => {
    await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', profile!.id)
      .eq('blocked_id', blockedId);
    setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
  };

  const signOutAllDevices = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'حذف') return;
    // Mark account for deletion — actual deletion requires server-side
    await supabase
      .from('profiles')
      .update({ full_name: '[محذوف]', phone: '', avatar_url: '', city: '' })
      .eq('id', profile!.id);
    await signOut();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>الخصوصية والأمان</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>الخصوصية والأمان</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {saveSuccess && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>تم حفظ الإعدادات بنجاح</Text>
          </View>
        )}

        {/* خصوصية الملف الشخصي */}
        <Text style={styles.sectionLabel}>خصوصية الملف الشخصي</Text>
        <View style={styles.card}>
          <ToggleRow
            icon={<Eye size={20} color={Colors.primary[600]} />}
            label="إظهار رقم الجوال"
            description="يستطيع الآخرون رؤية رقمك"
            value={privacy.show_phone}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, show_phone: v }))}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={<Phone size={20} color="#25d366" />}
            label="السماح بالتواصل عبر واتساب"
            description="إظهار زر واتساب في ملفك الشخصي"
            value={privacy.allow_whatsapp}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, allow_whatsapp: v }))}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon={<MessageCircle size={20} color={Colors.primary[600]} />}
            label="السماح بالرسائل داخل التطبيق"
            description="يستطيع الآخرون مراسلتك داخل التطبيق"
            value={privacy.allow_messages}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, allow_messages: v }))}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={savePrivacy}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>حفظ إعدادات الخصوصية</Text>
          }
        </TouchableOpacity>

        {/* الأمان */}
        <Text style={styles.sectionLabel}>الأمان</Text>
        <View style={styles.card}>
          <ActionRow
            icon={<Lock size={20} color={Colors.primary[600]} />}
            label="تغيير كلمة المرور"
            onPress={() => setShowPasswordModal(true)}
          />
          <View style={styles.divider} />
          <ActionRow
            icon={<UserX size={20} color={Colors.neutral[500]} />}
            label="المستخدمون المحظورون"
            onPress={openBlockedModal}
          />
          <View style={styles.divider} />
          <ActionRow
            icon={<LogOut size={20} color={Colors.error[500]} />}
            label="تسجيل الخروج من جميع الأجهزة"
            onPress={signOutAllDevices}
            danger
          />
        </View>

        {/* منطقة الخطر */}
        <Text style={styles.sectionLabel}>منطقة الخطر</Text>
        <View style={styles.card}>
          <ActionRow
            icon={<Trash2 size={20} color={Colors.error[500]} />}
            label="حذف الحساب نهائياً"
            onPress={() => setShowDeleteModal(true)}
            danger
          />
        </View>

        {/* معلومات */}
        <View style={styles.infoBox}>
          <Shield size={18} color={Colors.primary[600]} />
          <Text style={styles.infoText}>
            نقوم بحماية بياناتك وفق أعلى معايير الأمان. إذا لاحظت أي نشاط مشبوه يرجى التواصل معنا فوراً.
          </Text>
        </View>
      </ScrollView>

      {/* Modal: تغيير كلمة المرور */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تغيير كلمة المرور</Text>
              <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPasswordError(null); setPasswordSuccess(false); }} hitSlop={8}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {passwordError && (
              <View style={styles.modalError}>
                <Text style={styles.modalErrorText}>{passwordError}</Text>
              </View>
            )}
            {passwordSuccess && (
              <View style={styles.modalSuccess}>
                <Text style={styles.modalSuccessText}>تم تغيير كلمة المرور بنجاح</Text>
              </View>
            )}

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
            <TouchableOpacity
              style={[styles.modalBtn, passwordSaving && styles.btnDisabled]}
              onPress={changePassword}
              disabled={passwordSaving}
              activeOpacity={0.8}
            >
              {passwordSaving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.modalBtnText}>تغيير كلمة المرور</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: المستخدمون المحظورون */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.modalSheetTall]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>المستخدمون المحظورون</Text>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)} hitSlop={8}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {blockedLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.primary[600]} />
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <UserX size={40} color={Colors.neutral[300]} />
                <Text style={styles.emptyText}>لا يوجد مستخدمون محظورون</Text>
              </View>
            ) : (
              <ScrollView>
                {blockedUsers.map((u) => (
                  <View key={u.id} style={styles.blockedRow}>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => unblockUser(u.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.unblockText}>إلغاء الحظر</Text>
                    </TouchableOpacity>
                    <Text style={styles.blockedName}>{u.full_name}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: حذف الحساب */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.error[600] }]}>حذف الحساب</Text>
              <TouchableOpacity onPress={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} hitSlop={8}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteWarning}>
              <AlertTriangle size={22} color={Colors.error[500]} />
              <Text style={styles.deleteWarningText}>
                سيتم حذف حسابك وجميع بياناتك نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </Text>
            </View>

            <Text style={styles.inputLabel}>اكتب "حذف" للتأكيد</Text>
            <TextInput
              style={[styles.input, styles.deleteInput]}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder='اكتب "حذف"'
              placeholderTextColor={Colors.neutral[400]}
              textAlign="right"
            />
            <TouchableOpacity
              style={[styles.deleteBtn, deleteConfirm !== 'حذف' && styles.btnDisabled]}
              onPress={handleDeleteAccount}
              disabled={deleteConfirm !== 'حذف'}
              activeOpacity={0.8}
            >
              <Text style={styles.deleteBtnText}>حذف الحساب نهائياً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToggleRow({
  icon, label, description, value, onValueChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.neutral[200], true: Colors.primary[300] }}
        thumbColor={value ? Colors.primary[600] : Colors.neutral[400]}
      />
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <View style={styles.iconBox}>{icon}</View>
    </View>
  );
}

function ActionRow({
  icon, label, onPress, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },

  errorBox: {
    backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[400],
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  errorText: { color: Colors.error[600], fontSize: FontSizes.sm, textAlign: 'right' },
  successBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  successText: { color: '#16a34a', fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },

  sectionLabel: {
    fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary, textAlign: 'right',
  },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.md,
  },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[50],
    justifyContent: 'center', alignItems: 'center',
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  actionLabel: { flex: 1, fontSize: FontSizes.md, color: Colors.text, fontWeight: '500', textAlign: 'right' },
  actionLabelDanger: { color: Colors.error[500] },

  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.primary[50], borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.primary[100], padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSizes.sm, color: Colors.primary[700], textAlign: 'right', lineHeight: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalSheetTall: { maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  modalError: {
    backgroundColor: Colors.error[50], borderRadius: BorderRadius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.error[400],
  },
  modalErrorText: { color: Colors.error[600], fontSize: FontSizes.sm, textAlign: 'right' },
  modalSuccess: {
    backgroundColor: '#f0fdf4', borderRadius: BorderRadius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: '#86efac',
  },
  modalSuccessText: { color: '#16a34a', fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },
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

  // Blocked users
  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  blockedName: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  unblockBtn: {
    backgroundColor: Colors.error[50], borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.error[400],
  },
  unblockText: { fontSize: FontSizes.sm, color: Colors.error[600], fontWeight: '600' },

  // Delete account
  deleteWarning: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.error[50], borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.error[100], padding: Spacing.md,
  },
  deleteWarningText: { flex: 1, fontSize: FontSizes.sm, color: Colors.error[600], textAlign: 'right', lineHeight: 20 },
  deleteInput: { borderColor: Colors.error[400] },
  deleteBtn: {
    backgroundColor: Colors.error[500], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  deleteBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
});
