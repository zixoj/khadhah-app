import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert, TextInput, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Package, EyeOff, Eye, Trash2, X, TriangleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

type StatusFilter = 'all' | 'available' | 'taken' | 'hidden';
type TypeFilter = 'all' | 'exchange' | 'free';

interface ListingRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  city: string;
  image_url: string;
  created_at: string;
  views_count: number;
  status: string;
  is_hidden: boolean;
  admin_note: string;
  owner: { full_name: string; username: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = { exchange: 'بدّل', free: 'خذه' };
const TYPE_COLORS: Record<string, string> = { exchange: C.blue, free: C.primary };

export default function AdminListings() {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<ListingRow | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchListings = useCallback(async () => {
    let q = supabase
      .from('listings')
      .select('id, user_id, title, description, category, type, city, image_url, created_at, views_count, status, is_hidden, admin_note, owner:profiles!listings_user_id_fkey(full_name, username)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    if (statusFilter === 'hidden') q = q.eq('is_hidden', true);
    else if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);

    const { data } = await q;
    setListings((data as unknown as ListingRow[]) ?? []);
  }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchListings().finally(() => setLoading(false)), 300);
    return () => clearTimeout(t);
  }, [fetchListings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, [fetchListings]);

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

  const handleHide = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_hide_listing', { p_listing_id: selected.id, p_reason: reasonInput });
    if (ok) { setSelected(null); await fetchListings(); }
  };

  const handleUnhide = async () => {
    if (!selected) return;
    const ok = await callRpc('admin_unhide_listing', { p_listing_id: selected.id });
    if (ok) { setSelected(null); await fetchListings(); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    Alert.alert('تأكيد الحذف', 'هل تريد حذف هذا الإعلان نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          const ok = await callRpc('admin_delete_listing', { p_listing_id: selected.id, p_reason: reasonInput });
          if (ok) { setSelected(null); await fetchListings(); }
        },
      },
    ]);
  };

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: 'الكل', value: 'all' },
    { label: 'متاح', value: 'available' },
    { label: 'مؤخوذ', value: 'taken' },
    { label: 'مخفي', value: 'hidden' },
  ];

  const TYPE_TABS: { label: string; value: TypeFilter }[] = [
    { label: 'الكل', value: 'all' },
    { label: 'بدّل', value: 'exchange' },
    { label: 'خذه', value: 'free' },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="إدارة الإعلانات" subtitle={`${listings.length} إعلان`} />

      <View style={styles.searchWrap}>
        <Search size={16} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالعنوان..."
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {STATUS_TABS.map(t => (
          <TouchableOpacity key={t.value} style={[styles.filterTab, statusFilter === t.value && styles.filterTabActive]} onPress={() => setStatusFilter(t.value)}>
            <Text style={[styles.filterTabText, statusFilter === t.value && styles.filterTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.filterDivider} />
        {TYPE_TABS.map(t => (
          <TouchableOpacity key={t.value} style={[styles.filterTab, typeFilter === t.value && styles.filterTabActive]} onPress={() => setTypeFilter(t.value)}>
            <Text style={[styles.filterTabText, typeFilter === t.value && styles.filterTabTextActive]}>{t.label}</Text>
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
          {listings.length === 0 && (
            <View style={styles.empty}>
              <Package size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا توجد إعلانات</Text>
            </View>
          )}
          {listings.map(l => (
            <TouchableOpacity key={l.id} style={[styles.card, l.is_hidden && styles.cardHidden]} onPress={() => { setSelected(l); setReasonInput(l.admin_note ?? ''); }} activeOpacity={0.82}>
              <View style={styles.cardInner}>
                {l.image_url ? (
                  <Image source={{ uri: l.image_url }} style={styles.thumb} />
                ) : (
                  <View style={styles.thumbFallback}><Package size={20} color={C.muted} /></View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
                    {l.is_hidden && (
                      <View style={styles.hiddenBadge}><EyeOff size={12} color={C.orange} /><Text style={styles.hiddenText}>مخفي</Text></View>
                    )}
                  </View>
                  <Text style={styles.cardOwner}>{l.owner?.full_name ?? '—'} · {l.city}</Text>
                  <View style={styles.cardTags}>
                    <View style={[styles.tag, { borderColor: (TYPE_COLORS[l.type] ?? C.muted) + '60' }]}>
                      <Text style={[styles.tagText, { color: TYPE_COLORS[l.type] ?? C.muted }]}>{TYPE_LABELS[l.type] ?? l.type}</Text>
                    </View>
                    <Text style={styles.cardViews}>{l.views_count ?? 0} مشاهدة</Text>
                    <Text style={styles.cardDate}>{new Date(l.created_at).toLocaleDateString('ar-SA')}</Text>
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
              <Text style={styles.modalTitle}>تفاصيل الإعلان</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalClose}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              {selected.image_url && <Image source={{ uri: selected.image_url }} style={styles.modalImage} resizeMode="cover" />}
              <Text style={styles.modalName}>{selected.title}</Text>
              {selected.description ? <Text style={styles.modalDesc}>{selected.description}</Text> : null}
              <InfoRow label="المالك" value={selected.owner?.full_name ?? '—'} />
              <InfoRow label="النوع" value={TYPE_LABELS[selected.type] ?? selected.type} />
              <InfoRow label="الفئة" value={selected.category} />
              <InfoRow label="المدينة" value={selected.city} />
              <InfoRow label="المشاهدات" value={String(selected.views_count ?? 0)} />
              <InfoRow label="الحالة" value={selected.status} />
              {selected.is_hidden && <InfoRow label="سبب الإخفاء" value={selected.admin_note} />}

              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>ملاحظة / سبب</Text>
                <TextInput
                  style={styles.notesInput}
                  value={reasonInput}
                  onChangeText={setReasonInput}
                  placeholder="سبب الإجراء..."
                  placeholderTextColor={C.muted}
                  multiline
                  numberOfLines={2}
                  textAlign="right"
                />
              </View>

              <Text style={styles.actionsLabel}>الإجراءات</Text>
              <View style={styles.actionsGrid}>
                {!selected.is_hidden ? (
                  <ActionBtn label="إخفاء الإعلان" icon={<EyeOff size={16} color={C.orange} />} color={C.orange} onPress={handleHide} loading={actionLoading} />
                ) : (
                  <ActionBtn label="إظهار الإعلان" icon={<Eye size={16} color={C.primary} />} color={C.primary} onPress={handleUnhide} loading={actionLoading} />
                )}
                <ActionBtn label="حذف نهائي" icon={<Trash2 size={16} color={C.red} />} color={C.red} onPress={handleDelete} loading={actionLoading} />
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
  filterDivider: { width: 1, height: 20, backgroundColor: C.border },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: C.muted, fontSize: 16 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border },
  cardHidden: { opacity: 0.6, borderColor: C.orange + '40' },
  cardInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  thumbFallback: { width: 60, height: 60, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  hiddenBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: C.orange + '20' },
  hiddenText: { color: C.orange, fontSize: 11, fontWeight: '600' },
  cardOwner: { color: C.muted, fontSize: 12 },
  cardTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tagText: { fontSize: 11, fontWeight: '600', color: C.sub },
  cardViews: { color: C.muted, fontSize: 11 },
  cardDate: { color: C.muted, fontSize: 11 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: '100%', height: 200, borderRadius: 16 },
  modalName: { color: C.text, fontSize: 20, fontWeight: '800' },
  modalDesc: { color: C.sub, fontSize: 14, lineHeight: 22 },
  infoRow: { gap: 4 },
  infoLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: C.text, fontSize: 15 },
  notesSection: { gap: 8 },
  notesLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  notesInput: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, color: C.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  actionsLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});
