import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert, TextInput,
} from 'react-native';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, User, Ban, ShieldOff, ShieldCheck, Trash2, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

type AccountStatus = 'active' | 'suspended' | 'banned';
type RoleFilter = 'all' | 'advertiser' | 'delivery_agent' | 'admin';

interface UserRow {
  id: string;
  full_name: string;
  username: string | null;
  phone: string;
  role: string;
  avatar_url: string;
  city: string;
  created_at: string;
  account_status: AccountStatus;
  rating_avg: number;
  rating_count: number;
}

const STATUS_COLORS: Record<AccountStatus, string> = {
  active: C.primary,
  suspended: C.orange,
  banned: C.red,
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'نشط',
  suspended: 'موقوف',
  banned: 'محظور',
};

const ROLE_LABELS: Record<string, string> = {
  advertiser: 'مُعلِن',
  delivery_agent: 'مندوب',
  admin: 'مشرف',
};

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    let q = supabase
      .from('profiles')
      .select('id, full_name, username, phone, role, avatar_url, city, created_at, account_status, rating_avg, rating_count')
      .order('created_at', { ascending: false })
      .limit(200);

    if (roleFilter !== 'all') q = q.eq('role', roleFilter);
    if (search.trim()) q = q.ilike('full_name', `%${search.trim()}%`);

    const { data } = await q;
    setUsers((data as UserRow[]) ?? []);
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers().finally(() => setLoading(false)), 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const callRpc = async (fn: string, args: Record<string, unknown>) => {
    setActionLoading(true);
    const { data, error } = await supabase.rpc(fn, args);
    setActionLoading(false);
    if (error || !data?.success) {
      Alert.alert('خطأ', error?.message ?? 'فشل تنفيذ الإجراء');
      return false;
    }
    return true;
  };

  const handleBan = async () => {
    if (!selected) return;
    Alert.alert('تأكيد الحظر', `هل تريد حظر ${selected.full_name}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حظر', style: 'destructive', onPress: async () => {
          const ok = await callRpc('admin_ban_user', { p_user_id: selected.id, p_reason: reasonInput });
          if (ok) { setSelected(null); await fetchUsers(); }
        },
      },
    ]);
  };

  const handleSuspend = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_suspend_user', { p_user_id: selected.id, p_reason: reasonInput });
    if (ok) { setSelected(null); await fetchUsers(); }
  };

  const handleUnban = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_unban_user', { p_user_id: selected.id });
    if (ok) { setSelected(null); await fetchUsers(); }
  };

  const handleWarn = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_warn_user', { p_user_id: selected.id, p_note: reasonInput });
    if (ok) { Alert.alert('تم', 'تم إرسال التحذير وتسجيله'); }
  };

  const ROLE_TABS: { label: string; value: RoleFilter }[] = [
    { label: 'الكل', value: 'all' },
    { label: 'مُعلِن', value: 'advertiser' },
    { label: 'مندوب', value: 'delivery_agent' },
    { label: 'مشرف', value: 'admin' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="إدارة المستخدمين" subtitle={`${users.length} مستخدم`} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      {/* Role filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {ROLE_TABS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.filterTab, roleFilter === t.value && styles.filterTabActive]}
            onPress={() => setRoleFilter(t.value)}
          >
            <Text style={[styles.filterTabText, roleFilter === t.value && styles.filterTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {users.length === 0 && (
            <View style={styles.empty}>
              <User size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا يوجد مستخدمون</Text>
            </View>
          )}
          {users.map(u => (
            <TouchableOpacity key={u.id} style={styles.card} onPress={() => { setSelected(u); setReasonInput(''); }} activeOpacity={0.82}>
              <View style={styles.cardLeft}>
                {u.avatar_url ? (
                  <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{(u.full_name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardName}>{u.full_name}</Text>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[u.account_status] }]} />
                </View>
                <Text style={styles.cardSub}>{u.username ? `@${u.username}` : u.phone}</Text>
                <View style={styles.cardTags}>
                  <View style={styles.tag}><Text style={styles.tagText}>{ROLE_LABELS[u.role] ?? u.role}</Text></View>
                  {u.city ? <View style={styles.tag}><Text style={styles.tagText}>{u.city}</Text></View> : null}
                  <View style={[styles.tag, { borderColor: STATUS_COLORS[u.account_status] + '60' }]}>
                    <Text style={[styles.tagText, { color: STATUS_COLORS[u.account_status] }]}>{STATUS_LABELS[u.account_status]}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* User detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل المستخدم</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Avatar */}
              <View style={styles.modalAvatarRow}>
                {selected.avatar_url ? (
                  <Image source={{ uri: selected.avatar_url }} style={styles.modalAvatar} />
                ) : (
                  <View style={[styles.modalAvatar, styles.avatarFallbackLarge]}>
                    <Text style={styles.avatarInitialLarge}>{(selected.full_name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.modalName}>{selected.full_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selected.account_status] + '20', borderColor: STATUS_COLORS[selected.account_status] + '50' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[selected.account_status] }]}>{STATUS_LABELS[selected.account_status]}</Text>
                  </View>
                </View>
              </View>

              {/* Info */}
              {selected.username && <InfoRow label="اسم المستخدم" value={`@${selected.username}`} />}
              <InfoRow label="الهاتف" value={selected.phone || '—'} />
              <InfoRow label="الدور" value={ROLE_LABELS[selected.role] ?? selected.role} />
              <InfoRow label="المدينة" value={selected.city || '—'} />
              <InfoRow label="تاريخ التسجيل" value={new Date(selected.created_at).toLocaleDateString('ar-SA')} />
              <InfoRow label="التقييم" value={`${selected.rating_avg?.toFixed(1) ?? '0'} (${selected.rating_count ?? 0} تقييم)`} />

              {/* Reason input */}
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>سبب الإجراء</Text>
                <TextInput
                  style={styles.notesInput}
                  value={reasonInput}
                  onChangeText={setReasonInput}
                  placeholder="اكتب السبب هنا..."
                  placeholderTextColor={C.muted}
                  multiline
                  numberOfLines={2}
                  textAlign="right"
                />
              </View>

              {/* Actions */}
              <Text style={styles.actionsLabel}>الإجراءات</Text>
              <View style={styles.actionsGrid}>
                {selected.account_status !== 'banned' && (
                  <ActionBtn label="حظر" icon={<Ban size={16} color={C.red} />} color={C.red} onPress={handleBan} loading={actionLoading} />
                )}
                {selected.account_status === 'active' && (
                  <ActionBtn label="توقيف مؤقت" icon={<ShieldOff size={16} color={C.orange} />} color={C.orange} onPress={handleSuspend} loading={actionLoading} />
                )}
                {selected.account_status !== 'active' && (
                  <ActionBtn label="رفع الحظر" icon={<ShieldCheck size={16} color={C.primary} />} color={C.primary} onPress={handleUnban} loading={actionLoading} />
                )}
                <ActionBtn label="تحذير" icon={<Trash2 size={16} color={C.orange} />} color={C.orange} onPress={handleWarn} loading={actionLoading} />
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, icon, color, onPress, loading }: { label: string; icon: React.ReactNode; color: string; onPress: () => void; loading: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color + '40', backgroundColor: color + '10' }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.82}
    >
      {icon}
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },

  filterScroll: { maxHeight: 48 },
  filterContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center', paddingVertical: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: 'rgba(0,200,83,0.15)', borderColor: C.primary },
  filterTabText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: C.primary },

  list: { flex: 1 },
  listContent: { padding: 12, gap: 10 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: C.muted, fontSize: 16 },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  cardLeft: {},
  avatar: { width: 46, height: 46, borderRadius: 14 },
  avatarFallback: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(0,200,83,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: C.primary, fontSize: 18, fontWeight: '700' },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { color: C.text, fontSize: 15, fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardSub: { color: C.muted, fontSize: 12 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tagText: { color: C.sub, fontSize: 11, fontWeight: '600' },

  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1 },

  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  modalAvatar: { width: 64, height: 64, borderRadius: 20 },
  avatarFallbackLarge: { backgroundColor: 'rgba(0,200,83,0.15)', justifyContent: 'center', alignItems: 'center' },
  avatarInitialLarge: { color: C.primary, fontSize: 26, fontWeight: '700' },
  modalName: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '700' },

  infoRow: { gap: 4 },
  infoLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: C.text, fontSize: 15 },

  notesSection: { gap: 8 },
  notesLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  notesInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 12, color: C.text, fontSize: 14,
    minHeight: 60, textAlignVertical: 'top',
  },

  actionsLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
