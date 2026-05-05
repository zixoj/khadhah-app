import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ArrowLeftRight, Gift, Plus, Flame, Clock, MapPin } from 'lucide-react-native';

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

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [recent, setRecent] = useState<RecentListing[]>([]);

  useEffect(() => {
    supabase
      .from('listings')
      .select('id, title, type, city, image_url, is_urgent, created_at, status')
      .in('status', ['available', 'reserved'])
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setRecent(data); });
  }, []);

  const statusLabel: Record<string, string> = {
    available: 'متاح',
    reserved: 'محجوز',
    reserved_temp: 'محجوز مؤقتًا',
    taken: 'مأخوذ',
  };
  const statusColor: Record<string, string> = {
    available: C.primary,
    reserved: C.exchange,
    reserved_temp: C.warning,
    taken: C.textMuted,
  };

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'صديقي';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: C.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* ── Hero ── */}
      <View style={[styles.hero, { backgroundColor: C.background }]}>
        {isDark && <View style={styles.glowBlob} pointerEvents="none" />}

        <View style={styles.heroInner}>
          <Text style={[styles.greeting, { color: C.primary }]}>
            مرحباً {firstName}
          </Text>
          <Text style={[styles.heroTitle, { color: C.text }]}>
            لا ترميها…{'\n'}خذها أو بدّلها
          </Text>
          <Text style={[styles.heroSub, { color: C.textSecondary }]}>
            اعرض أغراضك مجانًا أو بدّلها بسهولة
          </Text>
        </View>

        {/* ── Two main cards ── */}
        <View style={styles.cardRow}>
          {/* بدّل card */}
          <TouchableOpacity
            style={[
              styles.mainCard,
              {
                backgroundColor: isDark ? '#0D1A2E' : '#EFF6FF',
                borderColor: isDark ? 'rgba(10,132,255,0.22)' : 'rgba(0,102,204,0.15)',
              },
            ]}
            onPress={() => router.push('/(tabs)/exchange')}
            activeOpacity={0.82}
          >
            {isDark && <View style={[styles.cardGlowBlob, { backgroundColor: 'rgba(10,132,255,0.07)' }]} />}
            <View style={[styles.cardIconWrap, { backgroundColor: isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,102,204,0.10)' }]}>
              <ArrowLeftRight size={24} color={C.exchange} />
            </View>
            <Text style={[styles.cardLabel, { color: isDark ? '#CBE8FF' : '#003D99' }]}>بدّل</Text>
            <Text style={[styles.cardSub, { color: isDark ? 'rgba(10,132,255,0.6)' : '#0066CC' }]}>تبادل الأغراض</Text>
            <View style={[styles.cardArrow, { backgroundColor: isDark ? 'rgba(10,132,255,0.14)' : 'rgba(0,102,204,0.10)' }]}>
              <Text style={{ color: C.exchange, fontSize: 12, fontWeight: '700' }}>←</Text>
            </View>
          </TouchableOpacity>

          {/* خذه card */}
          <TouchableOpacity
            style={[
              styles.mainCard,
              {
                backgroundColor: isDark ? '#0A1F12' : '#ECFDF5',
                borderColor: isDark ? 'rgba(0,200,83,0.20)' : 'rgba(0,168,68,0.15)',
              },
            ]}
            onPress={() => router.push('/(tabs)/free')}
            activeOpacity={0.82}
          >
            {isDark && <View style={[styles.cardGlowBlob, { backgroundColor: 'rgba(0,200,83,0.06)' }]} />}
            <View style={[styles.cardIconWrap, { backgroundColor: isDark ? 'rgba(0,200,83,0.14)' : 'rgba(0,168,68,0.10)' }]}>
              <Gift size={24} color={C.primary} />
            </View>
            <Text style={[styles.cardLabel, { color: isDark ? '#C8FFE0' : '#003D1A' }]}>خذه</Text>
            <Text style={[styles.cardSub, { color: isDark ? 'rgba(0,200,83,0.6)' : C.primaryDim }]}>مجاني تمامًا</Text>
            <View style={[styles.cardArrow, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : 'rgba(0,168,68,0.10)' }]}>
              <Text style={{ color: C.primary, fontSize: 12, fontWeight: '700' }}>←</Text>
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
              shadowColor: isDark ? C.primary : 'transparent',
            },
          ]}
          onPress={() => router.push('/add-post')}
          activeOpacity={0.85}
        >
          <Plus size={20} color="#000" strokeWidth={2.8} />
          <Text style={styles.ctaBtnText}>أضف إعلان</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent listings ── */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/free')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: C.primary }]}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { color: C.text }]}>آخر الإعلانات</Text>
          </View>

          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.recentCard,
                  {
                    backgroundColor: C.card,
                    borderColor: isDark ? C.cardBorder : '#E8E8E8',
                    shadowColor: isDark ? C.primary : '#000',
                  },
                ]}
                onPress={() => router.push(`/post-detail?id=${item.id}`)}
                activeOpacity={0.8}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.recentImg} />
                ) : (
                  <View style={[
                    styles.recentImgPlaceholder,
                    {
                      backgroundColor: item.type === 'free'
                        ? (isDark ? 'rgba(0,200,83,0.07)' : '#ECFDF5')
                        : (isDark ? 'rgba(10,132,255,0.07)' : '#EFF6FF'),
                    },
                  ]}>
                    {item.type === 'free'
                      ? <Gift size={22} color={C.free} />
                      : <ArrowLeftRight size={22} color={C.exchange} />
                    }
                  </View>
                )}

                <View style={styles.cardBadgeRow}>
                  {item.is_urgent && (
                    <View style={styles.urgentBadge}>
                      <Flame size={9} color="#fff" />
                      <Text style={styles.urgentText}>مستعجل</Text>
                    </View>
                  )}
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor[item.status] ?? C.textMuted}18` },
                  ]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor[item.status] ?? C.textMuted }]} />
                    <Text style={[styles.statusBadgeText, { color: statusColor[item.status] ?? C.textMuted }]}>
                      {statusLabel[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

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
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  glowBlob: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,200,83,0.05)',
  },
  heroInner: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 42,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: FontSizes.md,
    textAlign: 'right',
    lineHeight: 22,
  },

  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  mainCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 148,
  },
  cardGlowBlob: {
    position: 'absolute',
    bottom: -24,
    right: -24,
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
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
  cardArrow: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  ctaWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: 16,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 8,
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
    textAlign: 'right',
  },
  seeAll: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 4,
  },
  recentCard: {
    width: '47.5%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  recentImg: { width: '100%', height: 108, resizeMode: 'cover' },
  recentImgPlaceholder: {
    width: '100%',
    height: 108,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeRow: {
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
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },

  recentCardBody: { padding: 10, gap: 5 },
  recentCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
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
  metaText: { fontSize: 10 },
});
