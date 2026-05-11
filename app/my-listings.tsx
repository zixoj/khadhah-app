import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft,
  Trash2,
  Eye,
  ArrowLeftRight,
  Gift,
  Plus,
  LayoutList,
  AlertTriangle,
} from 'lucide-react-native';

interface Listing {
  id: string;
  title: string;
  type: string;
  category: string;
  city: string;
  image_url: string;
  views_count: number;
  status: string;
  created_at: string;
}

export default function MyListingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const C = colors;
  const insets = useSafeAreaInsets();
  const fabBottom = insets.bottom + 24;
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [profile?.id]);

  const fetchListings = async () => {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, type, category, city, image_url, views_count, status, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (data) setListings(data);
    } catch (e) {
      console.error('[my-listings] fetchListings:', e);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    console.log('DELETE CLICKED', id);
    setConfirmId(id);
    setDeleteError(null);
    setDeleteSuccess(false);
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    const idToDelete = confirmId;
    console.log('CONFIRMED DELETE', idToDelete);
    setDeletingId(idToDelete);
    setDeleteError(null);

    const { data: deleted, error } = await supabase
      .from('listings')
      .delete()
      .eq('id', idToDelete)
      .eq('user_id', profile?.id ?? '')
      .select('id');

    if (error) {
      console.error('[delete listing] error:', error);
      setDeleteError('تعذر حذف الإعلان');
      setDeletingId(null);
      return;
    }

    if (!deleted || deleted.length === 0) {
      console.warn('[delete listing] no rows deleted — RLS may be blocking or id mismatch');
      setDeleteError('تعذر حذف الإعلان');
      setDeletingId(null);
      return;
    }

    console.log('DELETE SUCCESS', idToDelete);
    if (profile?.id) {
      supabase.from('activity_log').insert({
        user_id: profile.id,
        action: 'listing_deleted',
        description: 'تم حذف إعلان',
      });
    }

    setListings((prev) => prev.filter((l) => l.id !== idToDelete));
    setDeletingId(null);
    setConfirmId(null);
    setDeleteSuccess(true);
    setTimeout(() => setDeleteSuccess(false), 3000);
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const isExchange = item.type === 'exchange';
    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: isDark ? 'rgba(0,200,83,0.10)' : '#E5E7EB', shadowColor: isDark ? C.primary : '#000' }]}>
        {/* Image — tappable to open detail */}
        <Pressable
          onPress={() => router.push(`/post-detail?id=${item.id}`)}
          style={styles.cardImageWrap}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} />
          ) : (
            <View style={[styles.cardImagePlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F7FA' }]}>
              {isExchange
                ? <ArrowLeftRight size={24} color={C.exchange} />
                : <Gift size={24} color={C.free} />
              }
            </View>
          )}
        </Pressable>

        {/* Body */}
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

          {/* Delete button — standalone Pressable, no nesting issues */}
          <Pressable
            onPress={() => {
              console.log('DELETE CLICKED', item.id);
              confirmDelete(item.id);
            }}
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: pressed
                  ? (isDark ? 'rgba(255,59,48,0.20)' : '#FFE5E5')
                  : (isDark ? 'rgba(255,59,48,0.10)' : '#FFF5F5'),
                borderColor: isDark ? 'rgba(255,59,48,0.30)' : '#FECACA',
              },
            ]}
          >
            <Trash2 size={15} color={C.error} />
            <Text style={[styles.deleteBtnText, { color: C.error }]}>حذف</Text>
          </Pressable>
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

      {deleteSuccess && (
        <View style={[styles.successBanner, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.25)' : '#86EFAC' }]}>
          <Text style={[styles.successBannerText, { color: isDark ? '#C8FFE0' : '#166534' }]}>تم حذف الإعلان بنجاح</Text>
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
              backgroundColor: C.primary,
              shadowColor: C.primary,
            }]}
            onPress={() => router.push('/add-post')}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#000" />
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

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: C.primary, shadowColor: C.primary, bottom: fabBottom }]}
        onPress={() => router.push('/add-post')}
        activeOpacity={0.8}
      >
        <Plus size={26} color="#fff" strokeWidth={3} />
      </TouchableOpacity>

      {/* Arabic confirmation modal */}
      <Modal
        visible={!!confirmId}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmSheet, { backgroundColor: isDark ? '#111714' : '#fff' }]}>
            <View style={[styles.confirmIconWrap, { backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5' }]}>
              <AlertTriangle size={28} color={C.error} />
            </View>
            <Text style={[styles.confirmTitle, { color: C.text }]}>حذف الإعلان</Text>
            <Text style={[styles.confirmBody, { color: C.textSecondary }]}>
              هل تريد حذف هذا الإعلان؟
            </Text>
            {deleteError && (
              <Text style={[styles.confirmError, { color: C.error }]}>{deleteError}</Text>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.border : '#E0E0E0' }]}
                onPress={() => { setConfirmId(null); setDeleteError(null); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmCancelText, { color: C.textSecondary }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { backgroundColor: C.error, borderColor: C.error }]}
                onPress={handleDelete}
                disabled={!!deletingId}
                activeOpacity={0.8}
              >
                {deletingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.confirmDeleteText, { color: '#fff' }]}>حذف</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  successBanner: {
    borderWidth: 1, borderRadius: BorderRadius.md, margin: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  successBannerText: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: 14, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
  addBtnText: { fontSize: FontSizes.md, fontWeight: '700', color: '#000' },
  listContent: { padding: Spacing.md, paddingBottom: 100 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },
  card: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  cardImageWrap: {
    borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 100, resizeMode: 'cover' },
  cardImagePlaceholder: { width: '100%', height: 100, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: Spacing.sm, gap: Spacing.xs },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: { borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: FontSizes.xs, fontWeight: '700' },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsText: { fontSize: FontSizes.xs },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2, alignSelf: 'flex-end',
  },
  deleteBtnText: { fontSize: FontSizes.xs, fontWeight: '700' },
  fab: {
    position: 'absolute',
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 100,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  confirmSheet: {
    width: '100%', borderRadius: 20, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.md,
  },
  confirmIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmTitle: { fontSize: FontSizes.xl, fontWeight: '800' },
  confirmBody: { fontSize: FontSizes.md, textAlign: 'center', lineHeight: 22 },
  confirmError: { fontSize: FontSizes.sm, textAlign: 'center', fontWeight: '600' },
  confirmActions: { flexDirection: 'row', gap: Spacing.md, width: '100%', marginTop: Spacing.sm },
  confirmCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', borderWidth: 1,
  },
  confirmCancelText: { fontSize: FontSizes.md, fontWeight: '600' },
  confirmDeleteBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', borderWidth: 1,
  },
  confirmDeleteText: { fontSize: FontSizes.md, fontWeight: '700' },
});
