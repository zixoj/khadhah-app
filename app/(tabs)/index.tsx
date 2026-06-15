import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes } from '@/lib/theme';
import { ArrowLeftRight, Gift, Plus, Flame, Clock, MapPin, Heart, Search } from 'lucide-react-native';
import VerseCard from '@/components/VerseCard';
import { useGuestGate } from '@/hooks/useGuestGate';

interface RecentListing {
  id: string;
  title: string;
  type: string;
  city: string;
  image_url: string;
  is_urgent: boolean;
  created_at: string;
  status: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string }> = {
  available: { label: 'متاح', bg: 'rgba(0,200,83,0.18)', dot: '#00C853' },
  reserved: { label: 'محجوز', bg: 'rgba(245,158,11,0.18)', dot: '#F59E0B' },
  reserved_temp: { label: 'محجوز', bg: 'rgba(245,158,11,0.18)', dot: '#F59E0B' },
  taken: { label: 'مأخوذ', bg: 'rgba(239,68,68,0.18)', dot: '#EF4444' },
};

export default function HomeScreen() {
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const { colors: C, isDark } = useTheme();
  const { guard, GuestGateModal } = useGuestGate();
  const [recent, setRecent] = useState<RecentListing[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  const loadRecent = useCallback(() => {
    setRecentLoading(true);
    supabase
      .from('listings')
      .select('id, title, type, city, image_url, is_urgent, created_at, status')
      .in('status', ['available', 'reserved', 'reserved_temp'])
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (error) console.error('[HomeScreen] loadRecent error:', error.message);
        if (data) setRecent(data);
        setRecentLoading(false);
      });
  }, []);

  useFocusEffect(loadRecent);

  const firstName = isGuest ? 'زائر' : (profile?.full_name ? profile.full_name.split(' ')[0] : 'صديقي');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      <GuestGateModal />
      {/* ── Hero ── */}
      <View style={[styles.hero, { backgroundColor: C.background }]}>
        {isDark && (
          <>
            <View style={[styles.glowTop, { backgroundColor: 'rgba(0,200,83,0.06)' }]} pointerEvents="none" />
            <View style={[styles.glowRight, { backgroundColor: 'rgba(0,200,83,0.04)' }]} pointerEvents="none" />
          </>
        )}

        <View style={styles.heroInner}>
          <Text style={[styles.greeting, { color: C.primary }]}>
            مرحباً {firstName} 👋
          </Text>
          <Text style={[styles.heroTitle, { color: C.text }]}>
            لا ترميها…{'\n'}خذها أو بدّلها
          </Text>
          <Text style={[styles.heroSub, { color: C.textSecondary }]}>
            اعرض أغراضك مجانًا أو بدّلها بما تحتاجه
          </Text>
        </View>

        {/* ── Quran verse card ── */}
        <View style={styles.verseCardWrap}>
          <VerseCard isDark={isDark} delay={200} />
        </View>

        {/* ── Search bar ── */}
        <TouchableOpacity
          style={[
            styles.searchBar,
            { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.border : '#E0E8EF' },
          ]}
          onPress={() => router.push(searchInput.trim() ? `/search?q=${encodeURIComponent(searchInput.trim())}` : '/search')}
          activeOpacity={0.85}
        >
          <Search size={16} color={C.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: C.textMuted }]}>
            ابحث عن إعلانات، مدن، فئات...
          </Text>
        </TouchableOpacity>

        {/* ── Two main cards ── */}
        <View style={styles.cardRow}>
          {/* بدّل card */}
          <TouchableOpacity
            style={[
              styles.mainCard,
              {
                backgroundColor: isDark ? '#0C1B2E' : '#EFF6FF',
                borderColor: isDark ? 'rgba(10,132,255,0.25)' : 'rgba(0,102,204,0.15)',
                shadowColor: isDark ? C.exchange : 'transparent',
              },
            ]}
            onPress={() => router.push('/(tabs)/exchange')}
            activeOpacity={0.82}
          >
            {isDark && <View style={[styles.cardGlow, { backgroundColor: 'rgba(10,132,255,0.08)' }]} />}
            <View style={[styles.cardIconWrap, { backgroundColor: isDark ? 'rgba(10,132,255,0.16)' : 'rgba(0,102,204,0.10)' }]}>
              <ArrowLeftRight size={26} color={C.exchange} strokeWidth={2.2} />
            </View>
            <Text style={[styles.cardLabel, { color: isDark ? '#CBE8FF' : '#003D99' }]}>بدّل</Text>
            <Text style={[styles.cardSub, { color: isDark ? 'rgba(74,159,255,0.75)' : '#0066CC' }]}>تبادل بلا مال</Text>
            <View style={[styles.cardArrowWrap, { backgroundColor: isDark ? 'rgba(10,132,255,0.16)' : 'rgba(0,102,204,0.10)' }]}>
              <Text style={[styles.cardArrowText, { color: C.exchange }]}>←</Text>
            </View>
          </TouchableOpacity>

          {/* خذه card */}
          <TouchableOpacity
            style={[
              styles.mainCard,
              {
                backgroundColor: isDark ? '#091A10' : '#ECFDF5',
                borderColor: isDark ? 'rgba(0,200,83,0.25)' : 'rgba(0,168,68,0.15)',
                shadowColor: isDark ? C.primary : 'transparent',
              },
            ]}
            onPress={() => router.push('/(tabs)/free')}
            activeOpacity={0.82}
          >
            {isDark && <View style={[styles.cardGlow, { backgroundColor: 'rgba(0,200,83,0.07)' }]} />}
            <View style={[styles.cardIconWrap, { backgroundColor: isDark ? 'rgba(0,200,83,0.16)' : 'rgba(0,168,68,0.10)' }]}>
              <Gift size={26} color={C.primary} strokeWidth={2.2} />
            </View>
            <Text style={[styles.cardLabel, { color: isDark ? '#C8FFE0' : '#003D1A' }]}>خذه</Text>
            <Text style={[styles.cardSub, { color: isDark ? 'rgba(0,200,83,0.7)' : '#00784C' }]}>مجاني تمامًا</Text>
            <View style={[styles.cardArrowWrap, { backgroundColor: isDark ? 'rgba(0,200,83,0.14)' : 'rgba(0,168,68,0.10)' }]}>
              <Text style={[styles.cardArrowText, { color: C.primary }]}>←</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CTA button ── */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            {
              backgroundColor: C.primary,
              shadowColor: C.primary,
            },
          ]}
          onPress={() => guard(() => router.push('/add-post'))}
          activeOpacity={0.85}
        >
          <Plus size={22} color="#000" strokeWidth={3} />
          <Text style={styles.ctaBtnText}>أضف إعلان</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent listings ── */}
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/free')} activeOpacity={0.7}>
            <Text style={[styles.seeAll, { color: C.primary }]}>عرض الكل</Text>
          </TouchableOpacity>
          <Text style={[styles.sectionTitle, { color: C.text }]}>آخر الإعلانات</Text>
        </View>

        {recentLoading ? (
          <View style={styles.recentCenter}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={[styles.recentEmptyText, { color: C.textSecondary }]}>جاري تحميل الإعلانات…</Text>
          </View>
        ) : recent.length === 0 ? (
          <View style={styles.recentCenter}>
            <Gift size={40} color={isDark ? 'rgba(255,255,255,0.10)' : '#D1D5DB'} />
            <Text style={[styles.recentEmptyText, { color: C.textSecondary }]}>لا توجد إعلانات حالياً</Text>
          </View>
        ) : (
          <View style={styles.recentGrid}>
            {recent.map((item) => {
              const sConf = STATUS_CONFIG[item.status] ?? { label: item.status, bg: 'rgba(100,116,139,0.18)', dot: '#9CA3AF' };
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.recentCard,
                    {
                      backgroundColor: C.card,
                      borderColor: isDark ? 'rgba(0,200,83,0.10)' : '#E8E8E8',
                      shadowColor: isDark ? C.primary : '#000',
                    },
                  ]}
                  onPress={() => router.push(`/post-detail?id=${item.id}`)}
                  activeOpacity={0.8}
                >
                  {/* Image */}
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.recentImg} />
                  ) : (
                    <View style={[
                      styles.recentImgPlaceholder,
                      {
                        backgroundColor: item.type === 'free'
                          ? (isDark ? 'rgba(0,200,83,0.08)' : '#ECFDF5')
                          : (isDark ? 'rgba(10,132,255,0.08)' : '#EFF6FF'),
                      },
                    ]}>
                      {item.type === 'free'
                        ? <Gift size={26} color={C.primary} />
                        : <ArrowLeftRight size={26} color={C.exchange} />
                      }
                    </View>
                  )}

                  {/* Overlaid badges */}
                  <View style={styles.badgeRow}>
                    {item.is_urgent && (
                      <View style={styles.urgentBadge}>
                        <Flame size={9} color="#fff" />
                        <Text style={styles.urgentText}>مستعجل</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: sConf.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: sConf.dot }]} />
                      <Text style={[styles.statusText, { color: sConf.dot }]}>{sConf.label}</Text>
                    </View>
                  </View>

                  {/* Heart */}
                  <View style={[styles.heartBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)' }]}>
                    <Heart size={13} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </View>

                  {/* Body */}
                  <View style={styles.recentCardBody}>
                    <Text style={[styles.recentCardTitle, { color: C.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.recentCardMeta}>
                      {item.city ? (
                        <View style={styles.metaRow}>
                          <MapPin size={10} color={C.textSecondary} />
                          <Text style={[styles.metaText, { color: C.textSecondary }]}>{item.city}</Text>
                        </View>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Clock size={10} color={C.textSecondary} />
                        <Text style={[styles.metaText, { color: C.textSecondary }]}>{timeAgo(item.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  glowTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  glowRight: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
  },

  heroInner: {
    paddingHorizontal: Spacing.lg,
    marginBottom: 20,
  },
  greeting: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 44,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: FontSizes.md,
    textAlign: 'right',
    lineHeight: 24,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 16, borderWidth: 1,
  },
  searchPlaceholder: { fontSize: FontSizes.md, flex: 1, textAlign: 'right' },

  verseCardWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  mainCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.md,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 152,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 6,
  },
  cardGlow: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  cardSub: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardArrowWrap: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardArrowText: { fontSize: 13, fontWeight: '800' },

  ctaWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: 18,
    paddingVertical: 17,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 10,
  },
  ctaBtnText: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },

  recentSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentCard: {
    width: '47.5%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  recentImg: { width: '100%', height: 112, resizeMode: 'cover' },
  recentImgPlaceholder: {
    width: '100%',
    height: 112,
    justifyContent: 'center',
    alignItems: 'center',
  },

  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700' },

  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  recentCardBody: { padding: 10, gap: 6 },
  recentCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 18,
  },
  recentCardMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10, fontWeight: '500' },

  recentCenter: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  recentEmptyText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
});
