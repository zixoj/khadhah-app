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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { Gift, Plus, MapPin, Flame, Clock, Users, Check, ShieldAlert } from 'lucide-react-native';
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
  { label: 'ملابس',       value: 'clothing' },
  { label: 'أثاث',        value: 'furniture' },
  { label: 'كتب',         value: 'books' },
  { label: 'ألعاب',       value: 'toys' },
  { label: 'أدوات منزلية', value: 'home_tools' },
  { label: 'سيارات',      value: 'cars' },
  { label: 'رياضة',       value: 'sports' },
  { label: 'حيوانات',     value: 'animals' },
  { label: 'أخرى',        value: 'other' },
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
  if (mins > 0) return `باقي على الحجز ${mins} دقيقة`;
  return `باقي على الحجز ${secs} ثانية`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    available:     { label: 'متاح',          color: '#059669' },
    reserved_temp: { label: 'محجوز مؤقتًا', color: Colors.accent[500] },
    reserved:      { label: 'محجوز',         color: '#2563eb' },
    taken:         { label: 'تم أخذه',       color: Colors.neutral[400] },
  };
  const config = map[status] ?? { label: status, color: Colors.neutral[400] };
  return (
    <View style={[badgeStyles.base, { backgroundColor: config.color }]}>
      <Text style={badgeStyles.text}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  base: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  text: { fontSize: 10, color: Colors.white, fontWeight: '700' },
});

export default function FreeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
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

  // Tick every 30s to refresh countdown displays
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const fetchListings = useCallback(async () => {
    // Expire stale reservations silently
    supabase.rpc('expire_stale_reservations');

    let query = supabase
      .from('listings')
      .select('*')
      .eq('type', 'free')
      .neq('status', 'taken')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });

    if (selectedCategory) query = query.eq('category', selectedCategory);

    const { data } = await query;
    if (data) setListings(data);
    setLoading(false);
    setRefreshing(false);
  }, [selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchListings();
  }, [fetchListings]);

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

    // Gate: phone must be verified
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
      if (reason === 'already_reserved_by_other') {
        Alert.alert('المعذرة', 'هذا الإعلان محجوز حالياً من شخص آخر');
      } else if (reason === 'not_available') {
        Alert.alert('المعذرة', 'هذا الإعلان غير متاح للحجز');
      } else {
        Alert.alert('خطأ', 'تعذّر الحجز، حاول مرة أخرى');
      }
      setReserving(null);
      return;
    }

    // Refresh both lists
    await Promise.all([fetchListings(), fetchMyReservations()]);
    setReserving(null);
  };

  const handleCancelReservation = async (reservationId: string) => {
    const { data } = await supabase.rpc('reject_reservation', { p_reservation_id: reservationId });
    if (data?.success) {
      await Promise.all([fetchListings(), fetchMyReservations()]);
    }
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const isMyListing = profile?.id === item.user_id;
    const isTaken = item.status === 'taken';
    const myRes = getMyReservation(item.id);
    const isMyReservation = !!myRes;
    const isReservedByMe = item.reserved_by === profile?.id;
    const canReserve = !isMyListing && item.status === 'available' && !isMyReservation;

    return (
      <TouchableOpacity
        style={[styles.postCard, isTaken && styles.postCardTaken]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          ) : (
            <View style={styles.postImagePlaceholder}>
              <Gift size={28} color="#059669" />
            </View>
          )}
          {item.is_urgent && (
            <View style={styles.urgentBadge}>
              <Flame size={10} color={Colors.white} />
              <Text style={styles.urgentText}>مستعجل</Text>
            </View>
          )}
          <View style={styles.statusBadgePos}>
            <StatusBadge status={item.status} />
          </View>
        </View>

        <View style={styles.postBody}>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>

          <View style={styles.metaRow}>
            {item.city ? (
              <View style={styles.metaItem}>
                <MapPin size={11} color={Colors.neutral[400]} />
                <Text style={styles.metaText}>{item.city}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Clock size={11} color={Colors.neutral[400]} />
              <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>

          {item.interest_count > 0 && (
            <View style={styles.interestRow}>
              <Users size={12} color={Colors.primary[600]} />
              <Text style={styles.interestText}>
                {item.interest_count} {item.interest_count === 1 ? 'شخص مهتم' : 'أشخاص مهتمين'}
              </Text>
            </View>
          )}

          {/* Countdown for my active reservation */}
          {isMyReservation && myRes && (
            <View style={styles.countdownRow}>
              <Clock size={11} color={Colors.accent[600]} />
              <Text style={styles.countdownText} key={tick}>
                {countdownText(myRes.expires_at)}
              </Text>
            </View>
          )}

          {/* CTA */}
          {!isMyListing && (
            <>
              {isMyReservation && myRes ? (
                <View style={styles.reservedActions}>
                  <View style={[styles.reservedInfo, myRes.status === 'confirmed' && styles.reservedInfoConfirmed]}>
                    <Check size={13} color={Colors.white} />
                    <Text style={styles.reservedInfoText}>
                      {myRes.status === 'confirmed' ? 'قُبل حجزك!' : 'بانتظار الموافقة'}
                    </Text>
                  </View>
                  {myRes.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancelReservation(myRes.id)}
                    >
                      <Text style={styles.cancelBtnText}>إلغاء</Text>
                    </TouchableOpacity>
                  )}
                  {myRes.status === 'confirmed' && (
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={() => router.push(`/post-detail?id=${item.id}`)}
                    >
                      <Text style={styles.chatBtnText}>فتح المحادثة</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : canReserve ? (
                <TouchableOpacity
                  style={styles.reserveBtn}
                  onPress={() => handleReserve(item.id)}
                  disabled={reserving === item.id}
                  activeOpacity={0.8}
                >
                  {reserving === item.id
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.reserveBtnText}>احجزه لمدة ساعة</Text>
                  }
                </TouchableOpacity>
              ) : item.status !== 'available' && !isMyReservation ? (
                <View style={styles.unavailableBtn}>
                  <Text style={styles.unavailableBtnText}>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Gift size={22} color={Colors.white} />
          <Text style={styles.headerTitle}>خذه</Text>
        </View>
        <Text style={styles.headerSub}>احجز لمدة ساعة قبل غيرك</Text>
      </View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>الكل</Text>
            </TouchableOpacity>
            {CATEGORIES.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.filterChip, selectedCategory === value && styles.filterChipActive]}
                onPress={() => setSelectedCategory(value)}
              >
                <Text style={[styles.filterChipText, selectedCategory === value && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#059669" />
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Gift size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyText}>لا توجد إعلانات عطاء حالياً</Text>
            </View>
          )
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
      />

      {profile && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-post?type=free')}
          activeOpacity={0.8}
        >
          <Plus size={28} color={Colors.white} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#059669',
    paddingHorizontal: Spacing.lg,
    paddingTop: 48,
    paddingBottom: Spacing.lg,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.75)', textAlign: 'right', marginTop: 4 },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontWeight: '700' },

  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },

  postCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  postCardTaken: { opacity: 0.55 },
  imageWrapper: { position: 'relative' },
  postImage: { width: '100%', height: 110, resizeMode: 'cover' },
  postImagePlaceholder: {
    width: '100%', height: 110, backgroundColor: '#d1fae5',
    justifyContent: 'center', alignItems: 'center',
  },
  urgentBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  statusBadgePos: { position: 'absolute', bottom: 6, left: 6 },

  postBody: { padding: Spacing.sm + 2, gap: 5 },
  postTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text, textAlign: 'right', lineHeight: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10, color: Colors.neutral[400] },
  interestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  interestText: { fontSize: 10, color: Colors.primary[600], fontWeight: '600' },

  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  countdownText: { fontSize: 10, color: Colors.accent[600], fontWeight: '700' },

  reserveBtn: {
    backgroundColor: '#059669', borderRadius: BorderRadius.md,
    paddingVertical: 8, alignItems: 'center', marginTop: 2,
  },
  reserveBtnText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700' },

  unavailableBtn: {
    backgroundColor: Colors.neutral[200], borderRadius: BorderRadius.md,
    paddingVertical: 8, alignItems: 'center', marginTop: 2,
  },
  unavailableBtnText: { fontSize: FontSizes.sm, color: Colors.neutral[500], fontWeight: '600' },

  reservedActions: { gap: 4, marginTop: 2 },
  reservedInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent[500], borderRadius: BorderRadius.md,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  reservedInfoConfirmed: { backgroundColor: Colors.primary[600] },
  reservedInfoText: { fontSize: 11, color: Colors.white, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[400],
    borderRadius: BorderRadius.md, paddingVertical: 5, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 11, color: Colors.error[600], fontWeight: '700' },
  chatBtn: {
    backgroundColor: '#2563eb', borderRadius: BorderRadius.md,
    paddingVertical: 5, alignItems: 'center',
  },
  chatBtnText: { fontSize: 11, color: Colors.white, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#059669',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});
