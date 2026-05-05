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
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>
          مرحباً {profile?.full_name ? profile.full_name.split(' ')[0] : 'صديقي'} 👋
        </Text>
        <Text style={styles.heroTitle}>لا ترميها…{'\n'}خذها أو بدّلها</Text>
        <Text style={styles.heroSub}>اعرض أغراضك مجانًا أو بدّلها بسهولة</Text>

        {/* Entry buttons */}
        <View style={styles.entryRow}>
          <TouchableOpacity
            style={styles.entryBtnFree}
            onPress={() => router.push('/(tabs)/free')}
            activeOpacity={0.85}
          >
            <Gift size={26} color={Colors.white} />
            <Text style={styles.entryBtnLabel}>خذه</Text>
            <Text style={styles.entryBtnSub}>مجاني</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.entryBtnExchange}
            onPress={() => router.push('/(tabs)/exchange')}
            activeOpacity={0.85}
          >
            <ArrowLeftRight size={26} color={Colors.white} />
            <Text style={styles.entryBtnLabel}>بدّل</Text>
            <Text style={styles.entryBtnSub}>تبادل</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Post CTA */}
      <TouchableOpacity
        style={styles.postCta}
        onPress={() => router.push('/add-post')}
        activeOpacity={0.85}
      >
        <Plus size={20} color={Colors.white} />
        <Text style={styles.postCtaText}>انشر إعلانك الآن — أسرع من دقيقة</Text>
      </TouchableOpacity>

      {/* Recent listings */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>آخر الإعلانات</Text>
          <View style={styles.recentGrid}>
            {recent.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.recentCard}
                onPress={() => router.push(`/post-detail?id=${item.id}`)}
                activeOpacity={0.8}
              >
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.recentImg} />
                ) : (
                  <View style={[styles.recentImgPlaceholder, item.type === 'free' ? styles.placeholderFree : styles.placeholderExchange]}>
                    {item.type === 'free'
                      ? <Gift size={22} color={Colors.white} />
                      : <ArrowLeftRight size={22} color={Colors.white} />}
                  </View>
                )}
                {item.is_urgent && (
                  <View style={styles.urgentBadge}>
                    <Flame size={10} color={Colors.white} />
                    <Text style={styles.urgentBadgeText}>مستعجل</Text>
                  </View>
                )}
                {item.status === 'reserved' && (
                  <View style={styles.reservedBadge}>
                    <Text style={styles.reservedBadgeText}>محجوز</Text>
                  </View>
                )}
                <View style={styles.recentCardBody}>
                  <Text style={styles.recentCardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.recentCardMeta}>
                    {item.city ? (
                      <View style={styles.metaRow}>
                        <MapPin size={11} color={Colors.neutral[400]} />
                        <Text style={styles.metaText}>{item.city}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Clock size={11} color={Colors.neutral[400]} />
                      <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  hero: {
    backgroundColor: Colors.primary[700],
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
    paddingBottom: Spacing.xl,
  },
  heroGreeting: {
    fontSize: FontSizes.md,
    color: Colors.primary[200],
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'right',
    lineHeight: 44,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontSize: FontSizes.md,
    color: Colors.primary[200],
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },

  entryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  entryBtnFree: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: BorderRadius.lg,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  entryBtnExchange: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: BorderRadius.lg,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  entryBtnLabel: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
  },
  entryBtnSub: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },

  postCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[600],
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  postCtaText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.white,
  },

  recentSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  recentCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  recentImg: { width: '100%', height: 100, resizeMode: 'cover' },
  recentImgPlaceholder: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderFree: { backgroundColor: '#059669' },
  placeholderExchange: { backgroundColor: '#2563eb' },
  urgentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  urgentBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  reservedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.accent[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  reservedBadgeText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  recentCardBody: { padding: 10, gap: 4 },
  recentCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 18,
  },
  recentCardMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10, color: Colors.neutral[400] },
});
