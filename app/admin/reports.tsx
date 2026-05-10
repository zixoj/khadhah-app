import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flag, ChevronDown, X, Check, Eye, Trash2, EyeOff, Ban, TriangleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

type ReportStatus = 'new' | 'under_review' | 'resolved' | 'rejected';

interface ReportRow {
  id: string;
  listing_id: string | null;
  reporter_id: string;
  reported_user_id: string | null;
  chat_room_id: string | null;
  reason: string;
  description: string;
  status: ReportStatus;
  admin_notes: string;
  reviewed_at: string | null;
  created_at: string;
  reporter: { full_name: string; username: string | null } | null;
  reported_user: { full_name: string; username: string | null } | null;
  listing: { title: string } | null;
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  new: 'جديد',
  under_review: 'قيد المراجعة',
  resolved: 'تم الحل',
  rejected: 'مرفوض',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  new: C.red,
  under_review: C.orange,
  resolved: C.primary,
  rejected: C.muted,
};

const FILTER_TABS: { label: string; value: ReportStatus | 'all' }[] = [
  { label: 'الكل', value: 'all' },
  { label: 'جديد', value: 'new' },
  { label: 'قيد المراجعة', value: 'under_review' },
  { label: 'تم الحل', value: 'resolved' },
  { label: 'مرفوض', value: 'rejected' },
];

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    let q = supabase
      .from('listing_reports')
      .select(`
        *,
        reporter:profiles!listing_reports_reporter_id_fkey(full_name, username),
        reported_user:profiles!listing_reports_reported_user_id_fkey(full_name, username),
        listing:listings(title)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;
    setReports((data as ReportRow[]) ?? []);
  }, [filter]);

  useEffect(() => {
    fetchReports().finally(() => setLoading(false));
  }, [fetchReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

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

  const handleResolve = async (status: 'under_review' | 'resolved' | 'rejected') => {
    if (!selected) return;
    const ok = await callRpc('admin_resolve_report', {
      p_report_id: selected.id,
      p_status: status,
      p_notes: notesInput,
    });
    if (ok) { setSelected(null); await fetchReports(); }
  };

  const handleHideListing = async () => {
    if (!selected?.listing_id) return;
    const ok = await callRpc('admin_hide_listing', { p_listing_id: selected.listing_id, p_reason: notesInput });
    if (ok) Alert.alert('تم', 'تم إخفاء الإعلان');
  };

  const handleBanUser = async () => {
    if (!selected?.reported_user_id) return;
    Alert.alert('تأكيد', 'هل تريد حظر هذا المستخدم؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حظر', style: 'destructive', onPress: async () => {
          const ok = await callRpc('admin_ban_user', { p_user_id: selected.reported_user_id, p_reason: notesInput });
          if (ok) Alert.alert('تم', 'تم حظر المستخدم');
        },
      },
    ]);
  };

  const handleDeleteListing = async () => {
    if (!selected?.listing_id) return;
    Alert.alert('تأكيد', 'هل تريد حذف هذا الإعلان نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          const ok = await callRpc('admin_delete_listing', { p_listing_id: selected.listing_id, p_reason: notesInput });
          if (ok) { setSelected(null); await fetchReports(); }
        },
      },
    ]);
  };

  const openReport = (r: ReportRow) => {
    setSelected(r);
    setNotesInput(r.admin_notes ?? '');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="إدارة البلاغات" subtitle={`${reports.length} بلاغ`} />

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.filterTab, filter === t.value && styles.filterTabActive]}
            onPress={() => { setFilter(t.value); setLoading(true); }}
          >
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
          {reports.length === 0 && (
            <View style={styles.empty}>
              <Flag size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا توجد بلاغات</Text>
            </View>
          )}
          {reports.map(r => (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openReport(r)} activeOpacity={0.82}>
              <View style={styles.cardTop}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[r.status] + '20', borderColor: STATUS_COLORS[r.status] + '50' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[r.status] }]}>{STATUS_LABELS[r.status]}</Text>
                </View>
                <Text style={styles.cardDate}>{new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
              </View>
              <Text style={styles.cardReason}>{r.reason}</Text>
              {r.description ? <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text> : null}
              <View style={styles.cardMeta}>
                <Text style={styles.cardMetaText}>المُبلِّغ: {r.reporter?.full_name ?? '—'}</Text>
                {r.reported_user && <Text style={styles.cardMetaText}>المُبلَّغ عنه: {r.reported_user.full_name}</Text>}
                {r.listing && <Text style={styles.cardMetaText}>الإعلان: {r.listing.title}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل البلاغ</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Status */}
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selected.status] + '20', borderColor: STATUS_COLORS[selected.status] + '50', alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[selected.status] }]}>{STATUS_LABELS[selected.status]}</Text>
              </View>

              <InfoRow label="السبب" value={selected.reason} />
              {selected.description ? <InfoRow label="التفاصيل" value={selected.description} /> : null}
              <InfoRow label="المُبلِّغ" value={selected.reporter?.full_name ?? '—'} />
              {selected.reported_user && <InfoRow label="المُبلَّغ عنه" value={selected.reported_user.full_name} />}
              {selected.listing && <InfoRow label="الإعلان المرتبط" value={selected.listing.title} />}
              <InfoRow label="التاريخ" value={new Date(selected.created_at).toLocaleString('ar-SA')} />

              {/* Admin notes */}
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>ملاحظات المشرف</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  placeholder="أضف ملاحظاتك هنا..."
                  placeholderTextColor={C.muted}
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                />
              </View>

              {/* Action buttons */}
              <Text style={styles.actionsLabel}>الإجراءات</Text>
              <View style={styles.actionsGrid}>
                <ActionBtn label="قيد المراجعة" icon={<Eye size={16} color={C.orange} />} color={C.orange} onPress={() => handleResolve('under_review')} loading={actionLoading} />
                <ActionBtn label="تم الحل" icon={<Check size={16} color={C.primary} />} color={C.primary} onPress={() => handleResolve('resolved')} loading={actionLoading} />
                <ActionBtn label="رفض البلاغ" icon={<X size={16} color={C.muted} />} color={C.muted} onPress={() => handleResolve('rejected')} loading={actionLoading} />
                {selected.listing_id && (
                  <ActionBtn label="إخفاء الإعلان" icon={<EyeOff size={16} color={C.orange} />} color={C.orange} onPress={handleHideListing} loading={actionLoading} />
                )}
                {selected.listing_id && (
                  <ActionBtn label="حذف الإعلان" icon={<Trash2 size={16} color={C.red} />} color={C.red} onPress={handleDeleteListing} loading={actionLoading} />
                )}
                {selected.reported_user_id && (
                  <ActionBtn label="حظر المستخدم" icon={<Ban size={16} color={C.red} />} color={C.red} onPress={handleBanUser} loading={actionLoading} />
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

  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardDate: { color: C.muted, fontSize: 12 },
  cardReason: { color: C.text, fontSize: 15, fontWeight: '600' },
  cardDesc: { color: C.sub, fontSize: 13, lineHeight: 20 },
  cardMeta: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  cardMetaText: { color: C.muted, fontSize: 12 },

  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1 },

  infoRow: { gap: 4 },
  infoLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: C.text, fontSize: 15 },

  notesSection: { gap: 8 },
  notesLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  notesInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 12, color: C.text, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top',
  },

  actionsLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
