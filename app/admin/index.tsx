import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Flag, Users, Package, MessageSquare, Truck,
  ShieldAlert, BarChart3, LogOut, TrendingUp, AlertCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

interface Stats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalListings: number;
  hiddenListings: number;
  totalReports: number;
  newReports: number;
  underReviewReports: number;
  totalChats: number;
  couriers: number;
}

interface NavItem {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  route: string;
  accent: string;
  badge?: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: bannedUsers },
      { count: totalListings },
      { count: hiddenListings },
      { count: totalReports },
      { count: newReports },
      { count: underReview },
      { count: totalChats },
      { count: couriers },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'active'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'banned'),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('is_hidden', true),
      supabase.from('listing_reports').select('*', { count: 'exact', head: true }),
      supabase.from('listing_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('listing_reports').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
      supabase.from('chat_rooms').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'delivery_agent'),
    ]);

    setStats({
      totalUsers: totalUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      bannedUsers: bannedUsers ?? 0,
      totalListings: totalListings ?? 0,
      hiddenListings: hiddenListings ?? 0,
      totalReports: totalReports ?? 0,
      newReports: newReports ?? 0,
      underReviewReports: underReview ?? 0,
      totalChats: totalChats ?? 0,
      couriers: couriers ?? 0,
    });
  }, []);

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const navItems: NavItem[] = [
    {
      label: 'البلاغات',
      sublabel: 'إدارة ومراجعة البلاغات',
      icon: <Flag size={22} color={C.red} />,
      route: '/admin/reports',
      accent: C.red,
      badge: stats?.newReports,
    },
    {
      label: 'المستخدمون',
      sublabel: 'إدارة الحسابات والصلاحيات',
      icon: <Users size={22} color={C.blue} />,
      route: '/admin/users',
      accent: C.blue,
    },
    {
      label: 'الإعلانات',
      sublabel: 'مراجعة وإدارة المنشورات',
      icon: <Package size={22} color={C.primary} />,
      route: '/admin/listings',
      accent: C.primary,
      badge: stats?.hiddenListings ? undefined : undefined,
    },
    {
      label: 'المحادثات',
      sublabel: 'مراقبة المحادثات المُبلَّغ عنها',
      icon: <MessageSquare size={22} color={C.orange} />,
      route: '/admin/conversations',
      accent: C.orange,
    },
    {
      label: 'المناديب',
      sublabel: 'طلبات التوصيل والمناديب',
      icon: <Truck size={22} color="#A78BFA" />,
      route: '/admin/couriers',
      accent: '#A78BFA',
    },
    {
      label: 'سجلات الأمان',
      sublabel: 'مراجعة نشاط المشرفين',
      icon: <ShieldAlert size={22} color="#34D399" />,
      route: '/admin/logs',
      accent: '#34D399',
    },
  ];

  const analyticsCards = stats ? [
    { label: 'إجمالي المستخدمين', value: stats.totalUsers, color: C.blue, icon: <Users size={16} color={C.blue} /> },
    { label: 'مستخدمون نشطون', value: stats.activeUsers, color: C.primary, icon: <TrendingUp size={16} color={C.primary} /> },
    { label: 'بلاغات جديدة', value: stats.newReports, color: C.red, icon: <AlertCircle size={16} color={C.red} /> },
    { label: 'إجمالي الإعلانات', value: stats.totalListings, color: C.orange, icon: <Package size={16} color={C.orange} /> },
    { label: 'محادثات', value: stats.totalChats, color: '#34D399', icon: <MessageSquare size={16} color="#34D399" /> },
    { label: 'مناديب', value: stats.couriers, color: '#A78BFA', icon: <Truck size={16} color="#A78BFA" /> },
  ] : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <Text style={styles.headerSub}>مرحباً، {profile?.full_name ?? 'مشرف'}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.adminBadge}>
            <ShieldAlert size={12} color={C.primary} />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <LogOut size={18} color={C.sub} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        {/* Analytics row */}
        <Text style={styles.sectionLabel}>نظرة عامة</Text>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.analyticsScroll}>
            {analyticsCards.map((c, i) => (
              <View key={i} style={[styles.analyticsCard, { borderColor: c.color + '33' }]}>
                <View style={[styles.analyticsIcon, { backgroundColor: c.color + '18' }]}>{c.icon}</View>
                <Text style={[styles.analyticsValue, { color: c.color }]}>{c.value.toLocaleString('ar')}</Text>
                <Text style={styles.analyticsLabel}>{c.label}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Alert strip for pending reports */}
        {stats && stats.newReports > 0 && (
          <TouchableOpacity
            style={styles.alertStrip}
            onPress={() => router.push('/admin/reports')}
            activeOpacity={0.82}
          >
            <AlertCircle size={16} color={C.red} />
            <Text style={styles.alertText}>
              يوجد {stats.newReports} بلاغ جديد بانتظار المراجعة
            </Text>
            <Text style={styles.alertAction}>عرض ←</Text>
          </TouchableOpacity>
        )}

        {/* Nav grid */}
        <Text style={styles.sectionLabel}>الأقسام</Text>
        <View style={styles.grid}>
          {navItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.navCard, { borderColor: item.accent + '28' }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.82}
            >
              <View style={[styles.navIcon, { backgroundColor: item.accent + '18' }]}>
                {item.icon}
              </View>
              {item.badge != null && item.badge > 0 && (
                <View style={[styles.navBadge, { backgroundColor: item.accent }]}>
                  <Text style={styles.navBadgeText}>{item.badge}</Text>
                </View>
              )}
              <Text style={styles.navLabel}>{item.label}</Text>
              <Text style={styles.navSub}>{item.sublabel}</Text>
              <View style={[styles.navArrow, { backgroundColor: item.accent + '18' }]}>
                <Text style={[styles.navArrowText, { color: item.accent }]}>←</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats summary row */}
        {stats && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: C.red }]}>{stats.bannedUsers}</Text>
              <Text style={styles.summaryLbl}>محظور</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: C.orange }]}>{stats.hiddenListings}</Text>
              <Text style={styles.summaryLbl}>إعلان مخفي</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#A78BFA' }]}>{stats.underReviewReports}</Text>
              <Text style={styles.summaryLbl}>قيد المراجعة</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: C.primary }]}>{stats.totalReports}</Text>
              <Text style={styles.summaryLbl}>إجمالي البلاغات</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(0,200,83,0.12)',
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.30)',
  },
  adminBadgeText: { color: C.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  logoutBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  sectionLabel: { color: C.sub, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: -8 },

  loadingWrap: { height: 100, justifyContent: 'center', alignItems: 'center' },

  analyticsScroll: { marginHorizontal: -4 },
  analyticsCard: {
    width: 110, marginHorizontal: 4, padding: 14, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, gap: 6,
  },
  analyticsIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  analyticsValue: { fontSize: 26, fontWeight: '800' },
  analyticsLabel: { color: C.sub, fontSize: 11, lineHeight: 15 },

  alertStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,59,48,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.25)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  alertText: { flex: 1, color: '#FF3B30', fontSize: 13, fontWeight: '600' },
  alertAction: { color: '#FF3B30', fontSize: 13, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  navCard: {
    width: '47%', padding: 16, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1,
    gap: 8, position: 'relative',
  },
  navIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  navBadge: {
    position: 'absolute', top: 10, right: 10,
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  navBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  navLabel: { color: C.text, fontSize: 15, fontWeight: '700' },
  navSub: { color: C.muted, fontSize: 11, lineHeight: 16 },
  navArrow: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  navArrowText: { fontSize: 14, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1, padding: 12, borderRadius: 14,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', gap: 4,
  },
  summaryVal: { fontSize: 22, fontWeight: '800' },
  summaryLbl: { color: C.sub, fontSize: 10, textAlign: 'center' },
});
