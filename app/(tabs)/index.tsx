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
import { ArrowLeftRight, Gift, Plus, Flame, Clock, MapPin, ChevronLeft } from 'lucide-react-native';

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
  const { colors, isDark } = useTheme();
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
    available: colors.primary,
    reserved: colors.exchange,
    reserved_temp: '#F59E0B',
    taken: colors.textMuted,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* Hero */}
      <View style={[styles.hero, {
        backgroundColor: isDark ? colors.surface : '#0F2318',
        borderBottomColor: isDark ? colors.cardBorder : 'transparent',
        borderBottomWidth: isDark ? 1 : 0,
      }]}>
        {/* Glow effect */}
        {isDark && (
          <View style={styles.heroGlow} pointerEvents="none" />
        )}

        <Text style={[styles.heroGreeting, { color: isDark ? 'rgba(0,255,135,0.65)' : 'rgba(255,255,255,0.65)' }]}>
          مرحباً {profile?.full_name ? profile.full_name.split(' ')[0] : 'صديقي'} 👋
        </Text>
        <Text style={styles.heroTitle}>لا ترميها…{'\n'}خذها أو بدّلها</Text>
        <Text style={[styles.heroSub, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.65)' }]}>
          اعرض أغراضك مجانًا أو بدّلها بسهولة
        </Text>

        {/* Entry buttons */}
        <View style={styles.entryRow}>
          <TouchableOpacity
            style={[styles.entryBtn, {
              backgroundColor: isDark ? 'rgba(0,255,135,0.08)' : '#059669',
              borderColor: isDark ? colors.primary : 'transparent',
              borderWidth: isDark ? 1 : 0,
            }]}
            onPress={() => router.push('/(tabs)/free')}
            activeOpacity={0.85}
          >
            <Gift size={28} color={isDark ? colors.primary : '#fff'} />
            <Text style={[styles.entryBtnLabel, { color: isDark ? colors.primary : '#fff' }]}>خذه</Text>
            <Text style={[styles.entryBtnSub, { color: isDark ? 'rgba(0,255,135,0.55)' : 'rgba(255,255,255,0.75)' }]}>مجاني</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.entryBtn, {
              backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#2563EB',
              borderColor: isDark ? '#3B82F6' : 'transparent',
              borderWidth: isDark ? 1 : 0,
            }]}
            onPress={() => router.push('/(tabs)/exchange')}
            activeOpacity={0.85}
          >
            <ArrowLeftRight size={28} color={isDark ? '#3B82F6' : '#fff'} />
            <Text style={[styles.entryBtnLabel, { color: isDark ? '#3B82F6' : '#fff' }]}>بدّل</Text>
            <Text style={[styles.entryBtnSub, { color: isDark ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.75)' }]}>تبادل</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post CTA */}
      <TouchableOpacity
        style={[styles.postCta, {
          backgroundColor: isDark ? 'rgba(0,255,135,0.08)' : colors.primary,
          borderColor: isDark ? colors.primary : 'transparent',
          borderWidth: isDark ? 1 : 0,
          shadowColor: colors.primary,
        }]}
        onPress={() => router.push('/add-post')}
        activeOpacity={0.85}
      >
        <Plus size={22} color={isDark ? colors.primary : '#fff'} />
        <Text style={[styles.postCtaText, { color: isDark ? colors.primary : '#fff' }]}>
          + أضف إعلان جديد
        </Text>
      </TouchableOpacity>

      {/* Recent listings */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/free')} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>آخر الإعلانات</Text>
          </View>

          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.recentCard, {
                  backgroundColor: colors.card,
                  borderColor: isDark ? colors.cardBorder : '#E8EDF2',
                  shadowColor: isDark ? colors.primary : '#000',
                }]}
                onPress={() => router.push(`/post-detail?id=${item.id}`)}
                activeOpacity={0.8}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.recentImg} />
                ) : (
                  <View style={[styles.recentImgPlaceholder, {
                    backgroundColor: item.type === 'free'
                      ? (isDark ? 'rgba(0,204,106,0.15)' : '#ECFDF5')
                      : (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF'),
                  }]}>
                    {item.type === 'free'
                      ? <Gift size={24} color={colors.free} />
                      : <ArrowLeftRight size={24} color={colors.exchange} />
                    }
                  </View>
                )}

                {/* Badges */}
                <View style={styles.cardBadgeRow}>
                  {item.is_urgent && (
                    <View style={styles.urgentBadge}>
                      <Flame size={9} color="#fff" />
                      <Text style={styles.urgentText}>مستعجل</Text>
                    </View>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor[item.status] ?? colors.textMuted}22` }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor[item.status] ?? colors.textMuted }]}>
                      {statusLabel[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.recentCardBody}>
                  <Text style={[styles.recentCardTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.recentCardMeta}>
                    {item.city ? (
                      <View style={styles.metaRow}>
                        <MapPin size={10} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.city}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Clock size={10} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,255,135,0.06)',
  },
  heroGreeting: {
    fontSize: FontSizes.sm,
    textAlign: 'right',
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 44,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontSize: FontSizes.md,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },

  entryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  entryBtn: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  entryBtnLabel: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
  },
  entryBtnSub: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },

  postCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  postCtaText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  recentSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
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
    gap: Spacing.md,
  },
  recentCard: {
    width: '47%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recentImg: { width: '100%', height: 110, resizeMode: 'cover' },
  recentImgPlaceholder: {
    width: '100%',
    height: 110,
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
    alignItems: 'flex-start',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
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
