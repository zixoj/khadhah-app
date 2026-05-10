import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert, Ban, EyeOff, Trash2, MessageSquare, Truck, CheckCircle, TriangleAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

interface LogRow {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  admin: { full_name: string } | null;
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ban_user: { label: 'حظر مستخدم', color: C.red, icon: <Ban size={14} color={C.red} /> },
  suspend_user: { label: 'توقيف مستخدم', color: C.orange, icon: <ShieldAlert size={14} color={C.orange} /> },
  unban_user: { label: 'رفع الحظر', color: C.primary, icon: <CheckCircle size={14} color={C.primary} /> },
  warn_user: { label: 'تحذير مستخدم', color: C.orange, icon: <TriangleAlert size={14} color={C.orange} /> },
  hide_listing: { label: 'إخفاء إعلان', color: C.orange, icon: <EyeOff size={14} color={C.orange} /> },
  unhide_listing: { label: 'إظهار إعلان', color: C.primary, icon: <CheckCircle size={14} color={C.primary} /> },
  delete_listing: { label: 'حذف إعلان', color: C.red, icon: <Trash2 size={14} color={C.red} /> },
  resolve_report: { label: 'معالجة بلاغ', color: C.blue, icon: <ShieldAlert size={14} color={C.blue} /> },
  update_delivery_status: { label: 'تحديث حالة مندوب', color: '#A78BFA', icon: <Truck size={14} color="#A78BFA" /> },
};

const TARGET_LABELS: Record<string, string> = {
  user: 'مستخدم',
  listing: 'إعلان',
  report: 'بلاغ',
  chat: 'محادثة',
  delivery: 'توصيل',
};

type ActionFilter = 'all' | 'user' | 'listing' | 'report';

export default function AdminLogs() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (p = 0) => {
    let q = supabase
      .from('admin_logs')
      .select('*, admin:profiles!admin_logs_admin_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1);

    if (filter !== 'all') q = q.eq('target_type', filter);

    const { data } = await q;
    if (p === 0) setLogs((data as LogRow[]) ?? []);
    else setLogs(prev => [...prev, ...((data as LogRow[]) ?? [])]);
  }, [filter]);

  useEffect(() => {
    setPage(0);
    setLoading(true);
    fetchLogs(0).finally(() => setLoading(false));
  }, [fetchLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    await fetchLogs(0);
    setRefreshing(false);
  }, [fetchLogs]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next);
  };

  const FILTER_TABS: { label: string; value: ActionFilter }[] = [
    { label: 'الكل', value: 'all' },
    { label: 'المستخدمون', value: 'user' },
    { label: 'الإعلانات', value: 'listing' },
    { label: 'البلاغات', value: 'report' },
  ];

  const formatDetails = (details: Record<string, unknown>): string => {
    if (!details) return '';
    const parts: string[] = [];
    if (details.reason) parts.push(`السبب: ${details.reason}`);
    if (details.note) parts.push(`الملاحظة: ${details.note}`);
    if (details.status) parts.push(`الحالة: ${details.status}`);
    if (details.action) parts.push(`الإجراء: ${details.action}`);
    return parts.join(' · ');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="سجلات الأمان" subtitle="نشاط المشرفين" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity key={t.value} style={[styles.filterTab, filter === t.value && styles.filterTabActive]} onPress={() => setFilter(t.value)}>
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
          {logs.length === 0 && (
            <View style={styles.empty}>
              <ShieldAlert size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا توجد سجلات</Text>
            </View>
          )}
          {logs.map(log => {
            const meta = ACTION_META[log.action] ?? { label: log.action, color: C.sub, icon: <ShieldAlert size={14} color={C.sub} /> };
            const details = formatDetails(log.details);
            return (
              <View key={log.id} style={styles.logRow}>
                <View style={[styles.logIcon, { backgroundColor: meta.color + '18' }]}>
                  {meta.icon}
                </View>
                <View style={styles.logBody}>
                  <View style={styles.logTop}>
                    <Text style={[styles.logAction, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
                  </View>
                  <Text style={styles.logAdmin}>بواسطة: {log.admin?.full_name ?? 'نظام'}</Text>
                  <Text style={styles.logTarget}>
                    {TARGET_LABELS[log.target_type] ?? log.target_type}
                    {log.target_id ? ` · ${log.target_id.slice(0, 8)}...` : ''}
                  </Text>
                  {details ? <Text style={styles.logDetails}>{details}</Text> : null}
                </View>
              </View>
            );
          })}
          {logs.length >= PAGE_SIZE && (
            <TouchableOpacity style={styles.loadMore} onPress={loadMore}>
              <Text style={styles.loadMoreText}>تحميل المزيد</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  listContent: { padding: 16, gap: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: C.muted, fontSize: 16 },
  logRow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  logIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  logBody: { flex: 1, gap: 3 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 14, fontWeight: '700' },
  logTime: { color: C.muted, fontSize: 11 },
  logAdmin: { color: C.sub, fontSize: 12 },
  logTarget: { color: C.muted, fontSize: 11 },
  logDetails: { color: C.sub, fontSize: 12, marginTop: 2 },
  loadMore: { paddingVertical: 16, alignItems: 'center' },
  loadMoreText: { color: C.primary, fontSize: 14, fontWeight: '600' },
});
