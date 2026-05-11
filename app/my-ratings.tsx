import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Star, User } from 'lucide-react-native';

interface Rating {
  id: string;
  stars: number;
  comment: string;
  created_at: string;
  reviewer: { full_name: string; avatar_url: string };
}

export default function MyRatingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    fetchRatings();
  }, [profile?.id]);

  const fetchRatings = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('ratings')
        .select('id, stars, comment, created_at, reviewer:reviewer_id(full_name, avatar_url)')
        .eq('reviewed_id', profile.id)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setRatings(data as any);
        const avg = data.reduce((sum, r: any) => sum + r.stars, 0) / data.length;
        setAvgRating(avg);
      }
    } catch (e) {
      console.error('[my-ratings] fetchRatings:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (count: number, size = 16) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i} size={size}
        color={i < count ? '#F59E0B' : (isDark ? '#333' : '#E0E0E0')}
        fill={i < count ? '#F59E0B' : 'transparent'}
      />
    ));

  const renderItem = ({ item }: { item: Rating }) => (
    <View style={[styles.ratingCard, { backgroundColor: isDark ? '#161616' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF2' }]}>
      <View style={styles.reviewerRow}>
        {(item.reviewer as any)?.avatar_url ? (
          <Image source={{ uri: (item.reviewer as any).avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#222' : '#F4F7FA' }]}>
            <User size={18} color={C.primary} />
          </View>
        )}
        <View style={styles.reviewerInfo}>
          <Text style={[styles.reviewerName, { color: C.text }]}>{(item.reviewer as any)?.full_name || 'مستخدم'}</Text>
          <Text style={[styles.ratingDate, { color: C.textMuted }]}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text>
        </View>
        <View style={styles.starsRow}>{renderStars(item.stars, 14)}</View>
      </View>
      {item.comment ? <Text style={[styles.comment, { color: C.textSecondary }]}>{item.comment}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تقييماتي</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <>
          {ratings.length > 0 && (
            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#111714' : '#0F2318' }]}>
              <Text style={styles.avgNum}>{avgRating.toFixed(1)}</Text>
              <View style={styles.starsRowBig}>{renderStars(Math.round(avgRating), 22)}</View>
              <Text style={styles.totalText}>من {ratings.length} تقييم</Text>
            </View>
          )}
          <FlatList
            data={ratings}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
                  <Star size={40} color={C.textMuted} />
                </View>
                <Text style={[styles.emptyText, { color: C.textSecondary }]}>لا توجد تقييمات بعد</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  navIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingTop: 80 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSizes.md },
  summaryCard: {
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
  },
  avgNum: { fontSize: 52, fontWeight: '700', color: '#fff' },
  starsRowBig: { flexDirection: 'row', gap: 4 },
  totalText: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.65)' },
  listContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  ratingCard: {
    borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm,
  },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  reviewerInfo: { flex: 1, alignItems: 'flex-end' },
  reviewerName: { fontSize: FontSizes.md, fontWeight: '600' },
  ratingDate: { fontSize: FontSizes.xs },
  starsRow: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: FontSizes.sm, textAlign: 'right', lineHeight: 20 },
});
