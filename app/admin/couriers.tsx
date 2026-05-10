import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Truck, CheckCircle, XCircle, ShieldOff, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

type AccountStatus = 'active' | 'suspended' | 'banned';

interface CourierRow {
  id: string;
  full_name: string;
  username: string | null;
  phone: string;
  city: string;
  avatar_url: string;
  created_at: string;
  account_status: AccountStatus;
  rating_avg: number;
  rating_count: number;
  delivery_count: number;
}

const STATUS_LABELS: Record<AccountStatus, string> = { active: 'نشط', suspended: 'موقوف', banned: 'محظور' };
const STATUS_COLORS: Record<AccountStatus, string> = { active: C.primary, suspended: C.orange, banned: C.red };

const FILTER_TABS: { label: string; value: AccountStatus | 'all' }[] = [
  { label: 'الكل', value: 'all' },
  { label: 'نشط', value: 'active' },
  { label: 'موقوف', value: 'suspended' },
  { label: 'محظور', value: 'banned' },
];

export default function AdminCouriers() {
  const insets = useSafeAreaInsets();
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AccountStatus | 'all'>('all');
  const [selected, setSelected] = useState<CourierRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCouriers = useCallback(async () => {
    let q = supabase
      .from('profiles')
      .select('id, full_name, username, phone, city, avatar_url, created_at, account_status, rating_avg, rating_count')
      .eq('role', 'delivery_agent')
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('account_status', filter);

    const { data } = await q;
    const couriersData = (data ?? []) as (Omit<CourierRow, 'delivery_count'>)[];

    // Attach delivery counts
    const enriched = await Promise.all(
      couriersData.map(async (c) => {
        const { count } = await supabase
          .from('delivery_requests')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', c.id)
          .eq('status', 'delivered');
        return { ...c, delivery_count: count ?? 0 } as CourierRow;
      })
    );

    setCouriers(enriched);
  }, [filter]);

  useEffect(() => {
    fetchCouriers().finally(() => setLoading(false));
  }, [fetchCouriers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCouriers();
    setRefreshing(false);
  }, [fetchCouriers]);

  const callRpc = async (fn: string, args: Record<string, unknown>) => {
    setActionLoading(true);
    const { data, error } = await supabase.rpc(fn, args);
    setActionLoading(false);
    if (error || !data?.success) { Alert.alert('خطأ', error?.message ?? 'فشل'); return false; }
    return true;
  };

  const handleApprove = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_update_delivery_status', { p_user_id: selected.id, p_action: 'approve' });
    if (ok) { setSelected(null); await fetchCouriers(); }
  };

  const handleReject = async () => {
    if (!selected) return;
    Alert.alert('رفض الحساب', 'هل تريد رفض هذا المندوب؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض', style: 'destructive', onPress: async () => {
          const ok = await callRpc('admin_update_delivery_status', { p_user_id: selected.id, p_action: 'reject' });
          if (ok) { setSelected(null); await fetchCouriers(); }
        },
      },
    ]);
  };

  const handleSuspend = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_update_delivery_status', { p_user_id: selected.id, p_action: 'suspend' });
    if (ok) { setSelected(null); await fetchCouriers(); }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="إدارة المناديب" subtitle={`${couriers.length} مندوب`} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity key={t.value} style={[styles.filterTab, filter === t.value && styles.filterTabActive]} onPress={() => { setFilter(t.value); setLoading(true); }}>
            <Text style={[styles.filterTabText, filter === t.value && styles.filterTabTextActive]}>{t.label}</Text>
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
          {couriers.length === 0 && (
            <View style={styles.empty}>
              <Truck size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا يوجد مناديب</Text>
            </View>
          )}
          {couriers.map(c => (
            <TouchableOpacity key={c.id} style={styles.card} onPress={() => setSelected(c)} activeOpacity={0.82}>
              <View style={styles.cardInner}>
                {c.avatar_url ? (
                  <Image source={{ uri: c.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Truck size={20} color={C.primary} />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardName}>{c.full_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[c.account_status] + '20', borderColor: STATUS_COLORS[c.account_status] + '50' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[c.account_status] }]}>{STATUS_LABELS[c.account_status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSub}>{c.phone} · {c.city}</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statItem}>⭐ {c.rating_avg?.toFixed(1) ?? '0'}</Text>
                    <Text style={styles.statItem}>📦 {c.delivery_count} توصيل</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل المندوب</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View style={styles.modalAvatarRow}>
                {selected.avatar_url ? (
                  <Image source={{ uri: selected.avatar_url }} style={styles.modalAvatar} />
                ) : (
                  <View style={[styles.modalAvatar, styles.avatarFallback]}>
                    <Truck size={28} color={C.primary} />
                  </View>
                )}
                <View>
                  <Text style={styles.modalName}>{selected.full_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selected.account_status] + '20', borderColor: STATUS_COLORS[selected.account_status] + '50' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[selected.account_status] }]}>{STATUS_LABELS[selected.account_status]}</Text>
                  </View>
                </View>
              </View>

              <InfoRow label="الهاتف" value={selected.phone} />
              <InfoRow label="المدينة" value={selected.city || '—'} />
              <InfoRow label="التقييم" value={`${selected.rating_avg?.toFixed(1) ?? '0'} (${selected.rating_count ?? 0} تقييم)`} />
              <InfoRow label="التوصيلات المكتملة" value={String(selected.delivery_count)} />
              <InfoRow label="تاريخ التسجيل" value={new Date(selected.created_at).toLocaleDateString('ar-SA')} />

              <Text style={styles.actionsLabel}>الإجراءات</Text>
              <View style={styles.actionsGrid}>
                {selected.account_status !== 'active' && (
                  <ActionBtn label="قبول / تفعيل" icon={<CheckCircle size={16} color={C.primary} />} color={C.primary} onPress={handleApprove} loading={actionLoading} />
                )}
                {selected.account_status === 'active' && (
                  <ActionBtn label="توقيف مؤقت" icon={<ShieldOff size={16} color={C.orange} />} color={C.orange} onPress={handleSuspend} loading={actionLoading} />
                )}
                {selected.account_status !== 'banned' && (
                  <ActionBtn label="رفض / حظر" icon={<XCircle size={16} color={C.red} />} color={C.red} onPress={handleReject} loading={actionLoading} />
                )}
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
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + '40', backgroundColor: color + '10' }]} onPress={onPress} disabled={loading} activeOpacity={0.82}>
      {icon}
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: C.border },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: 'rgba(0,200,83,0.15)', borderColor: C.primary },
  filterTabText: { color: C.sub, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: C.primary },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: C.muted, fontSize: 16 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  cardInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 14 },
  avatarFallback: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(0,200,83,0.12)', justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { color: C.text, fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardSub: { color: C.muted, fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  statItem: { color: C.sub, fontSize: 12 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  modalAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  modalAvatar: { width: 64, height: 64, borderRadius: 20 },
  modalName: { color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  infoRow: { gap: 4 },
  infoLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: C.text, fontSize: 15 },
  actionsLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
