import { useState, useEffect, useRef } from 'react';
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
import { useTheme } from '@/lib/ThemeContext';
import type { ThemeMode } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft, Eye, Lock, UserX, LogOut, MessageCircle,
  Shield, X, Phone, Trash2, AlertTriangle, Sun, Moon, Monitor,
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
  const { colors, isDark, mode, setMode } = useTheme();
  const C = colors;

  const [privacy, setPrivacy] = useState<PrivacyState>({
    show_phone: true,
    allow_whatsapp: true,
    allow_messages: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current); };
  }, []);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    fetchPrivacySettings();
  }, [profile?.id]);

  const fetchPrivacySettings = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('show_phone, allow_whatsapp, allow_messages')
        .eq('id', profile.id)
        .maybeSingle();
      if (data) {
        setPrivacy({
          show_phone: data.show_phone ?? true,
          allow_whatsapp: data.allow_whatsapp ?? true,
          allow_messages: data.allow_messages ?? true,
        });
      }
    } catch (e) {
      console.error('[privacy-security] fetchPrivacySettings:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePrivacy = async () => {
    if (!profile?.id) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    const { error: updateError } = await supabase
      .from('profiles')
      .update(privacy)
      .eq('id', profile.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
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
    if (!profile?.id) return;
    setBlockedLoading(true);
    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', profile.id);

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
    if (!profile?.id) return;
    await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', profile.id)
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
    if (!profile?.id) return;
    await supabase
      .from('profiles')
      .update({ full_name: '[محذوف]', phone: '', avatar_url: '', city: '' })
      .eq('id', profile.id);
    await signOut();
    router.replace('/(auth)/login');
  };

  const themeModes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'فاتح', icon: <Sun size={18} color={mode === 'light' ? C.primary : C.textMuted} /> },
    { value: 'dark', label: 'داكن', icon: <Moon size={18} color={mode === 'dark' ? C.primary : C.textMuted} /> },
    { value: 'system', label: 'تلقائي', icon: <Monitor size={18} color={mode === 'system' ? C.primary : C.textMuted} /> },
  ];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>الخصوصية والإعدادات</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
          hitSlop={12}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>الخصوصية والإعدادات</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: C.errorBg, borderColor: C.error }]}>
            <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
          </View>
        )}
        {saveSuccess && (
          <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(0,204,106,0.12)' : '#F0FDF4', borderColor: isDark ? C.primary : '#86EFAC' }]}>
            <Text style={[styles.successText, { color: C.primary }]}>تم حفظ الإعدادات بنجاح</Text>
          </View>
        )}

        {/* المظهر */}
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>المظهر</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
          <View style={styles.themeRow}>
            {themeModes.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: mode === t.value
                      ? (isDark ? `${C.primary}18` : `${C.primary}15`)
                      : (isDark ? C.surface : '#F4F7FA'),
                    borderColor: mode === t.value ? C.primary : (isDark ? C.border : '#E8EDF2'),
                  },
                ]}
                onPress={() => setMode(t.value)}
                activeOpacity={0.7}
              >
                {t.icon}
                <Text style={[styles.themeChipText, { color: mode === t.value ? C.primary : C.textSecondary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* خصوصية الملف الشخصي */}
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>خصوصية الملف الشخصي</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
          <ToggleRow
            icon={<Eye size={20} color={C.primary} />}
            label="إظهار رقم الجوال"
            description="يستطيع الآخرون رؤية رقمك"
            value={privacy.show_phone}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, show_phone: v }))}
            colors={C}
            isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? C.border : '#F0F4F8' }]} />
          <ToggleRow
            icon={<Phone size={20} color="#25D366" />}
            label="السماح بالتواصل عبر واتساب"
            description="إظهار زر واتساب في ملفك الشخصي"
            value={privacy.allow_whatsapp}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, allow_whatsapp: v }))}
            colors={C}
            isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? C.border : '#F0F4F8' }]} />
          <ToggleRow
            icon={<MessageCircle size={20} color={C.primary} />}
            label="السماح بالرسائل داخل التطبيق"
            description="يستطيع الآخرون مراسلتك داخل التطبيق"
            value={privacy.allow_messages}
            onValueChange={(v) => setPrivacy((p) => ({ ...p, allow_messages: v }))}
            colors={C}
            isDark={isDark}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, {
            backgroundColor: C.primary,
          }, saving && styles.btnDisabled]}
          onPress={savePrivacy}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.saveBtnText, { color: '#000' }]}>حفظ إعدادات الخصوصية</Text>
          }
        </TouchableOpacity>

        {/* الأمان */}
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>الأمان</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
          <ActionRow
            icon={<Lock size={20} color={C.primary} />}
            label="تغيير كلمة المرور"
            onPress={() => setShowPasswordModal(true)}
            colors={C}
            isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? C.border : '#F0F4F8' }]} />
          <ActionRow
            icon={<UserX size={20} color={C.textSecondary} />}
            label="المستخدمون المحظورون"
            onPress={openBlockedModal}
            colors={C}
            isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? C.border : '#F0F4F8' }]} />
          <ActionRow
            icon={<LogOut size={20} color={C.error} />}
            label="تسجيل الخروج من جميع الأجهزة"
            onPress={signOutAllDevices}
            colors={C}
            isDark={isDark}
            danger
          />
        </View>

        {/* منطقة الخطر */}
        <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>منطقة الخطر</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
          <ActionRow
            icon={<Trash2 size={20} color={C.error} />}
            label="حذف الحساب نهائياً"
            onPress={() => setShowDeleteModal(true)}
            colors={C}
            isDark={isDark}
            danger
          />
        </View>

        <View style={[styles.infoBox, {
          backgroundColor: isDark ? `${C.primary}10` : `${C.primary}0D`,
          borderColor: isDark ? `${C.primary}30` : `${C.primary}25`,
        }]}>
          <Shield size={18} color={C.primary} />
          <Text style={[styles.infoText, { color: C.textSecondary }]}>
            نقوم بحماية بياناتك وفق أعلى معايير الأمان. إذا لاحظت أي نشاط مشبوه يرجى التواصل معنا فوراً.
          </Text>
        </View>
      </ScrollView>

      {/* Modal: تغيير كلمة المرور */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#111714' : '#FFFFFF' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? C.border : '#CBD5E1' }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.text }]}>تغيير كلمة المرور</Text>
              <TouchableOpacity
                onPress={() => { setShowPasswordModal(false); setPasswordError(null); setPasswordSuccess(false); }}
                hitSlop={8}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
              >
                <X size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {passwordError && (
              <View style={[styles.modalFeedback, { backgroundColor: C.errorBg, borderColor: C.error }]}>
                <Text style={[styles.modalFeedbackText, { color: C.error }]}>{passwordError}</Text>
              </View>
            )}
            {passwordSuccess && (
              <View style={[styles.modalFeedback, { backgroundColor: isDark ? 'rgba(0,204,106,0.12)' : '#F0FDF4', borderColor: isDark ? C.primary : '#86EFAC' }]}>
                <Text style={[styles.modalFeedbackText, { color: C.primary }]}>تم تغيير كلمة المرور بنجاح</Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>كلمة المرور الجديدة</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="8 أحرف على الأقل"
              placeholderTextColor={C.textMuted}
              textAlign="right"
            />
            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>تأكيد كلمة المرور</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="أعد إدخال كلمة المرور"
              placeholderTextColor={C.textMuted}
              textAlign="right"
            />
            <TouchableOpacity
              style={[styles.modalBtn, {
                backgroundColor: C.primary,
              }, passwordSaving && styles.btnDisabled]}
              onPress={changePassword}
              disabled={passwordSaving}
              activeOpacity={0.8}
            >
              {passwordSaving
                ? <ActivityIndicator color="#000" />
                : <Text style={[styles.modalBtnText, { color: '#000' }]}>تغيير كلمة المرور</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: المستخدمون المحظورون */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.modalSheetTall, { backgroundColor: isDark ? '#111714' : '#FFFFFF' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? C.border : '#CBD5E1' }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.text }]}>المستخدمون المحظورون</Text>
              <TouchableOpacity
                onPress={() => setShowBlockedModal(false)}
                hitSlop={8}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
              >
                <X size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {blockedLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <UserX size={40} color={C.textMuted} />
                <Text style={[styles.emptyText, { color: C.textSecondary }]}>لا يوجد مستخدمون محظورون</Text>
              </View>
            ) : (
              <ScrollView>
                {blockedUsers.map((u) => (
                  <View key={u.id} style={[styles.blockedRow, { borderBottomColor: isDark ? C.border : '#F0F4F8' }]}>
                    <TouchableOpacity
                      style={[styles.unblockBtn, { backgroundColor: C.errorBg, borderColor: C.error }]}
                      onPress={() => unblockUser(u.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unblockText, { color: C.error }]}>إلغاء الحظر</Text>
                    </TouchableOpacity>
                    <Text style={[styles.blockedName, { color: C.text }]}>{u.full_name}</Text>
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
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#111714' : '#FFFFFF' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? C.border : '#CBD5E1' }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: C.error }]}>حذف الحساب</Text>
              <TouchableOpacity
                onPress={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                hitSlop={8}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
              >
                <X size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.deleteWarning, { backgroundColor: C.errorBg, borderColor: isDark ? C.error : '#FECACA' }]}>
              <AlertTriangle size={22} color={C.error} />
              <Text style={[styles.deleteWarningText, { color: C.error }]}>
                سيتم حذف حسابك وجميع بياناتك نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: C.textSecondary }]}>اكتب "حذف" للتأكيد</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.input, borderColor: C.error, color: C.text }]}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder='اكتب "حذف"'
              placeholderTextColor={C.textMuted}
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
  icon, label, description, value, onValueChange, colors: C, isDark,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? C.border : '#CBD5E1', true: `${C.primary}66` }}
        thumbColor={value ? C.primary : (isDark ? C.textMuted : '#94A3B8')}
      />
      <View style={styles.toggleText}>
        <Text style={[styles.toggleLabel, { color: C.text }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: C.textSecondary }]}>{description}</Text>
      </View>
      <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E2A24' : '#F4F7FA' }]}>{icon}</View>
    </View>
  );
}

function ActionRow({
  icon, label, onPress, danger = false, colors: C, isDark,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  colors: any;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.6}>
      <ChevronLeft size={18} color={C.textMuted} />
      <Text style={[styles.actionLabel, { color: danger ? C.error : C.text }]}>{label}</Text>
      <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E2A24' : '#F4F7FA' }]}>{icon}</View>
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
  navIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },

  errorBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  errorText: { fontSize: FontSizes.sm, textAlign: 'right' },
  successBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  successText: { fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },

  sectionLabel: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right' },
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },

  themeRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  themeChip: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  themeChipText: { fontSize: FontSizes.xs, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, gap: Spacing.md,
  },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, textAlign: 'right' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  actionLabel: { flex: 1, fontSize: FontSizes.md, fontWeight: '500', textAlign: 'right' },

  saveBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSizes.sm, textAlign: 'right', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg, gap: Spacing.md,
  },
  modalSheetTall: { maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.xs },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  modalFeedback: { borderRadius: BorderRadius.sm, padding: Spacing.sm, borderWidth: 1 },
  modalFeedbackText: { fontSize: FontSizes.sm, textAlign: 'right' },
  inputLabel: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, textAlign: 'right',
  },
  modalBtn: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  modalBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, borderBottomWidth: 1,
  },
  blockedName: { fontSize: FontSizes.md, fontWeight: '500' },
  unblockBtn: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  unblockText: { fontSize: FontSizes.sm, fontWeight: '600' },

  deleteWarning: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md,
  },
  deleteWarningText: { flex: 1, fontSize: FontSizes.sm, textAlign: 'right', lineHeight: 20 },
  deleteBtn: {
    backgroundColor: '#EF4444', borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '700' },
});
