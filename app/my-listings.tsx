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
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft,
  Trash2,
  Zap,
  Eye,
  ArrowLeftRight,
  Gift,
  Plus,
  LayoutList,
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
  const { colors, isDark } = useTheme();
  const C = colors;
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

  const renderItem = ({ item }: { item: Listing }) => {
    const isExchange = item.type === 'exchange';
    return (
      <View style={[
        styles.card,
        {
          backgroundColor: C.card,
          borderColor: item.is_boosted
            ? C.warning
            : (isDark ? C.cardBorder : '#E8EDF2'),
          borderWidth: item.is_boosted ? 2 : 1,
        },
      ]}>
        {item.is_boosted && (
          <View style={[styles.boostBadge, { backgroundColor: C.warning }]}>
            <Zap size={11} color="#fff" fill="#fff" />
            <Text style={styles.boostBadgeText}>مميز</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => router.push(`/post-detail?id=${item.id}`)} activeOpacity={0.8}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>
              {isExchange
                ? <ArrowLeftRight size={24} color={C.exchange} />
                : <Gift size={24} color={C.free} />
              }
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.typePill, {
              backgroundColor: isExchange
                ? (isDark ? C.exchangeBg : '#EFF6FF')
                : (isDark ? C.freeBg : '#ECFDF5'),
            }]}>
              <Text style={[styles.typePillText, { color: isExchange ? C.exchange : C.free }]}>
                {isExchange ? 'بدل' : 'خذه'}
              </Text>
            </View>
            <View style={styles.viewsRow}>
              <Eye size={12} color={C.textMuted} />
              <Text style={[styles.viewsText, { color: C.textMuted }]}>{item.views_count || 0}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? C.surface : '#F4F7FA', borderColor: isDark ? C.border : '#E8EDF2' }]}
              onPress={() => handleBoost(item)}
              activeOpacity={0.7}
            >
              <Zap size={16} color={item.is_boosted ? C.warning : C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? C.errorBg : '#FFF5F5', borderColor: isDark ? C.error : '#FECACA' }]}
              onPress={() => handleDelete(item.id)}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={C.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>إعلاناتي</Text>
        <View style={{ width: 38 }} />
      </View>

      {boostCount > 0 && (
        <View style={[styles.boostInfo, { backgroundColor: isDark ? C.warningBg : '#FFFBEB', borderBottomColor: isDark ? 'rgba(255,179,0,0.2)' : '#FDE68A' }]}>
          <Zap size={16} color={C.warning} />
          <Text style={[styles.boostInfoText, { color: C.warning }]}>لديك {boostCount} بوست مجاني متاح</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <LayoutList size={40} color={C.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: C.text }]}>لا توجد إعلانات بعد</Text>
          <TouchableOpacity
            style={[styles.addBtn, {
              backgroundColor: isDark ? 'transparent' : C.primary,
              borderColor: C.primary,
              borderWidth: isDark ? 1.5 : 0,
            }]}
            onPress={() => router.push('/add-post')}
            activeOpacity={0.8}
          >
            <Plus size={18} color={isDark ? C.primary : '#fff'} />
            <Text style={[styles.addBtnText, { color: isDark ? C.primary : '#fff' }]}>أضف إعلانك الأول</Text>
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

      <TouchableOpacity
        style={[styles.fab, {
          backgroundColor: isDark ? 'transparent' : C.primary,
          borderColor: isDark ? C.primary : 'transparent',
          borderWidth: isDark ? 1.5 : 0,
          shadowColor: C.primary,
        }]}
        onPress={() => router.push('/add-post')}
        activeOpacity={0.8}
      >
        <Plus size={26} color={isDark ? C.primary : '#fff'} />
      </TouchableOpacity>
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
  boostInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    justifyContent: 'flex-end',
  },
  boostInfoText: { fontSize: FontSizes.sm, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  addBtnText: { fontSize: FontSizes.md, fontWeight: '700' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  card: {
    flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden',
  },
  boostBadge: {
    position: 'absolute', top: 6, right: 6, zIndex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  boostBadgeText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '700' },
  cardImage: { width: '100%', height: 100, resizeMode: 'cover' },
  cardImagePlaceholder: {
    width: '100%', height: 100,
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: Spacing.sm, gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: { borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: FontSizes.xs, fontWeight: '700' },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: FontSizes.xs },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, paddingTop: 2 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  fab: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.lg,
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});
