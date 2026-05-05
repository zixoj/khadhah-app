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
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('id, listing_id, listings(id, title, type, category, city, image_url)')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false });
    if (data) setFavorites(data as any);
    setLoading(false);
  };

  const removeFavorite = async (favId: string) => {
    await supabase.from('favorites').delete().eq('id', favId);
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
  };

  const renderItem = ({ item }: { item: FavoriteListing }) => {
    const listing = item.listings;
    if (!listing) return null;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/post-detail?id=${listing.id}`)}
        activeOpacity={0.7}
      >
        {listing.image_url ? (
          <Image source={{ uri: listing.image_url }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Heart size={24} color={Colors.neutral[300]} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
          <View style={styles.cardMeta}>
            {listing.category ? (
              <View style={styles.catPill}>
                <Text style={styles.catPillText}>{listing.category}</Text>
              </View>
            ) : null}
            {listing.city ? (
              <View style={styles.cityRow}>
                <MapPin size={11} color={Colors.neutral[400]} />
                <Text style={styles.cityText}>{listing.city}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => removeFavorite(item.id)} activeOpacity={0.7}>
          <Trash2 size={16} color={Colors.error[400]} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>المفضلة</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Heart size={52} color={Colors.neutral[300]} />
          <Text style={styles.emptyText}>لا توجد إعلانات محفوظة</Text>
          <Text style={styles.emptySubText}>اضغط على ❤️ في أي إعلان لحفظه هنا</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.lg, color: Colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: FontSizes.sm, color: Colors.neutral[400] },
  listContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardImage: { width: 100, height: 90, resizeMode: 'cover' },
  cardImagePlaceholder: {
    width: 100, height: 90, backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1, padding: Spacing.sm, justifyContent: 'center', gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  cardMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  catPill: { backgroundColor: Colors.primary[50], borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  catPillText: { fontSize: FontSizes.xs, color: Colors.primary[700], fontWeight: '600' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cityText: { fontSize: FontSizes.xs, color: Colors.neutral[400] },
  removeBtn: {
    width: 44, justifyContent: 'center', alignItems: 'center',
    borderLeftWidth: 1, borderLeftColor: Colors.border,
  },
});
