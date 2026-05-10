import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ShieldCheck, MapPin, Calendar, Package,
  Star, ArrowLeftRight, Gift, Flame, User, Phone,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, FontSizes, BorderRadius } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PublicProfile {
  id: string;
  full_name: string;
  display_name: string | null;
  username: string | null;
  role: string;
  avatar_url: string | null;
  city: string;
  created_at: string;
  is_verified: boolean;
  phone_verified: boolean;
  rating_avg: number;
  rating_count: number;
  show_phone: boolean;
  phone: string;
  active_listings_count: number;
}

interface ListingCard {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  city: string;
  image_url: string;
  created_at: string;
  status: string;
  is_urgent: boolean;
  dual_mode: boolean;
  views_count: number;
  interest_count: number;
}

const ROLE_LABELS: Record<string, string> = {
  advertiser: 'مُعلِن',
  delivery_agent: 'مندوب توصيل',
};

const CATEGORY_LABEL: Record<string, string> = {
  electronics: 'إلكترونيات', clothing: 'ملابس', furniture: 'أثاث',
  books: 'كتب', toys: 'ألعاب', home_tools: 'أدوات منزلية',
  cars: 'سيارات', sports: 'رياضة', animals: 'حيوانات', other: 'أخرى',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: C, isDark } = useTheme();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data } = await supabase.rpc('get_public_profile', { p_user_id: id });
    const rows = data as PublicProfile[] | null;
    const p = rows?.[0] ?? null;
    setProfile(p);
    setLoading(false);

    if (p) {
      setListingsLoading(true);
      const { data: listData } = await supabase.rpc('get_user_active_listings', { p_user_id: id });
      setListings((listData as ListingCard[]) ?? []);
      setListingsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const C2 = C;

  // ── Listing card (2-col grid) ─────────────────────────────────────────────
  const renderListing = ({ item }: { item: ListingCard }) => {
    const isExchange = item.type === 'exchange';
    const typeColor = isExchange ? C.exchange : C.primary;

    return (
      <TouchableOpacity
        style={[styles.listingCard, {
          backgroundColor: C.card,
          borderColor: isDark ? C.cardBorder : '#E8EDF2',
        }]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.82}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.listingImg} />
        ) : (
          <View style={[styles.listingImgPlaceholder, {
            backgroundColor: isExchange
              ? (isDark ? 'rgba(10,132,255,0.10)' : '#EFF6FF')
              : (isDark ? 'rgba(0,200,83,0.10)' : '#ECFDF5'),
          }]}>
            {isExchange
              ? <ArrowLeftRight size={24} color={C.exchange} />
              : <Gift size={24} color={C.primary} />}
          </View>
        )}

        {item.is_urgent && (
          <View style={styles.urgentBadge}>
            <Flame size={8} color="#fff" />
            <Text style={styles.urgentText}>مستعجل</Text>
          </View>
        )}

        <View style={styles.listingBody}>
          <View style={[styles.typePill, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}>
            {isExchange
              ? <ArrowLeftRight size={8} color={typeColor} />
              : <Gift size={8} color={typeColor} />}
            <Text style={[styles.typePillText, { color: typeColor }]}>
              {item.dual_mode ? 'خذه + بدّل' : isExchange ? 'بدّل' : 'خذه'}
            </Text>
          </View>
          <Text style={[styles.listingTitle, { color: C.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.city ? (
            <View style={styles.listingMeta}>
              <MapPin size={10} color={C.textMuted} />
              <Text style={[styles.listingMetaText, { color: C.textMuted }]}>{item.city}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!loading && !profile) {
    return (
      <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={[styles.navBar, { borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <ChevronLeft size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <User size={48} color={C.textMuted} strokeWidth={1.5} />
          <Text style={[styles.notFoundTitle, { color: C.text }]}>الحساب غير موجود</Text>
          <Text style={[styles.notFoundDesc, { color: C.textSecondary }]}>
            قد يكون هذا الحساب محذوفاً أو موقوفاً
          </Text>
        </View>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <View style={[styles.navBar, { borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBack}>
            <ChevronLeft size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
      </View>
    );
  }

  const p = profile!;
  const displayName = p.display_name || p.full_name;

  // ── Header component for FlatList ─────────────────────────────────────────
  const ListHeader = () => (
    <>
      {/* Profile hero */}
      <View style={[styles.profileHero, {
        backgroundColor: isDark ? C.surface : '#F8FAFC',
        borderBottomColor: isDark ? C.border : '#E8EDF2',
      }]}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {p.avatar_url ? (
            <Image source={{ uri: p.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: C.primary + '20' }]}>
              <Text style={[styles.avatarInitial, { color: C.primary }]}>
                {(displayName?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          {p.is_verified && (
            <View style={[styles.verifiedRing, { backgroundColor: C.background }]}>
              <ShieldCheck size={14} color={C.primary} fill={C.primary + '20'} />
            </View>
          )}
        </View>

        {/* Name + badges */}
        <Text style={[styles.profileName, { color: C.text }]}>{displayName}</Text>
        {p.username && (
          <Text style={[styles.profileUsername, { color: C.textSecondary }]}>@{p.username}</Text>
        )}

        <View style={styles.badgeRow}>
          {p.role && p.role !== 'admin' && (
            <View style={[styles.badge, { backgroundColor: C.primary + '18', borderColor: C.primary + '40' }]}>
              <Text style={[styles.badgeText, { color: C.primary }]}>{ROLE_LABELS[p.role] ?? p.role}</Text>
            </View>
          )}
          {p.is_verified && (
            <View style={[styles.badge, { backgroundColor: C.primary + '18', borderColor: C.primary + '40' }]}>
              <ShieldCheck size={11} color={C.primary} />
              <Text style={[styles.badgeText, { color: C.primary }]}>موثوق</Text>
            </View>
          )}
          {p.phone_verified && (
            <View style={[styles.badge, { backgroundColor: 'rgba(8,145,178,0.12)', borderColor: 'rgba(8,145,178,0.30)' }]}>
              <Text style={[styles.badgeText, { color: '#0891b2' }]}>رقم موثق</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, { borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
          {p.rating_count > 0 && (
            <View style={styles.statItem}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={[styles.statValue, { color: C.text }]}>{p.rating_avg.toFixed(1)}</Text>
              <Text style={[styles.statLabel, { color: C.textSecondary }]}>{p.rating_count} تقييم</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Package size={16} color={C.primary} />
            <Text style={[styles.statValue, { color: C.text }]}>{p.active_listings_count}</Text>
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>إعلان</Text>
          </View>
          {p.city ? (
            <View style={styles.statItem}>
              <MapPin size={16} color={C.textSecondary} />
              <Text style={[styles.statValue, { color: C.text }]}>{p.city}</Text>
            </View>
          ) : null}
          <View style={styles.statItem}>
            <Calendar size={16} color={C.textSecondary} />
            <Text style={[styles.statLabel, { color: C.textSecondary }]}>{formatJoinDate(p.created_at)}</Text>
          </View>
        </View>

        {/* Phone (only if user chose to show it) */}
        {p.show_phone && p.phone ? (
          <View style={[styles.phoneRow, {
            backgroundColor: isDark ? C.card : '#F0FDF4',
            borderColor: C.primary + '30',
          }]}>
            <Phone size={14} color={C.primary} />
            <Text style={[styles.phoneText, { color: C.text }]}>{p.phone}</Text>
          </View>
        ) : null}
      </View>

      {/* Listings section title */}
      <View style={[styles.sectionHeader, { borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <Text style={[styles.sectionTitle, { color: C.text }]}>إعلاناته النشطة</Text>
        <Text style={[styles.sectionCount, { color: C.textSecondary }]}>{listings.length}</Text>
      </View>

      {listingsLoading && (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={[styles.navBar, {
        backgroundColor: C.background,
        borderBottomColor: isDark ? C.border : '#E8EDF2',
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navBack, {
          backgroundColor: isDark ? C.card : '#F4F7FA',
        }]}>
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>الملف الشخصي</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={listings}
        keyExtractor={item => item.id}
        renderItem={renderListing}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          !listingsLoading ? (
            <View style={styles.emptyListings}>
              <Package size={40} color={C.textMuted} strokeWidth={1.5} />
              <Text style={[styles.emptyTitle, { color: C.text }]}>لا توجد إعلانات نشطة</Text>
              <Text style={[styles.emptyDesc, { color: C.textSecondary }]}>
                لم يضف هذا المستخدم أي إعلانات حتى الآن
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  navBack: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },

  profileHero: {
    alignItems: 'center', paddingTop: 28, paddingBottom: 20,
    paddingHorizontal: 24, borderBottomWidth: 1, gap: 10,
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 34, fontWeight: '800' },
  verifiedRing: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },

  profileName: { fontSize: FontSizes.xxl, fontWeight: '800', textAlign: 'center' },
  profileUsername: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'center', marginTop: -4 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20,
    paddingTop: 16, marginTop: 6, borderTopWidth: 1, width: '100%',
  },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: FontSizes.lg, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500' },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1,
    marginTop: 4,
  },
  phoneText: { fontSize: FontSizes.md, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  sectionCount: { fontSize: FontSizes.sm, fontWeight: '600' },

  listContent: { paddingHorizontal: 12, paddingTop: 8 },
  columnWrapper: { gap: 10, marginBottom: 10 },

  listingCard: {
    flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden',
  },
  listingImg: { width: '100%', height: 110, resizeMode: 'cover' },
  listingImgPlaceholder: { width: '100%', height: 110, justifyContent: 'center', alignItems: 'center' },
  urgentBadge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  listingBody: { padding: 10, gap: 5 },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  typePillText: { fontSize: 9, fontWeight: '700' },
  listingTitle: { fontSize: FontSizes.sm, fontWeight: '700', lineHeight: 18, textAlign: 'right' },
  listingMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  listingMetaText: { fontSize: 10, fontWeight: '500' },

  emptyListings: {
    alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 10,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 22 },

  notFoundTitle: { fontSize: FontSizes.xl, fontWeight: '800', textAlign: 'center' },
  notFoundDesc: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 22 },
});
