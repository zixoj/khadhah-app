import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    const { data } = await supabase
      .from('ratings')
      .select('id, stars, comment, created_at, reviewer:reviewer_id(full_name, avatar_url)')
      .eq('reviewed_id', profile!.id)
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setRatings(data as any);
      const avg = data.reduce((sum, r: any) => sum + r.stars, 0) / data.length;
      setAvgRating(avg);
    }
    setLoading(false);
  };

  const renderStars = (count: number, size = 16) =>
    Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i} size={size}
        color={i < count ? Colors.accent[500] : Colors.neutral[300]}
        fill={i < count ? Colors.accent[500] : 'transparent'}
      />
    ));

  const renderItem = ({ item }: { item: Rating }) => (
    <View style={styles.ratingCard}>
      <View style={styles.reviewerRow}>
        {(item.reviewer as any)?.avatar_url ? (
          <Image source={{ uri: (item.reviewer as any).avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}><User size={18} color={Colors.primary[400]} /></View>
        )}
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{(item.reviewer as any)?.full_name || 'مستخدم'}</Text>
          <Text style={styles.ratingDate}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text>
        </View>
        <View style={styles.starsRow}>{renderStars(item.stars, 14)}</View>
      </View>
      {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>تقييماتي</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>
      ) : (
        <>
          {ratings.length > 0 && (
            <View style={styles.summaryCard}>
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
                <Star size={52} color={Colors.neutral[300]} />
                <Text style={styles.emptyText}>لا توجد تقييمات بعد</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  summaryCard: {
    backgroundColor: Colors.primary[700], padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
  },
  avgNum: { fontSize: 52, fontWeight: '700', color: Colors.white },
  starsRowBig: { flexDirection: 'row', gap: 4 },
  totalText: { fontSize: FontSizes.md, color: Colors.primary[200] },
  listContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  ratingCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
  },
  reviewerInfo: { flex: 1, alignItems: 'flex-end' },
  reviewerName: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text },
  ratingDate: { fontSize: FontSizes.xs, color: Colors.neutral[400] },
  starsRow: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },
});
