import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft,
  Trash2,
  Edit3,
  Zap,
  Eye,
  ArrowLeftRight,
  Gift,
  Plus,
} from 'lucide-react-native';

interface Listing {
  id: string;
  title: string;
  type: string;
  category: string;
  city: string;
  image_url: string;
  views_count: number;
  is_boosted: boolean;
  status: string;
  created_at: string;
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostCount, setBoostCount] = useState(0);

  useEffect(() => {
    fetchListings();
    fetchBoostCount();
  }, []);

  const fetchListings = async () => {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false });
    if (data) setListings(data);
    setLoading(false);
  };

  const fetchBoostCount = async () => {
    const { data } = await supabase.from('profiles').select('boost_count').eq('id', profile!.id).maybeSingle();
    if (data) setBoostCount(data.boost_count || 0);
  };

  const handleDelete = (id: string) => {
    Alert.alert('حذف الإعلان', 'هل أنت متأكد من حذف هذا الإعلان؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive',
        onPress: async () => {
          await supabase.from('listings').delete().eq('id', id);
          await supabase.from('activity_log').insert({
            user_id: profile!.id,
            action: 'listing_deleted',
            description: 'تم حذف إعلان',
          });
          setListings((prev) => prev.filter((l) => l.id !== id));
        },
      },
    ]);
  };

  const handleBoost = async (listing: Listing) => {
    if (listing.is_boosted) {
      Alert.alert('مميز', 'هذا الإعلان مميز بالفعل');
      return;
    }
    if (boostCount <= 0) {
      Alert.alert('لا يوجد رصيد', 'ليس لديك بوست مجاني متاح. يمكنك شراء بوست من المحفظة.');
      return;
    }
    Alert.alert('تمييز الإعلان', 'هل تريد استخدام بوست مجاني لتمييز هذا الإعلان؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تمييز',
        onPress: async () => {
          // Free boost: owner updates their own listing + profile (both allowed by owner RLS policies)
          const boostedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const [listingRes, profileRes] = await Promise.all([
            supabase.from('listings').update({ is_boosted: true, boosted_until: boostedUntil }).eq('id', listing.id).eq('user_id', profile!.id),
            supabase.from('profiles').update({ boost_count: boostCount - 1 }).eq('id', profile!.id),
          ]);
          if (listingRes.error || profileRes.error) {
            Alert.alert('خطأ', 'فشل تمييز الإعلان');
            return;
          }
          await supabase.from('activity_log').insert({
            user_id: profile!.id,
            action: 'listing_boosted',
            description: `تم تمييز إعلان: ${listing.title}`,
          });
          setBoostCount((prev) => prev - 1);
          setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, is_boosted: true } : l));
          Alert.alert('تم', 'تم تمييز إعلانك لمدة 7 أيام');
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Listing }) => (
    <View style={[styles.card, item.is_boosted && styles.cardBoosted]}>
      {item.is_boosted && (
        <View style={styles.boostBadge}>
          <Zap size={11} color={Colors.white} fill={Colors.white} />
          <Text style={styles.boostBadgeText}>مميز</Text>
        </View>
      )}
      <TouchableOpacity onPress={() => router.push(`/post-detail?id=${item.id}`)} activeOpacity={0.8} style={styles.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            {item.type === 'exchange'
              ? <ArrowLeftRight size={24} color={Colors.primary[300]} />
              : <Gift size={24} color={Colors.free} />
            }
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.typePill, item.type === 'exchange' ? styles.typePillEx : styles.typePillFree]}>
            <Text style={styles.typePillText}>{item.type === 'exchange' ? 'بدل' : 'خذه'}</Text>
          </View>
          <View style={styles.viewsRow}>
            <Eye size={12} color={Colors.neutral[400]} />
            <Text style={styles.viewsText}>{item.views_count || 0}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleBoost(item)} activeOpacity={0.7}>
            <Zap size={16} color={item.is_boosted ? Colors.accent[500] : Colors.neutral[400]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)} activeOpacity={0.7}>
            <Trash2 size={16} color={Colors.error[500]} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>إعلاناتي</Text>
        <View style={{ width: 24 }} />
      </View>

      {boostCount > 0 && (
        <View style={styles.boostInfo}>
          <Zap size={16} color={Colors.accent[600]} />
          <Text style={styles.boostInfoText}>لديك {boostCount} بوست مجاني متاح</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <List size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyText}>لا توجد إعلانات بعد</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add-post')} activeOpacity={0.8}>
            <Plus size={18} color={Colors.white} />
            <Text style={styles.addBtnText}>أضف إعلانك الأول</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-post')} activeOpacity={0.8}>
        <Plus size={26} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function List({ size, color }: { size: number; color: string }) {
  return <Text style={{ fontSize: size, color }}>📋</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  boostInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent[50], borderBottomWidth: 1, borderBottomColor: Colors.accent[100],
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    justifyContent: 'flex-end',
  },
  boostInfoText: { fontSize: FontSizes.sm, color: Colors.accent[600], fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  addBtnText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '700' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  card: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardBoosted: { borderColor: Colors.accent[400], borderWidth: 2 },
  boostBadge: {
    position: 'absolute', top: 6, right: 6, zIndex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.accent[500], borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  boostBadgeText: { fontSize: FontSizes.xs, color: Colors.white, fontWeight: '700' },
  cardImageWrap: {},
  cardImage: { width: '100%', height: 100, resizeMode: 'cover' },
  cardImagePlaceholder: {
    width: '100%', height: 100, backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: Spacing.sm, gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, textAlign: 'right', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: { borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 2 },
  typePillEx: { backgroundColor: Colors.primary[100] },
  typePillFree: { backgroundColor: '#d1fae5' },
  typePillText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary[700] },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: FontSizes.xs, color: Colors.neutral[400] },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, paddingTop: 2 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.neutral[50],
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  fab: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.lg,
    width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});
