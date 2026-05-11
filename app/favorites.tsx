import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Heart, MapPin, Trash2 } from 'lucide-react-native';

interface FavoriteListing {
  id: string;
  listing_id: string;
  listings: {
    id: string;
    title: string;
    type: string;
    category: string;
    city: string;
    image_url: string;
  };
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const C = colors;
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, [profile?.id]);

  const fetchFavorites = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('favorites')
        .select('id, listing_id, listings(id, title, type, category, city, image_url)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (data) setFavorites(data as any);
    } catch (e) {
      console.error('[favorites] fetchFavorites:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favId: string) => {
    await supabase.from('favorites').delete().eq('id', favId);
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
  };

  const renderItem = ({ item }: { item: FavoriteListing }) => {
    const listing = item.listings;
    if (!listing) return null;
    const isExchange = listing.type === 'exchange';
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: C.card,
            borderColor: isDark ? C.cardBorder : '#E8EDF2',
          },
        ]}
        onPress={() => router.push(`/post-detail?id=${listing.id}`)}
        activeOpacity={0.75}
      >
        {listing.image_url ? (
          <Image source={{ uri: listing.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>
            <Heart size={24} color={C.textMuted} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={2}>{listing.title}</Text>
          <View style={styles.cardMeta}>
            {listing.category ? (
              <View style={[styles.catPill, {
                backgroundColor: isExchange
                  ? (isDark ? C.exchangeBg : '#EFF6FF')
                  : (isDark ? C.freeBg : '#ECFDF5'),
              }]}>
                <Text style={[styles.catPillText, {
                  color: isExchange ? C.exchange : C.free,
                }]}>{listing.category}</Text>
              </View>
            ) : null}
            {listing.city ? (
              <View style={styles.cityRow}>
                <MapPin size={11} color={C.textMuted} />
                <Text style={[styles.cityText, { color: C.textMuted }]}>{listing.city}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.removeBtn, { borderLeftColor: isDark ? C.cardBorder : '#E8EDF2' }]}
          onPress={() => removeFavorite(item.id)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={C.error} />
        </TouchableOpacity>
      </TouchableOpacity>
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
        <Text style={[styles.navTitle, { color: C.text }]}>المفضلة</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <Heart size={40} color={C.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: C.text }]}>لا توجد إعلانات محفوظة</Text>
          <Text style={[styles.emptySub, { color: C.textSecondary }]}>اضغط على القلب في أي إعلان لحفظه هنا</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  emptySub: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 22 },
  listContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  card: {
    flexDirection: 'row', borderRadius: BorderRadius.lg,
    borderWidth: 1, overflow: 'hidden',
  },
  cardImage: { width: 100, height: 90, resizeMode: 'cover' },
  cardImagePlaceholder: {
    width: 100, height: 90,
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1, padding: Spacing.sm, justifyContent: 'center', gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '600', textAlign: 'right' },
  cardMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  catPill: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  catPillText: { fontSize: FontSizes.xs, fontWeight: '600' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cityText: { fontSize: FontSizes.xs },
  removeBtn: {
    width: 44, justifyContent: 'center', alignItems: 'center',
    borderLeftWidth: 1,
  },
});
