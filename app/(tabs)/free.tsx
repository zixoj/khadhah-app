import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { Gift, Plus, MapPin, Flame, Clock, Users, Check } from 'lucide-react-native';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';

interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  city: string;
  phone: string;
  delivery_method: string;
  image_url: string;
  created_at: string;
  user_id: string;
  status: string;
  is_urgent: boolean;
  interest_count: number;
  reserved_by: string | null;
  reserved_until: string | null;
}

interface MyReservation {
  id: string;
  listing_id: string;
  status: string;
  expires_at: string;
}

const CATEGORIES = [
  { label: 'إلكترونيات', value: 'electronics' },
  { label: 'ملابس', value: 'clothing' },
  { label: 'أثاث', value: 'furniture' },
  { label: 'كتب', value: 'books' },
  { label: 'ألعاب', value: 'toys' },
  { label: 'أدوات منزلية', value: 'home_tools' },
  { label: 'سيارات', value: 'cars' },
  { label: 'رياضة', value: 'sports' },
  { label: 'حيوانات', value: 'animals' },
  { label: 'أخرى', value: 'other' },
];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function countdownText(expiresAt: string): string {
  const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  if (remaining === 0) return 'انتهى الحجز';
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  if (mins > 0) return `باقي ${mins} دقيقة`;
  return `باقي ${secs} ثانية`;
}

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    available: { label: 'متاح', bg: `${colors.primary}22`, text: colors.primary },
    reserved_temp: { label: 'محجوز مؤقتًا', bg: 'rgba(245,158,11,0.18)', text: '#F59E0B' },
    reserved: { label: 'محجوز', bg: `${colors.exchange}22`, text: colors.exchange },
    taken: { label: 'مأخوذ', bg: 'rgba(100,116,139,0.18)', text: colors.textSecondary },
  };
  const config = map[status] ?? { label: status, bg: 'rgba(100,116,139,0.18)', text: colors.textSecondary };
  return (
    <View style={[badgeStyles.base, { backgroundColor: config.bg }]}>
      <Text style={[badgeStyles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  text: { fontSize: 10, fontWeight: '700' },
});

export default function FreeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, 6) + 106;
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reserving, setReserving] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<MyReservation[]>([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingReserveId, setPendingReserveId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const fetchListings = useCallback(async () => {
    // Only call RPC when authenticated — anon has no execute grant
    if (profile) supabase.rpc('expire_stale_reservations');
    let query = supabase
      .from('listings')
      .select('*')
      .eq('type', 'free')
      .neq('status', 'taken')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });
    if (selectedCategory) query = query.eq('category', selectedCategory);
    const { data, error } = await query;
    if (error) console.error('[FreeScreen] fetchListings error:', error.message);
    if (data) setListings(data);
    setLoading(false);
    setRefreshing(false);
  }, [selectedCategory, profile]);

  useEffect(() => { setLoading(true); fetchListings(); }, [fetchListings]);

  const fetchMyReservations = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('reservations')
      .select('id, listing_id, status, expires_at')
      .eq('requester_id', profile.id)
      .in('status', ['pending', 'confirmed']);
    if (data) setMyReservations(data);
  }, [profile]);

  useEffect(() => { fetchMyReservations(); }, [fetchMyReservations]);

  const onRefresh = () => { setRefreshing(true); fetchListings(); fetchMyReservations(); };

  const getMyReservation = (listingId: string) =>
    myReservations.find((r) => r.listing_id === listingId);

  const handleReserve = async (listingId: string) => {
    if (!profile) return;
    if (!profile.phone_verified) {
      setPendingReserveId(listingId);
      setShowVerifyModal(true);
      return;
    }
    await doReserve(listingId);
  };

  const doReserve = async (listingId: string) => {
    setReserving(listingId);
    const { data, error } = await supabase.rpc('reserve_listing', { p_listing_id: listingId });
    if (error || !data?.success) {
      const reason = data?.reason ?? error?.message ?? 'unknown';
      if (reason === 'already_reserved_by_other') Alert.alert('المعذرة', 'هذا الإعلان محجوز حالياً من شخص آخر');
      else if (reason === 'not_available') Alert.alert('المعذرة', 'هذا الإعلان غير متاح للحجز');
      else Alert.alert('خطأ', 'تعذّر الحجز، حاول مرة أخرى');
      setReserving(null);
      return;
    }
    await Promise.all([fetchListings(), fetchMyReservations()]);
    setReserving(null);
  };

  const handleCancelReservation = async (reservationId: string) => {
    const { data } = await supabase.rpc('reject_reservation', { p_reservation_id: reservationId });
    if (data?.success) await Promise.all([fetchListings(), fetchMyReservations()]);
  };

  const openConfirmedChat = async (listingId: string) => {
    const { data } = await supabase.rpc('get_my_chat_room', { p_listing_id: listingId });
    if (data?.found && data.room_id) router.push(`/chat?room=${data.room_id}`);
    else router.push(`/post-detail?id=${listingId}`);
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const isMyListing = profile?.id === item.user_id;
    const isTaken = item.status === 'taken';
    const myRes = getMyReservation(item.id);
    const isMyReservation = !!myRes;
    const canReserve = !isMyListing && item.status === 'available' && !isMyReservation;

    return (
      <TouchableOpacity
        style={[styles.postCard, {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(0,200,83,0.12)' : '#E8EDF2',
          opacity: isTaken ? 0.5 : 1,
          shadowColor: isDark ? colors.primary : '#000',
        }]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          ) : (
            <View style={[styles.postImagePlaceholder, { backgroundColor: isDark ? 'rgba(0,204,106,0.1)' : '#ECFDF5' }]}>
              <Gift size={28} color={colors.free} />
            </View>
          )}
          {item.is_urgent && (
            <View style={styles.urgentBadge}>
              <Flame size={9} color="#fff" />
              <Text style={styles.urgentText}>مستعجل</Text>
            </View>
          )}
          <View style={styles.statusBadgePos}>
            <StatusBadge status={item.status} colors={colors} />
          </View>
        </View>

        <View style={styles.postBody}>
          <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>

          <View style={styles.metaRow}>
            {item.city ? (
              <View style={styles.metaItem}>
                <MapPin size={10} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.city}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Clock size={10} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>

          {item.interest_count > 0 && (
            <View style={styles.interestRow}>
              <Users size={11} color={colors.primary} />
              <Text style={[styles.interestText, { color: colors.primary }]}>
                {item.interest_count} مهتمين
              </Text>
            </View>
          )}

          {isMyReservation && myRes && (
            <View style={styles.countdownRow}>
              <Clock size={10} color="#F59E0B" />
              <Text style={[styles.countdownText]} key={tick}>
                {countdownText(myRes.expires_at)}
              </Text>
            </View>
          )}

          {!isMyListing && (
            <>
              {isMyReservation && myRes ? (
                <View style={styles.reservedActions}>
                  <View style={[styles.reservedInfo, {
                    backgroundColor: myRes.status === 'confirmed' ? colors.primary : '#F59E0B',
                  }]}>
                    <Check size={12} color="#fff" />
                    <Text style={styles.reservedInfoText}>
                      {myRes.status === 'confirmed' ? 'قُبل حجزك!' : 'بانتظار الموافقة'}
                    </Text>
                  </View>
                  {myRes.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.cancelBtn, { borderColor: colors.error, backgroundColor: colors.errorBg }]}
                      onPress={() => handleCancelReservation(myRes.id)}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.error }]}>إلغاء</Text>
                    </TouchableOpacity>
                  )}
                  {myRes.status === 'confirmed' && (
                    <TouchableOpacity
                      style={[styles.chatBtn, { backgroundColor: colors.exchange }]}
                      onPress={() => openConfirmedChat(item.id)}
                    >
                      <Text style={styles.chatBtnText}>فتح المحادثة</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : canReserve ? (
                <TouchableOpacity
                  style={[styles.reserveBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleReserve(item.id)}
                  disabled={reserving === item.id}
                  activeOpacity={0.8}
                >
                  {reserving === item.id
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={[styles.reserveBtnText, { color: '#000' }]}>احجزه لمدة ساعة</Text>
                  }
                </TouchableOpacity>
              ) : item.status !== 'available' && !isMyReservation ? (
                <View style={[styles.unavailableBtn, { backgroundColor: isDark ? 'rgba(100,116,139,0.1)' : '#F1F5F9' }]}>
                  <Text style={[styles.unavailableBtnText, { color: colors.textSecondary }]}>
                    {item.status === 'taken' ? 'تم أخذه' : 'محجوز'}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: isDark ? colors.cardBorder : '#E8EDF2', borderBottomWidth: 1 }]}>
        <View style={styles.headerContent}>
          <Gift size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>خذه</Text>
        </View>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>احجز لمدة ساعة قبل غيرك</Text>
      </View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, {
                backgroundColor: !selectedCategory ? colors.primary : (isDark ? '#1A2020' : '#F5F5F5'),
                borderColor: !selectedCategory ? colors.primary : (isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB'),
              }]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, { color: !selectedCategory ? '#000' : colors.textSecondary }]}>الكل</Text>
            </TouchableOpacity>
            {CATEGORIES.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.filterChip, {
                  backgroundColor: selectedCategory === value ? colors.primary : (isDark ? '#1A2020' : '#F5F5F5'),
                  borderColor: selectedCategory === value ? colors.primary : (isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB'),
                }]}
                onPress={() => setSelectedCategory(value)}
              >
                <Text style={[styles.filterChipText, { color: selectedCategory === value ? '#000' : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>جاري تحميل الإعلانات…</Text>
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Gift size={48} color={isDark ? 'rgba(255,255,255,0.1)' : '#E0E8EF'} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد إعلانات حالياً</Text>
            </View>
          )
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />

      {profile && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary, bottom: fabBottom }]}
          onPress={() => router.push('/add-post?type=free')}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#fff" strokeWidth={3} />
        </TouchableOpacity>
      )}

      <PhoneVerifyModal
        visible={showVerifyModal}
        currentPhone={profile?.phone || ''}
        onClose={() => { setShowVerifyModal(false); setPendingReserveId(null); }}
        onVerified={() => {
          setShowVerifyModal(false);
          if (pendingReserveId) {
            doReserve(pendingReserveId);
            setPendingReserveId(null);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 48,
    paddingBottom: Spacing.lg,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '800' },
  headerSub: { fontSize: FontSizes.sm, textAlign: 'right', marginTop: 4 },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  filterChipText: { fontSize: FontSizes.sm, fontWeight: '700' },

  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyText: { fontSize: FontSizes.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 160 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },

  postCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  imageWrapper: { position: 'relative' },
  postImage: { width: '100%', height: 118, resizeMode: 'cover' },
  postImagePlaceholder: {
    width: '100%',
    height: 118,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgentBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  statusBadgePos: { position: 'absolute', bottom: 6, left: 6 },

  postBody: { padding: 10, gap: 5 },
  postTitle: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right', lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10 },
  interestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  interestText: { fontSize: 10, fontWeight: '600' },

  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  countdownText: { fontSize: 10, color: '#F59E0B', fontWeight: '700' },

  reserveBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  reserveBtnText: { fontSize: FontSizes.sm, fontWeight: '700' },
  unavailableBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 2,
  },
  unavailableBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },

  reservedActions: { gap: 4, marginTop: 2 },
  reservedInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: BorderRadius.md, paddingVertical: 6, paddingHorizontal: 8,
  },
  reservedInfoText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 5, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 11, fontWeight: '700' },
  chatBtn: {
    borderRadius: BorderRadius.md, paddingVertical: 5, alignItems: 'center',
  },
  chatBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },

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
});
