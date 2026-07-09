import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Share,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft,
  MapPin,
  Phone,
  Truck,
  MessageCircle,
  ArrowLeftRight,
  Gift,
  Check,
  User,
  Tag,
  Heart,
  Eye,
  Flame,
  Users,
  Star,
  ShieldCheck,
  Flag,
  X,
  Clock,
  MessageSquare,
  Zap,
  Share2,
  ImageOff,
  AlertCircle,
  RefreshCw,
  PackageOpen,
} from 'lucide-react-native';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';
import { useGuestGate } from '@/hooks/useGuestGate';

const GALLERY_HEIGHT = 300;

interface Listing {
  id: string; user_id: string; title: string; description: string; category: string;
  type: string; city: string; phone: string; delivery_method: string; image_url: string;
  created_at: string; status: string; is_urgent: boolean; interest_count: number;
  views_count: number; reserved_by: string | null; reserved_until: string | null;
  dual_mode: boolean; is_featured: boolean; premium_badge: boolean;
}

interface OwnerProfile {
  full_name: string; avatar_url: string | null; rating: number;
  is_verified: boolean; phone_verified: boolean; allow_whatsapp: boolean; listings_count: number;
}

interface BarterOffer {
  id: string; offerer_id: string; offer_description: string; offer_image_url: string;
  status: string; created_at: string;
}

interface Reservation {
  id: string; requester_id: string; status: string; expires_at: string; created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  electronics: 'إلكترونيات', clothing: 'ملابس', furniture: 'أثاث',
  books: 'كتب', toys: 'ألعاب', home_tools: 'أدوات منزلية',
  cars: 'سيارات', sports: 'رياضة', animals: 'حيوانات', other: 'أخرى',
};

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
  if (mins > 0) return `باقي على الحجز ${mins} دقيقة`;
  return `باقي على الحجز ${remaining % 60} ثانية`;
}

function parseImages(imageUrl: string): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  if (imageUrl.startsWith('[')) return [];
  const parts = imageUrl.split(',').map((s) => s.trim()).filter((s) => s.startsWith('http'));
  return parts.length > 1 ? parts : [imageUrl];
}

// ─── Skeleton block ───────────────────────────────────────────────────────────
const SkeletonBlock = memo(function SkeletonBlock({
  height, width, radius = 8, color,
}: { height: number; width?: number; radius?: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{ height, width, borderRadius: radius, backgroundColor: color, opacity }}
    />
  );
});

// ─── Image gallery ────────────────────────────────────────────────────────────
const Gallery = memo(function Gallery({
  images, isExchange, isUrgent, isPremium, onTap, primaryColor, exchangeColor,
}: {
  images: string[]; isExchange: boolean; isUrgent: boolean; isPremium: boolean;
  onTap: (uri: string, index: number) => void; primaryColor: string; exchangeColor: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View
        style={[
          styles.galleryPlaceholder,
          {
            backgroundColor: isExchange ? 'rgba(10,132,255,0.08)' : 'rgba(0,168,68,0.08)',
            height: GALLERY_HEIGHT,
          },
        ]}
        accessibilityLabel="لا توجد صورة"
      >
        <ImageOff size={48} color={isExchange ? exchangeColor : primaryColor} strokeWidth={1.5} />
        <Text style={{ color: isExchange ? exchangeColor : primaryColor, marginTop: 10, fontSize: FontSizes.sm, opacity: 0.7 }}>
          لا توجد صورة
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: GALLERY_HEIGHT, overflow: 'hidden' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setIndex(Math.max(0, Math.min(idx, images.length - 1)));
        }}
        style={{ width: screenWidth, height: GALLERY_HEIGHT }}
      >
        {images.map((uri, i) => (
          <TouchableOpacity
            key={`img-${i}`}
            activeOpacity={0.92}
            onPress={() => onTap(uri, i)}
            accessibilityLabel={`صورة ${i + 1} من ${images.length}`}
            accessibilityRole="imagebutton"
          >
            <Image
              source={{ uri }}
              style={{ width: screenWidth, height: GALLERY_HEIGHT }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Counter */}
      {images.length > 1 && (
        <View style={styles.galleryCounter}>
          <Text style={styles.galleryCounterText}>{index + 1} / {images.length}</Text>
        </View>
      )}

      {/* Dot indicators */}
      {images.length > 1 && images.length <= 8 && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.45)', width: i === index ? 18 : 6 },
              ]}
            />
          ))}
        </View>
      )}

      {/* Overlay badges */}
      <View style={styles.galleryOverlayRow} pointerEvents="none">
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <Flame size={11} color="#fff" />
            <Text style={styles.urgentText}>مستعجل</Text>
          </View>
        )}
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Zap size={10} color="#fff" />
            <Text style={styles.premiumText}>مميز</Text>
          </View>
        )}
      </View>
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { guard, GuestGateModal } = useGuestGate();
  const insets = useSafeAreaInsets();

  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [myReservation, setMyReservation] = useState<Reservation | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [myChatRoomId, setMyChatRoomId] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  const C = colors;

  const fetchListing = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error: fetchErr } = await supabase
      .from('listings').select('*').eq('id', id).maybeSingle();

    if (fetchErr) { setLoadError(true); setLoading(false); return; }
    if (!data) { setLoading(false); return; }

    setListing(data);
    supabase.rpc('increment_listing_views', { p_listing_id: id });

    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, rating_avg, is_verified, phone_verified, allow_whatsapp')
      .eq('id', data.user_id).maybeSingle();

    if (ownerData) {
      const { count } = await supabase
        .from('listings').select('*', { count: 'exact', head: true }).eq('user_id', data.user_id);
      setOwner({ ...ownerData, rating: ownerData.rating_avg ?? 0, listings_count: count ?? 0 });
    }

    if (profile) {
      const { data: fav } = await supabase
        .from('favorites').select('id').eq('user_id', profile.id).eq('listing_id', id).maybeSingle();
      if (fav) { setIsFavorited(true); setFavoriteId(fav.id); }

      const { data: myRes } = await supabase
        .from('reservations').select('*')
        .eq('listing_id', id).eq('requester_id', profile.id).in('status', ['pending', 'confirmed']).maybeSingle();
      if (myRes) setMyReservation(myRes);

      const { data: room } = await supabase
        .from('chat_rooms').select('id')
        .eq('listing_id', id).or(`owner_id.eq.${profile.id},other_user_id.eq.${profile.id}`).maybeSingle();
      if (room) setMyChatRoomId(room.id);

      const { data: report } = await supabase
        .from('listing_reports').select('id')
        .eq('reporter_id', profile.id).eq('listing_id', id).maybeSingle();
      if (report) setHasReported(true);

      if (profile.id === data.user_id) {
        const { data: resData } = await supabase
          .from('reservations').select('*')
          .eq('listing_id', id).in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: true });
        if (resData) setReservations(resData);
        if (data.type === 'exchange' || data.dual_mode) {
          const { data: offersData } = await supabase
            .from('barter_offers').select('*')
            .eq('listing_id', id).order('created_at', { ascending: false });
          if (offersData) setOffers(offersData);
        }
      }
    }
    setLoading(false);
  }, [id, profile?.id, retryCount]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  // ─── Derived values (memoized) ──────────────────────────────────────────────
  const images = useMemo(() => parseImages(listing?.image_url ?? ''), [listing?.image_url]);

  const isOwner = useMemo(() => profile?.id === listing?.user_id, [profile?.id, listing?.user_id]);
  const isExchange = listing?.type === 'exchange';
  const isTaken = listing?.status === 'taken';
  const isTempReserved = listing?.status === 'reserved_temp';
  const isConfirmedReserved = listing?.status === 'reserved';
  const canWhatsApp = useMemo(
    () => owner?.allow_whatsapp !== false && !!listing?.phone,
    [owner?.allow_whatsapp, listing?.phone]
  );

  const statusCfg = useMemo(() => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      available: { label: 'متاح', bg: `${C.primary}22`, color: C.primary },
      reserved_temp: { label: 'محجوز مؤقتًا', bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' },
      reserved: { label: 'محجوز', bg: `${C.exchange}22`, color: C.exchange },
      taken: { label: 'مأخوذ', bg: 'rgba(100,116,139,0.18)', color: C.textSecondary },
    };
    return map[listing?.status ?? ''] ?? map.taken;
  }, [listing?.status, C]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async () => {
    if (!profile) { guard(() => {}); return; }
    if (isFavorited && favoriteId) {
      await supabase.from('favorites').delete().eq('id', favoriteId);
      setIsFavorited(false); setFavoriteId(null);
    } else {
      const { data } = await supabase
        .from('favorites').insert({ user_id: profile.id, listing_id: id }).select('id').maybeSingle();
      if (data) { setIsFavorited(true); setFavoriteId(data.id); }
    }
  }, [profile, isFavorited, favoriteId, id, guard]);

  const openWhatsApp = useCallback(() => {
    if (!listing?.phone) return;
    const raw = listing.phone.replace(/[\s\-()]/g, '');
    const normalized = raw.startsWith('0') ? '966' + raw.slice(1) : raw;
    Linking.openURL(`https://wa.me/${normalized}`).catch(() =>
      Alert.alert('تعذر الفتح', 'تأكد من تثبيت تطبيق واتساب')
    );
  }, [listing?.phone]);

  const handleShare = useCallback(async () => {
    if (!listing) return;
    try {
      await Share.share({
        message: `${listing.title}${listing.city ? ' — ' + listing.city : ''}\n${listing.description ?? ''}`.trim(),
        title: listing.title,
      });
    } catch {}
  }, [listing]);

  const requestDelivery = useCallback(async () => {
    if (!profile || !listing || !pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال عناوين الاستلام والتسليم'); return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('delivery_requests').insert({
      post_id: listing.id, requester_id: profile.id,
      pickup_address: pickupAddress.trim(), dropoff_address: dropoffAddress.trim(), status: 'pending',
    });
    setSubmitting(false);
    if (error) Alert.alert('خطأ', error.message);
    else { Alert.alert('تم', 'تم إرسال طلب التوصيل بنجاح'); setShowDeliveryForm(false); }
  }, [profile, listing, pickupAddress, dropoffAddress]);

  const handleApproveReservation = useCallback(async (reservationId: string) => {
    const { data } = await supabase.rpc('approve_reservation', { p_reservation_id: reservationId });
    if (data?.success) {
      if (data.chat_room_id) setMyChatRoomId(data.chat_room_id);
      fetchListing();
    } else {
      Alert.alert('خطأ', data?.reason === 'expired' ? 'انتهت مدة الحجز' : 'تعذّر القبول');
    }
  }, [fetchListing]);

  const handleRejectReservation = useCallback(async (reservationId: string) => {
    const { data } = await supabase.rpc('reject_reservation', { p_reservation_id: reservationId });
    if (data?.success) fetchListing();
  }, [fetchListing]);

  const handleConfirmTaken = useCallback(async () => {
    if (!listing) return;
    Alert.alert('تأكيد', 'هل تأكد أن الغرض تم أخذه؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، تم أخذه', onPress: async () => {
        const { data } = await supabase.rpc('confirm_taken', { p_listing_id: listing.id });
        if (data?.success) fetchListing();
      }},
    ]);
  }, [listing, fetchListing]);

  const handleBarterOfferAction = useCallback(async (offerId: string, newStatus: 'accepted' | 'rejected') => {
    if (newStatus === 'accepted' && listing) {
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        const { data } = await supabase.rpc('open_chat_room', { p_listing_id: listing.id, p_other_user_id: offer.offerer_id });
        if (data?.room_id) setMyChatRoomId(data.room_id);
      }
    }
    await supabase.from('barter_offers').update({ status: newStatus }).eq('id', offerId);
    setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, status: newStatus } : o));
  }, [listing, offers]);

  const submitReport = useCallback(async () => {
    if (!profile || !listing || !reportReason.trim()) {
      Alert.alert('خطأ', 'الرجاء كتابة سبب الإبلاغ'); return;
    }
    setReportSubmitting(true);
    await supabase.from('listing_reports').insert({
      listing_id: listing.id, reporter_id: profile.id, reason: reportReason.trim(),
    });
    setReportSubmitting(false);
    setHasReported(true); setReportModalVisible(false);
    Alert.alert('شكراً', 'تم إرسال بلاغك وسنراجعه في أقرب وقت');
  }, [profile, listing, reportReason]);

  const handleDirectChat = useCallback(async () => {
    if (!profile) { guard(() => {}); return; }
    if (!listing) return;
    if (myChatRoomId) { router.push(`/chat?room=${myChatRoomId}`); return; }
    setOpeningChat(true);
    const { data, error } = await supabase.rpc('open_chat_room_as_buyer', { p_listing_id: listing.id });
    setOpeningChat(false);
    if (error || !data?.success) {
      const reason = data?.reason as string;
      if (reason === 'self_chat') Alert.alert('تنبيه', 'لا يمكنك مراسلة نفسك');
      else if (reason === 'listing_unavailable') Alert.alert('غير متاح', 'هذا الإعلان لم يعد متاحاً للتواصل');
      else Alert.alert('خطأ', 'تعذّر فتح المحادثة، حاول مرة أخرى');
      return;
    }
    setMyChatRoomId(data.room_id);
    router.push(`/chat?room=${data.room_id}`);
  }, [profile, listing, myChatRoomId, guard, router]);

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    const skColor = isDark ? '#1e2a22' : '#E8EDF2';
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2', paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>تفاصيل الإعلان</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonBlock height={GALLERY_HEIGHT} radius={0} color={skColor} />
          <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' }}>
              <SkeletonBlock height={26} width={60} radius={20} color={skColor} />
              <SkeletonBlock height={26} width={70} radius={20} color={skColor} />
            </View>
            <SkeletonBlock height={28} radius={8} color={skColor} />
            <SkeletonBlock height={18} radius={8} color={skColor} />
            <SkeletonBlock height={80} radius={10} color={skColor} />
          </View>
          <View style={{ marginHorizontal: Spacing.lg, gap: Spacing.sm }}>
            <SkeletonBlock height={72} radius={14} color={skColor} />
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2', paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>تفاصيل الإعلان</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerContent}>
          <AlertCircle size={52} color={C.error} strokeWidth={1.5} />
          <Text style={[styles.stateTitle, { color: C.text }]}>تعذّر تحميل الإعلان</Text>
          <Text style={[styles.stateSubtitle, { color: C.textSecondary }]}>
            تحقق من اتصالك بالإنترنت وحاول مرة أخرى
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: C.primary }]}
            onPress={() => setRetryCount((c) => c + 1)}
            accessibilityLabel="إعادة المحاولة"
            accessibilityRole="button"
          >
            <RefreshCw size={16} color={isDark ? '#000' : '#fff'} />
            <Text style={[styles.retryBtnText, { color: isDark ? '#000' : '#fff' }]}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Not found state ─────────────────────────────────────────────────────────
  if (!listing) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2', paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>تفاصيل الإعلان</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerContent}>
          <PackageOpen size={60} color={C.textMuted} strokeWidth={1.2} />
          <Text style={[styles.stateTitle, { color: C.text }]}>الإعلان غير موجود</Text>
          <Text style={[styles.stateSubtitle, { color: C.textSecondary }]}>
            ربما تم حذف هذا الإعلان أو انتهت صلاحيته
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: isDark ? C.card : '#F4F7FA', borderWidth: 1, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}
            onPress={() => router.back()}
            accessibilityLabel="العودة"
            accessibilityRole="button"
          >
            <ChevronLeft size={16} color={C.text} />
            <Text style={[styles.retryBtnText, { color: C.text }]}>العودة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Full screen ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <GuestGateModal />

      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2', paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
          accessibilityLabel="رجوع"
          accessibilityRole="button"
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تفاصيل الإعلان</Text>
        <View style={styles.navActions}>
          {!isOwner && (
            <TouchableOpacity
              onPress={() => guard(() => setReportModalVisible(true))}
              style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
              accessibilityLabel="إبلاغ عن الإعلان"
              accessibilityRole="button"
            >
              <Flag size={18} color={hasReported ? C.error : C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Gallery */}
        <Gallery
          images={images}
          isExchange={!!isExchange}
          isUrgent={listing.is_urgent}
          isPremium={listing.premium_badge}
          onTap={(uri) => setFullscreenImg(uri)}
          primaryColor={C.primary}
          exchangeColor={C.exchange}
        />

        {/* Main info card */}
        <View style={[styles.section, { backgroundColor: C.surface }]}>
          {/* Badges row */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: isExchange ? `${C.exchange}22` : `${C.free}22`, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
              {isExchange
                ? <ArrowLeftRight size={10} color={C.exchange} />
                : <Gift size={10} color={C.free} />
              }
              <Text style={[styles.badgeText, { color: isExchange ? C.exchange : C.free }]}>
                {isExchange ? 'بدّل' : 'خذه'}
              </Text>
            </View>
            {listing.dual_mode && (
              <View style={[styles.badge, { backgroundColor: `${C.primary}22` }]}>
                <Text style={[styles.badgeText, { color: C.primary }]}>خذه + بدّل</Text>
              </View>
            )}
            {listing.category ? (
              <View style={[styles.badge, { backgroundColor: isDark ? C.card : '#F4F7FA', borderWidth: 1, borderColor: isDark ? C.cardBorder : '#E8EDF2', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                <Tag size={10} color={C.textSecondary} />
                <Text style={[styles.badgeText, { color: C.textSecondary }]}>
                  {CATEGORY_LABEL[listing.category] ?? listing.category}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: C.text }]}>{listing.title}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {listing.city ? (
              <View style={styles.statItem}>
                <MapPin size={12} color={C.textSecondary} />
                <Text style={[styles.statText, { color: C.textSecondary }]}>{listing.city}</Text>
              </View>
            ) : null}
            <View style={styles.statItem}>
              <Clock size={12} color={C.textSecondary} />
              <Text style={[styles.statText, { color: C.textSecondary }]}>{timeAgo(listing.created_at)}</Text>
            </View>
            <View style={styles.statItem}>
              <Eye size={12} color={C.textSecondary} />
              <Text style={[styles.statText, { color: C.textSecondary }]}>{(listing.views_count ?? 0) + 1}</Text>
            </View>
            {listing.interest_count > 0 && (
              <View style={styles.statItem}>
                <Users size={12} color={C.primary} />
                <Text style={[styles.statText, { color: C.primary }]}>{listing.interest_count} مهتمين</Text>
              </View>
            )}
          </View>

          {/* Countdown */}
          {(isTempReserved || isConfirmedReserved) && listing.reserved_until && (
            <View style={[styles.countdownBanner, { backgroundColor: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.28)' }]}>
              <Clock size={14} color="#F59E0B" />
              <Text style={[styles.countdownText, { color: '#F59E0B' }]}>{countdownText(listing.reserved_until)}</Text>
            </View>
          )}

          {/* Delivery */}
          <View style={[styles.deliveryPill, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
            {listing.delivery_method === 'pickup' && <><User size={14} color={C.primary} /><Text style={[styles.deliveryPillText, { color: C.text }]}>استلام شخصي</Text></>}
            {listing.delivery_method === 'delivery_agent' && <><Truck size={14} color={C.primary} /><Text style={[styles.deliveryPillText, { color: C.text }]}>عبر مندوب توصيل</Text></>}
            {listing.delivery_method === 'direct_contact' && <><MessageCircle size={14} color={C.primary} /><Text style={[styles.deliveryPillText, { color: C.text }]}>تواصل مباشر</Text></>}
          </View>

          {/* Description */}
          {!!listing.description && (
            <Text style={[styles.description, { color: C.textSecondary }]}>{listing.description}</Text>
          )}
        </View>

        {/* Owner card */}
        {owner && (
          <TouchableOpacity
            style={[styles.ownerCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}
            onPress={() => !isOwner && router.push(`/user-profile?id=${listing.user_id}`)}
            activeOpacity={isOwner ? 1 : 0.82}
            accessibilityLabel={isOwner ? undefined : `عرض ملف ${owner.full_name}`}
            accessibilityRole={isOwner ? undefined : 'button'}
          >
            <View style={styles.ownerRow}>
              <View style={[styles.ownerAvatar, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>
                {owner.avatar_url
                  ? <Image source={{ uri: owner.avatar_url }} style={styles.avatarImg} />
                  : <User size={22} color={C.textSecondary} />
                }
              </View>
              <View style={styles.ownerInfo}>
                <View style={styles.ownerNameRow}>
                  <Text style={[styles.ownerName, { color: C.text }]}>{owner.full_name}</Text>
                  {owner.is_verified && (
                    <View style={[styles.microBadge, { backgroundColor: `${C.primary}22` }]}>
                      <ShieldCheck size={9} color={C.primary} />
                      <Text style={[styles.microBadgeText, { color: C.primary }]}>موثوق</Text>
                    </View>
                  )}
                  {owner.phone_verified && (
                    <View style={[styles.microBadge, { backgroundColor: 'rgba(8,145,178,0.12)' }]}>
                      <Text style={[styles.microBadgeText, { color: '#0891b2' }]}>رقم موثق</Text>
                    </View>
                  )}
                </View>
                <View style={styles.ownerMeta}>
                  {owner.rating > 0 && (
                    <View style={styles.ratingRow}>
                      <Star size={11} color="#F59E0B" fill="#F59E0B" />
                      <Text style={[styles.ratingText, { color: C.text }]}>{owner.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <Text style={[styles.ownerListings, { color: C.textSecondary }]}>{owner.listings_count} إعلان</Text>
                </View>
              </View>
              {!isOwner && (
                <View style={[styles.viewProfileChip, { backgroundColor: `${C.primary}14`, borderColor: `${C.primary}38`, borderWidth: 1 }]}>
                  <Text style={[styles.viewProfileText, { color: C.primary }]}>عرض الملف</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Non-owner CTAs (delivery agent form + reservation status) */}
        {!isOwner && !isTaken && (
          <View style={[styles.section, { backgroundColor: C.surface }]}>
            {myReservation && (
              <View style={[styles.resBanner, {
                backgroundColor: myReservation.status === 'confirmed' ? `${C.primary}14` : 'rgba(245,158,11,0.10)',
                borderColor: myReservation.status === 'confirmed' ? C.primary : '#F59E0B',
              }]}>
                <View style={styles.resBannerRow}>
                  <Check size={15} color={myReservation.status === 'confirmed' ? C.primary : '#F59E0B'} />
                  <Text style={[styles.resBannerText, { color: myReservation.status === 'confirmed' ? C.primary : '#F59E0B' }]}>
                    {myReservation.status === 'confirmed' ? 'قُبل حجزك! يمكنك التواصل الآن' : 'طلب الحجز بانتظار موافقة صاحب الإعلان'}
                  </Text>
                </View>
                {myReservation.status !== 'confirmed' && (
                  <Text style={[styles.resCountdown, { color: '#F59E0B' }]}>{countdownText(myReservation.expires_at)}</Text>
                )}
              </View>
            )}

            {myChatRoomId && listing.delivery_method !== 'direct_contact' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? `${C.exchange}18` : C.exchange, borderColor: C.exchange, borderWidth: isDark ? 1 : 0 }]}
                onPress={() => router.push(`/chat?room=${myChatRoomId}`)}
                activeOpacity={0.8}
                accessibilityLabel="فتح المحادثة"
                accessibilityRole="button"
              >
                <MessageSquare size={18} color={isDark ? C.exchange : '#fff'} />
                <Text style={[styles.actionBtnText, { color: isDark ? C.exchange : '#fff' }]}>فتح المحادثة</Text>
              </TouchableOpacity>
            )}

            {listing.delivery_method === 'delivery_agent' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]}
                  onPress={() => setShowDeliveryForm(!showDeliveryForm)}
                  activeOpacity={0.7}
                  accessibilityLabel="طلب مندوب توصيل"
                  accessibilityRole="button"
                >
                  <Truck size={18} color={isDark ? C.primary : '#fff'} />
                  <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>طلب مندوب توصيل</Text>
                </TouchableOpacity>
                {showDeliveryForm && (
                  <View style={[styles.deliveryForm, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                    <Text style={[styles.formTitle, { color: C.text }]}>بيانات طلب التوصيل</Text>
                    <Text style={[styles.formLabel, { color: C.textSecondary }]}>عنوان الاستلام</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
                      placeholder="أدخل عنوان الاستلام" placeholderTextColor={C.textMuted}
                      value={pickupAddress} onChangeText={setPickupAddress} textAlign="right"
                      accessibilityLabel="عنوان الاستلام"
                    />
                    <Text style={[styles.formLabel, { color: C.textSecondary }]}>عنوان التسليم</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
                      placeholder="أدخل عنوان التسليم" placeholderTextColor={C.textMuted}
                      value={dropoffAddress} onChangeText={setDropoffAddress} textAlign="right"
                      accessibilityLabel="عنوان التسليم"
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]}
                      onPress={requestDelivery} disabled={submitting} activeOpacity={0.7}
                      accessibilityLabel="إرسال طلب التوصيل"
                    >
                      {submitting
                        ? <ActivityIndicator color={isDark ? C.primary : '#fff'} />
                        : <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>إرسال الطلب</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Owner controls */}
        {isOwner && (
          <View style={[styles.section, { backgroundColor: C.surface }]}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>أدوات المالك</Text>
            {reservations.length > 0 && (
              <View style={styles.resSection}>
                <Text style={[styles.resSectionTitle, { color: C.text }]}>طلبات الحجز ({reservations.length})</Text>
                {reservations.map((res) => (
                  <View key={res.id} style={[styles.resCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                    <View style={styles.resCardHeader}>
                      <Text style={[styles.resCardTime, { color: C.textSecondary }]}>{timeAgo(res.created_at)}</Text>
                      <Text style={[styles.resCardStatus, { color: C.text }]}>{res.status === 'confirmed' ? 'مقبول ✓' : 'بانتظار الموافقة'}</Text>
                    </View>
                    <Text style={[styles.resCardCountdown, { color: '#F59E0B' }]}>{countdownText(res.expires_at)}</Text>
                    {res.status === 'pending' && (
                      <View style={styles.resActions}>
                        <TouchableOpacity
                          style={[styles.acceptBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]}
                          onPress={() => handleApproveReservation(res.id)}
                          accessibilityLabel="قبول الحجز"
                        >
                          <Check size={14} color={isDark ? C.primary : '#fff'} />
                          <Text style={[styles.resActionText, { color: isDark ? C.primary : '#fff' }]}>قبول الحجز</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtn, { backgroundColor: isDark ? C.errorBg : C.error, borderColor: C.error, borderWidth: isDark ? 1 : 0 }]}
                          onPress={() => handleRejectReservation(res.id)}
                          accessibilityLabel="رفض الحجز"
                        >
                          <X size={14} color={isDark ? C.error : '#fff'} />
                          <Text style={[styles.resActionText, { color: isDark ? C.error : '#fff' }]}>رفض الحجز</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {res.status === 'confirmed' && myChatRoomId && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDark ? `${C.exchange}18` : C.exchange, borderColor: C.exchange, borderWidth: isDark ? 1 : 0 }]}
                        onPress={() => router.push(`/chat?room=${myChatRoomId}`)}
                        accessibilityLabel="فتح المحادثة"
                      >
                        <MessageSquare size={15} color={isDark ? C.exchange : '#fff'} />
                        <Text style={[styles.actionBtnText, { color: isDark ? C.exchange : '#fff' }]}>فتح المحادثة</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
            {!isTaken && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]}
                onPress={handleConfirmTaken} activeOpacity={0.8}
                accessibilityLabel="تأكيد أن الغرض تم أخذه"
              >
                <Check size={18} color={isDark ? C.primary : '#fff'} />
                <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>تأكيد أنه تم أخذه</Text>
              </TouchableOpacity>
            )}
            <View style={styles.placeholderRow}>
              <View style={[styles.placeholder, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                <Zap size={13} color={C.textMuted} /><Text style={[styles.placeholderText, { color: C.textMuted }]}>تمييز الإعلان — قريبًا</Text>
              </View>
              <View style={[styles.placeholder, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                <Zap size={13} color={C.textMuted} /><Text style={[styles.placeholderText, { color: C.textMuted }]}>رفع الإعلان — قريبًا</Text>
              </View>
            </View>
          </View>
        )}

        {/* Barter offers */}
        {isOwner && offers.length > 0 && (
          <View style={[styles.section, { backgroundColor: C.surface }]}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>عروض التبديل ({offers.length})</Text>
            {offers.map((offer) => (
              <View key={offer.id} style={[styles.offerCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                {offer.offer_image_url ? <Image source={{ uri: offer.offer_image_url }} style={styles.offerImg} /> : null}
                <Text style={[styles.offerDesc, { color: C.text }]} numberOfLines={3}>{offer.offer_description}</Text>
                <Text style={[styles.offerTime, { color: C.textSecondary }]}>{timeAgo(offer.created_at)}</Text>
                {offer.status === 'pending' ? (
                  <View style={styles.resActions}>
                    <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleBarterOfferAction(offer.id, 'accepted')} accessibilityLabel="قبول العرض">
                      <Check size={14} color={isDark ? C.primary : '#fff'} /><Text style={[styles.resActionText, { color: isDark ? C.primary : '#fff' }]}>قبول</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: isDark ? C.errorBg : C.error, borderColor: C.error, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleBarterOfferAction(offer.id, 'rejected')} accessibilityLabel="رفض العرض">
                      <X size={14} color={isDark ? C.error : '#fff'} /><Text style={[styles.resActionText, { color: isDark ? C.error : '#fff' }]}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.offerStatusPill, { backgroundColor: offer.status === 'accepted' ? `${C.primary}22` : C.errorBg }]}>
                    <Text style={[styles.offerStatusText, { color: offer.status === 'accepted' ? C.primary : C.error }]}>
                      {offer.status === 'accepted' ? 'تم القبول' : 'تم الرفض'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: insets.bottom + 88 }} />
      </ScrollView>

      {/* ─── Sticky bottom action bar ─────────────────────────────────────────── */}
      <View style={[styles.stickyBar, { backgroundColor: C.navBar, borderTopColor: isDark ? C.border : '#E8EDF2', paddingBottom: insets.bottom + 8 }]}>
        {/* Icon actions */}
        <View style={styles.stickyIcons}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}
            onPress={toggleFavorite}
            accessibilityLabel={isFavorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            accessibilityRole="button"
          >
            <Heart size={20} color={isFavorited ? '#ef4444' : C.textSecondary} fill={isFavorited ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}
            onPress={handleShare}
            accessibilityLabel="مشاركة الإعلان"
            accessibilityRole="button"
          >
            <Share2 size={20} color={C.textSecondary} />
          </TouchableOpacity>
          {canWhatsApp && !isOwner && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: 'rgba(37,211,102,0.12)', borderColor: 'rgba(37,211,102,0.3)' }]}
              onPress={openWhatsApp}
              accessibilityLabel="تواصل عبر واتساب"
              accessibilityRole="button"
            >
              <Phone size={20} color="#25D366" />
            </TouchableOpacity>
          )}
        </View>

        {/* Primary CTA */}
        {!isOwner && !isTaken && (
          <TouchableOpacity
            style={[styles.primaryCta, { backgroundColor: C.primary, shadowColor: C.primary, opacity: openingChat ? 0.75 : 1 }]}
            onPress={handleDirectChat}
            disabled={openingChat}
            activeOpacity={0.82}
            accessibilityLabel={myChatRoomId ? 'فتح المحادثة' : 'تواصل مباشر'}
            accessibilityRole="button"
          >
            {openingChat
              ? <ActivityIndicator color={isDark ? '#000' : '#000'} size="small" />
              : <MessageCircle size={20} color="#000" strokeWidth={2.5} />
            }
            <Text style={styles.primaryCtaText}>
              {myChatRoomId ? 'فتح المحادثة' : (openingChat ? 'جاري الفتح...' : 'تواصل مباشر')}
            </Text>
          </TouchableOpacity>
        )}

        {isTaken && (
          <View style={[styles.primaryCta, { backgroundColor: isDark ? C.card : '#F4F7FA', borderWidth: 1, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
            <Text style={[styles.primaryCtaText, { color: C.textMuted }]}>تم أخذ هذا الغرض</Text>
          </View>
        )}
      </View>

      {/* ─── Fullscreen image viewer ──────────────────────────────────────────── */}
      <Modal
        visible={fullscreenImg !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setFullscreenImg(null)}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: insets.top + 12 }]}
            onPress={() => setFullscreenImg(null)}
            accessibilityLabel="إغلاق"
            accessibilityRole="button"
          >
            <X size={26} color="#fff" />
          </TouchableOpacity>
          {fullscreenImg && (
            <Image
              source={{ uri: fullscreenImg }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface, borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? C.border : '#E0E8EF' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
              <TouchableOpacity onPress={() => setReportModalVisible(false)} accessibilityLabel="إغلاق">
                <X size={22} color={C.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: C.text }]}>إبلاغ عن الإعلان</Text>
              <View style={{ width: 22 }} />
            </View>
            <Text style={[styles.fieldLabel, { color: C.text }]}>سبب الإبلاغ</Text>
            <TextInput
              style={[styles.reportInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
              placeholder="اكتب سبب الإبلاغ..." placeholderTextColor={C.textMuted}
              value={reportReason} onChangeText={setReportReason}
              multiline numberOfLines={3} textAlign="right" textAlignVertical="top"
              accessibilityLabel="سبب الإبلاغ"
            />
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.errorBg, borderColor: C.error, borderWidth: 1, opacity: reportSubmitting ? 0.6 : 1 }]}
              onPress={submitReport} disabled={reportSubmitting}
              accessibilityLabel="إرسال البلاغ"
            >
              {reportSubmitting
                ? <ActivityIndicator color={C.error} />
                : <Text style={[styles.actionBtnText, { color: C.error }]}>إرسال البلاغ</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PhoneVerifyModal
        visible={showVerifyModal}
        currentPhone={profile?.phone || ''}
        onClose={() => setShowVerifyModal(false)}
        onVerified={() => setShowVerifyModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  stateTitle: { fontSize: FontSizes.xl, fontWeight: '700', textAlign: 'center', marginTop: Spacing.sm },
  stateSubtitle: { fontSize: FontSizes.md, textAlign: 'center', lineHeight: 24 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
    minHeight: 48,
  },
  retryBtnText: { fontSize: FontSizes.md, fontWeight: '700' },

  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },

  // Gallery
  galleryPlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  galleryCounter: {
    position: 'absolute', bottom: 48, right: 12,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  galleryCounterText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600' },
  dotsRow: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', gap: 5, alignItems: 'center',
  },
  dot: { height: 6, borderRadius: 3 },
  galleryOverlayRow: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '700' },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  premiumText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '700' },

  // Info section
  section: { padding: Spacing.lg, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  title: { fontSize: FontSizes.xl, fontWeight: '800', textAlign: 'right', lineHeight: 30 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSizes.xs },
  countdownBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end',
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  countdownText: { fontSize: FontSizes.md, fontWeight: '700' },
  deliveryPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end',
    borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, alignSelf: 'flex-end',
  },
  deliveryPillText: { fontSize: FontSizes.sm, fontWeight: '600' },
  description: { fontSize: FontSizes.md, textAlign: 'right', lineHeight: 26 },

  // Owner card
  ownerCard: { marginHorizontal: Spacing.lg, marginVertical: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  ownerInfo: { flex: 1, alignItems: 'flex-end' },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  ownerName: { fontSize: FontSizes.md, fontWeight: '700' },
  microBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: BorderRadius.full },
  microBadgeText: { fontSize: 10, fontWeight: '700' },
  ownerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: FontSizes.sm, fontWeight: '600' },
  ownerListings: { fontSize: FontSizes.xs },
  viewProfileChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  viewProfileText: { fontSize: 12, fontWeight: '700' },

  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'right' },

  // Reservation / CTA
  resBanner: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4 },
  resBannerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  resBannerText: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right', flex: 1 },
  resCountdown: { fontSize: FontSizes.xs, textAlign: 'right' },

  actionBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, borderRadius: BorderRadius.md, paddingVertical: 14, minHeight: 48,
  },
  actionBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },

  deliveryForm: { gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md },
  formTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  formLabel: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  formInput: {
    borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSizes.md, textAlign: 'right', minHeight: 48,
  },

  resSection: { gap: Spacing.sm },
  resSectionTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  resCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  resCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resCardTime: { fontSize: FontSizes.xs },
  resCardStatus: { fontSize: FontSizes.sm, fontWeight: '700' },
  resCardCountdown: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  resActions: { flexDirection: 'row', gap: Spacing.md },
  acceptBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingVertical: 10, minHeight: 44 },
  rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingVertical: 10, minHeight: 44 },
  resActionText: { fontWeight: '700', fontSize: FontSizes.sm },

  placeholderRow: { flexDirection: 'row', gap: Spacing.md },
  placeholder: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: BorderRadius.md, paddingVertical: 10, borderWidth: 1 },
  placeholderText: { fontSize: FontSizes.xs, fontWeight: '600' },

  offerCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  offerImg: { width: '100%', height: 100, borderRadius: BorderRadius.sm, resizeMode: 'cover' },
  offerDesc: { fontSize: FontSizes.md, textAlign: 'right' },
  offerTime: { fontSize: FontSizes.xs, textAlign: 'right' },
  offerStatusPill: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  offerStatusText: { fontSize: FontSizes.xs, fontWeight: '700' },

  // Sticky bottom bar
  stickyBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: 10,
    borderTopWidth: 1,
  },
  stickyIcons: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  primaryCta: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, height: 48, borderRadius: 14,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  primaryCtaText: { fontSize: FontSizes.md, fontWeight: '800', color: '#000' },

  // Fullscreen
  fullscreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullscreenClose: {
    position: 'absolute', right: 16, zIndex: 10,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  fullscreenImage: { width: '100%', height: '80%' },

  // Modals
  fieldLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.sm, borderTopWidth: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  reportInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, minHeight: 80, textAlign: 'right' },
});
