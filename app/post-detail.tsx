import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react-native';
import PhoneVerifyModal from '@/components/PhoneVerifyModal';

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

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
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

  const fetchListing = useCallback(async () => {
    const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
    if (!data) { setLoading(false); return; }
    setListing(data);
    supabase.rpc('increment_listing_views', { p_listing_id: id });

    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, rating_avg, is_verified, phone_verified, allow_whatsapp')
      .eq('id', data.user_id).maybeSingle();

    if (ownerData) {
      const { count } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('user_id', data.user_id);
      setOwner({ ...ownerData, rating: ownerData.rating_avg ?? 0, listings_count: count ?? 0 });
    }

    if (profile) {
      const { data: fav } = await supabase.from('favorites').select('id').eq('user_id', profile.id).eq('listing_id', id).maybeSingle();
      if (fav) { setIsFavorited(true); setFavoriteId(fav.id); }

      const { data: myRes } = await supabase.from('reservations').select('*')
        .eq('listing_id', id).eq('requester_id', profile.id).in('status', ['pending', 'confirmed']).maybeSingle();
      if (myRes) setMyReservation(myRes);

      const { data: room } = await supabase.from('chat_rooms').select('id')
        .eq('listing_id', id).or(`owner_id.eq.${profile.id},other_user_id.eq.${profile.id}`).maybeSingle();
      if (room) setMyChatRoomId(room.id);

      const { data: report } = await supabase.from('listing_reports').select('id')
        .eq('reporter_id', profile.id).eq('listing_id', id).maybeSingle();
      if (report) setHasReported(true);

      if (profile.id === data.user_id) {
        const { data: resData } = await supabase.from('reservations').select('*')
          .eq('listing_id', id).in('status', ['pending', 'confirmed']).order('created_at', { ascending: true });
        if (resData) setReservations(resData);
        if (data.type === 'exchange' || data.dual_mode) {
          const { data: offersData } = await supabase.from('barter_offers').select('*')
            .eq('listing_id', id).order('created_at', { ascending: false });
          if (offersData) setOffers(offersData);
        }
      }
    }
    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  const toggleFavorite = async () => {
    if (!profile) return;
    if (isFavorited && favoriteId) {
      await supabase.from('favorites').delete().eq('id', favoriteId);
      setIsFavorited(false); setFavoriteId(null);
    } else {
      const { data } = await supabase.from('favorites').insert({ user_id: profile.id, listing_id: id }).select('id').maybeSingle();
      if (data) { setIsFavorited(true); setFavoriteId(data.id); }
    }
  };

  const openWhatsApp = () => {
    if (!listing?.phone) return;
    const raw = listing.phone.replace(/[\s\-()]/g, '');
    const normalized = raw.startsWith('0') ? '966' + raw.slice(1) : raw;
    Linking.openURL(`https://wa.me/${normalized}`).catch(() => Alert.alert('تعذر الفتح', 'تأكد من تثبيت تطبيق واتساب'));
  };

  const requestDelivery = async () => {
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
  };

  const handleApproveReservation = async (reservationId: string) => {
    const { data } = await supabase.rpc('approve_reservation', { p_reservation_id: reservationId });
    if (data?.success) {
      if (data.chat_room_id) setMyChatRoomId(data.chat_room_id);
      fetchListing();
    } else {
      Alert.alert('خطأ', data?.reason === 'expired' ? 'انتهت مدة الحجز' : 'تعذّر القبول');
    }
  };

  const handleRejectReservation = async (reservationId: string) => {
    const { data } = await supabase.rpc('reject_reservation', { p_reservation_id: reservationId });
    if (data?.success) fetchListing();
  };

  const handleConfirmTaken = async () => {
    if (!listing) return;
    Alert.alert('تأكيد', 'هل تأكد أن الغرض تم أخذه؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم، تم أخذه', onPress: async () => {
        const { data } = await supabase.rpc('confirm_taken', { p_listing_id: listing.id });
        if (data?.success) fetchListing();
      }},
    ]);
  };

  const handleBarterOfferAction = async (offerId: string, newStatus: 'accepted' | 'rejected') => {
    if (newStatus === 'accepted' && listing) {
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        const { data } = await supabase.rpc('open_chat_room', { p_listing_id: listing.id, p_other_user_id: offer.offerer_id });
        if (data?.room_id) setMyChatRoomId(data.room_id);
      }
    }
    await supabase.from('barter_offers').update({ status: newStatus }).eq('id', offerId);
    setOffers((prev) => prev.map((o) => o.id === offerId ? { ...o, status: newStatus } : o));
  };

  const submitReport = async () => {
    if (!profile || !listing || !reportReason.trim()) {
      Alert.alert('خطأ', 'الرجاء كتابة سبب الإبلاغ'); return;
    }
    setReportSubmitting(true);
    await supabase.from('listing_reports').insert({ listing_id: listing.id, reporter_id: profile.id, reason: reportReason.trim() });
    setReportSubmitting(false);
    setHasReported(true); setReportModalVisible(false);
    Alert.alert('شكراً', 'تم إرسال بلاغك وسنراجعه في أقرب وقت');
  };

  const handleDirectChat = async () => {
    if (!profile) {
      router.push('/(auth)/login');
      return;
    }
    if (!listing) return;

    // If room already exists, go straight there
    if (myChatRoomId) {
      router.push(`/chat?room=${myChatRoomId}`);
      return;
    }

    setOpeningChat(true);
    const { data, error } = await supabase.rpc('open_chat_room_as_buyer', {
      p_listing_id: listing.id,
    });
    setOpeningChat(false);

    if (error || !data?.success) {
      const reason = data?.reason as string;
      if (reason === 'self_chat') {
        Alert.alert('تنبيه', 'لا يمكنك مراسلة نفسك');
      } else {
        Alert.alert('خطأ', 'تعذّر فتح المحادثة، حاول مرة أخرى');
      }
      return;
    }

    setMyChatRoomId(data.room_id);
    router.push(`/chat?room=${data.room_id}`);
  };

  const C = colors;

  if (loading) return <View style={[styles.centerContent, { backgroundColor: C.background }]}><ActivityIndicator size="large" color={C.primary} /></View>;
  if (!listing) return <View style={[styles.centerContent, { backgroundColor: C.background }]}><Text style={{ color: C.textSecondary, fontSize: FontSizes.lg }}>الإعلان غير موجود</Text></View>;

  const isOwner = profile?.id === listing.user_id;
  const isExchange = listing.type === 'exchange';
  const isTaken = listing.status === 'taken';
  const isTempReserved = listing.status === 'reserved_temp';
  const isConfirmedReserved = listing.status === 'reserved';
  const canWhatsApp = owner?.allow_whatsapp !== false && !!listing.phone;

  const statusMap: Record<string, { label: string; bg: string; color: string }> = {
    available: { label: 'متاح', bg: `${C.primary}22`, color: C.primary },
    reserved_temp: { label: 'محجوز مؤقتًا', bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' },
    reserved: { label: 'محجوز', bg: `${C.exchange}22`, color: C.exchange },
    taken: { label: 'مأخوذ', bg: 'rgba(100,116,139,0.18)', color: C.textSecondary },
  };
  const statusCfg = statusMap[listing.status] ?? statusMap.taken;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2', paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تفاصيل الإعلان</Text>
        <View style={styles.navActions}>
          {!isOwner && (
            <TouchableOpacity onPress={() => setReportModalVisible(true)} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
              <Flag size={18} color={hasReported ? C.error : C.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleFavorite} activeOpacity={0.7} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <Heart size={20} color={isFavorited ? '#ef4444' : C.textSecondary} fill={isFavorited ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        {listing.image_url ? (
          <View style={styles.heroWrapper}>
            <Image source={{ uri: listing.image_url }} style={styles.heroImage} />
            <View style={styles.heroOverlayRow}>
              {listing.is_urgent && (
                <View style={styles.urgentOverlay}>
                  <Flame size={12} color="#fff" />
                  <Text style={styles.urgentText}>مستعجل</Text>
                </View>
              )}
              {listing.premium_badge && (
                <View style={styles.premiumOverlay}>
                  <Zap size={11} color="#fff" />
                  <Text style={styles.premiumText}>مميز</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: isExchange ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF') : (isDark ? 'rgba(0,204,106,0.15)' : '#ECFDF5') }]}>
            {isExchange ? <ArrowLeftRight size={52} color={C.exchange} /> : <Gift size={52} color={C.free} />}
          </View>
        )}

        {/* Main section */}
        <View style={[styles.section, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2', borderBottomWidth: 1 }]}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: isExchange ? `${C.exchange}22` : `${C.free}22` }]}>
              {isExchange ? <ArrowLeftRight size={10} color={C.exchange} /> : <Gift size={10} color={C.free} />}
              <Text style={[styles.typeBadgeText, { color: isExchange ? C.exchange : C.free }]}>{isExchange ? 'بدّل' : 'خذه'}</Text>
            </View>
            {listing.dual_mode && (
              <View style={[styles.dualBadge, { backgroundColor: `${C.primary}22` }]}>
                <Text style={[styles.dualBadgeText, { color: C.primary }]}>خذه + بدّل</Text>
              </View>
            )}
            {listing.category ? (
              <View style={[styles.catBadge, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                <Tag size={10} color={C.textSecondary} />
                <Text style={[styles.catBadgeText, { color: C.textSecondary }]}>{CATEGORY_LABEL[listing.category] ?? listing.category}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, { color: C.text }]}>{listing.title}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
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
            <View style={styles.statItem}>
              <Clock size={12} color={C.textSecondary} />
              <Text style={[styles.statText, { color: C.textSecondary }]}>{timeAgo(listing.created_at)}</Text>
            </View>
            {listing.city && (
              <View style={styles.statItem}>
                <MapPin size={12} color={C.textSecondary} />
                <Text style={[styles.statText, { color: C.textSecondary }]}>{listing.city}</Text>
              </View>
            )}
          </View>

          {/* Countdown */}
          {(isTempReserved || isConfirmedReserved) && listing.reserved_until && (
            <View style={[styles.countdownBanner, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <Clock size={14} color="#F59E0B" />
              <Text style={[styles.countdownBannerText, { color: '#F59E0B' }]}>{countdownText(listing.reserved_until)}</Text>
            </View>
          )}

          {listing.description ? <Text style={[styles.description, { color: C.textSecondary }]}>{listing.description}</Text> : null}
        </View>

        {/* Owner card */}
        {owner && (
          <View style={[styles.ownerCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
            <View style={styles.ownerInfo}>
              <View style={[styles.ownerAvatar, { backgroundColor: isDark ? C.surface : '#F4F7FA' }]}>
                {owner.avatar_url
                  ? <Image source={{ uri: owner.avatar_url }} style={styles.avatarImg} />
                  : <User size={22} color={C.textSecondary} />
                }
              </View>
              <View style={styles.ownerText}>
                <View style={styles.ownerNameRow}>
                  <Text style={[styles.ownerName, { color: C.text }]}>{owner.full_name}</Text>
                  {owner.is_verified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: `${C.primary}22` }]}>
                      <ShieldCheck size={10} color={C.primary} />
                      <Text style={[styles.verifiedText, { color: C.primary }]}>موثوق</Text>
                    </View>
                  )}
                  {owner.phone_verified && (
                    <View style={[styles.phoneVerifiedBadge, { backgroundColor: 'rgba(8,145,178,0.15)' }]}>
                      <Text style={[styles.phoneVerifiedText, { color: '#0891b2' }]}>رقم موثق</Text>
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
            </View>
          </View>
        )}

        {/* Delivery method */}
        <View style={[styles.section, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2', borderBottomWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>طريقة التسليم</Text>
          <View style={[styles.deliveryCard, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
            {listing.delivery_method === 'pickup' && (
              <View style={styles.deliveryRow}><User size={16} color={C.primary} /><Text style={[styles.deliveryText, { color: C.text }]}>استلام شخصي</Text></View>
            )}
            {listing.delivery_method === 'delivery_agent' && (
              <View style={styles.deliveryRow}><Truck size={16} color={C.primary} /><Text style={[styles.deliveryText, { color: C.text }]}>عبر مندوب توصيل</Text></View>
            )}
            {listing.delivery_method === 'direct_contact' && (
              <View style={styles.deliveryRow}><MessageCircle size={16} color={C.primary} /><Text style={[styles.deliveryText, { color: C.text }]}>تواصل مباشر</Text></View>
            )}
          </View>
        </View>

        {/* ─── NON-OWNER CTAs ─── */}
        {!isOwner && !isTaken && (
          <View style={[styles.section, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2', borderBottomWidth: 1 }]}>
            {myReservation && (
              <View style={[styles.myResBanner, { backgroundColor: myReservation.status === 'confirmed' ? `${C.primary}18` : 'rgba(245,158,11,0.12)', borderColor: myReservation.status === 'confirmed' ? C.primary : '#F59E0B' }]}>
                <View style={styles.myResRow}>
                  <Check size={15} color={myReservation.status === 'confirmed' ? C.primary : '#F59E0B'} />
                  <Text style={[styles.myResText, { color: myReservation.status === 'confirmed' ? C.primary : '#F59E0B' }]}>
                    {myReservation.status === 'confirmed' ? 'قُبل حجزك! يمكنك التواصل الآن' : 'طلب الحجز بانتظار موافقة صاحب الإعلان'}
                  </Text>
                </View>
                {myReservation.status !== 'confirmed' && (
                  <Text style={[styles.myResCountdown, { color: '#F59E0B' }]}>{countdownText(myReservation.expires_at)}</Text>
                )}
              </View>
            )}

            {/* ── تواصل مباشر button — always shown for non-owner ── */}
            {listing.delivery_method === 'direct_contact' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryActionBtn, { backgroundColor: C.primary, shadowColor: C.primary, opacity: openingChat ? 0.75 : 1 }]}
                onPress={handleDirectChat}
                activeOpacity={0.82}
                disabled={openingChat}
              >
                {openingChat
                  ? <ActivityIndicator color="#000" size="small" />
                  : <MessageCircle size={20} color="#000" strokeWidth={2.5} />
                }
                <Text style={styles.primaryActionBtnText}>
                  {myChatRoomId ? 'فتح المحادثة' : (openingChat ? 'جاري الفتح...' : 'تواصل مباشر')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Open existing chat room (for any delivery method after approval) */}
            {myChatRoomId && listing.delivery_method !== 'direct_contact' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: isDark ? `${C.exchange}18` : C.exchange, borderColor: C.exchange, borderWidth: isDark ? 1 : 0 }]}
                onPress={() => router.push(`/chat?room=${myChatRoomId}`)}
                activeOpacity={0.8}
              >
                <MessageSquare size={18} color={isDark ? C.exchange : '#fff'} />
                <Text style={[styles.actionBtnText, { color: isDark ? C.exchange : '#fff' }]}>فتح المحادثة</Text>
              </TouchableOpacity>
            )}

            {canWhatsApp && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={openWhatsApp} activeOpacity={0.8}>
                <Phone size={18} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>تواصل عبر واتساب</Text>
              </TouchableOpacity>
            )}
            {listing.delivery_method === 'delivery_agent' && (
              <>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={() => setShowDeliveryForm(!showDeliveryForm)} activeOpacity={0.7}>
                  <Truck size={18} color={isDark ? C.primary : '#fff'} />
                  <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>طلب مندوب توصيل</Text>
                </TouchableOpacity>
                {showDeliveryForm && (
                  <View style={[styles.deliveryForm, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                    <Text style={[styles.formTitle, { color: C.text }]}>بيانات طلب التوصيل</Text>
                    <Text style={[styles.formLabel, { color: C.textSecondary }]}>عنوان الاستلام</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} placeholder="أدخل عنوان الاستلام" placeholderTextColor={C.textMuted} value={pickupAddress} onChangeText={setPickupAddress} textAlign="right" />
                    <Text style={[styles.formLabel, { color: C.textSecondary }]}>عنوان التسليم</Text>
                    <TextInput style={[styles.formInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} placeholder="أدخل عنوان التسليم" placeholderTextColor={C.textMuted} value={dropoffAddress} onChangeText={setDropoffAddress} textAlign="right" />
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={requestDelivery} disabled={submitting} activeOpacity={0.7}>
                      {submitting ? <ActivityIndicator color={isDark ? C.primary : '#fff'} /> : <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>إرسال الطلب</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ─── OWNER CONTROLS ─── */}
        {isOwner && (
          <View style={[styles.section, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2', borderBottomWidth: 1 }]}>
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
                        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleApproveReservation(res.id)}>
                          <Check size={14} color={isDark ? C.primary : '#fff'} />
                          <Text style={[styles.resActionText, { color: isDark ? C.primary : '#fff' }]}>قبول الحجز</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: isDark ? C.errorBg : C.error, borderColor: C.error, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleRejectReservation(res.id)}>
                          <X size={14} color={isDark ? C.error : '#fff'} />
                          <Text style={[styles.resActionText, { color: isDark ? C.error : '#fff' }]}>رفض الحجز</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {res.status === 'confirmed' && myChatRoomId && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? `${C.exchange}18` : C.exchange, borderColor: C.exchange, borderWidth: isDark ? 1 : 0 }]} onPress={() => router.push(`/chat?room=${myChatRoomId}`)}>
                        <MessageSquare size={15} color={isDark ? C.exchange : '#fff'} />
                        <Text style={[styles.actionBtnText, { color: isDark ? C.exchange : '#fff' }]}>فتح المحادثة</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
            {!isTaken && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={handleConfirmTaken} activeOpacity={0.8}>
                <Check size={18} color={isDark ? C.primary : '#fff'} />
                <Text style={[styles.actionBtnText, { color: isDark ? C.primary : '#fff' }]}>تأكيد أنه تم أخذه</Text>
              </TouchableOpacity>
            )}
            <View style={styles.monoPlaceholderRow}>
              <View style={[styles.monoPlaceholder, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                <Zap size={13} color={C.textMuted} />
                <Text style={[styles.monoPlaceholderText, { color: C.textMuted }]}>تمييز الإعلان — قريبًا</Text>
              </View>
              <View style={[styles.monoPlaceholder, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                <Zap size={13} color={C.textMuted} />
                <Text style={[styles.monoPlaceholderText, { color: C.textMuted }]}>رفع الإعلان — قريبًا</Text>
              </View>
            </View>
          </View>
        )}

        {/* Barter offers */}
        {isOwner && offers.length > 0 && (
          <View style={[styles.section, { backgroundColor: C.surface, borderBottomColor: isDark ? C.border : '#E8EDF2', borderBottomWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>عروض التبديل ({offers.length})</Text>
            {offers.map((offer) => (
              <View key={offer.id} style={[styles.offerCard, { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2' }]}>
                {offer.offer_image_url ? <Image source={{ uri: offer.offer_image_url }} style={styles.offerImg} /> : null}
                <Text style={[styles.offerDesc, { color: C.text }]} numberOfLines={3}>{offer.offer_description}</Text>
                <Text style={[styles.offerTime, { color: C.textSecondary }]}>{timeAgo(offer.created_at)}</Text>
                {offer.status === 'pending' ? (
                  <View style={styles.resActions}>
                    <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: isDark ? `${C.primary}18` : C.primary, borderColor: C.primary, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleBarterOfferAction(offer.id, 'accepted')}>
                      <Check size={14} color={isDark ? C.primary : '#fff'} /><Text style={[styles.resActionText, { color: isDark ? C.primary : '#fff' }]}>قبول</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: isDark ? C.errorBg : C.error, borderColor: C.error, borderWidth: isDark ? 1 : 0 }]} onPress={() => handleBarterOfferAction(offer.id, 'rejected')}>
                      <X size={14} color={isDark ? C.error : '#fff'} /><Text style={[styles.resActionText, { color: isDark ? C.error : '#fff' }]}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.offerStatusBadge, { backgroundColor: offer.status === 'accepted' ? `${C.primary}22` : C.errorBg }]}>
                    <Text style={[styles.offerStatusText, { color: offer.status === 'accepted' ? C.primary : C.error }]}>{offer.status === 'accepted' ? 'تم القبول' : 'تم الرفض'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {listing.phone ? (
          <View style={[styles.phoneSection, { borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
            <Phone size={13} color={C.primary} />
            <Text style={[styles.phoneText, { color: C.primary }]}>{listing.phone}</Text>
          </View>
        ) : null}

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.surface, borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? C.border : '#E0E8EF' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}><X size={22} color={C.text} /></TouchableOpacity>
              <Text style={[styles.modalTitle, { color: C.text }]}>إبلاغ عن الإعلان</Text>
              <View style={{ width: 22 }} />
            </View>
            <Text style={[styles.fieldLabel, { color: C.text }]}>سبب الإبلاغ</Text>
            <TextInput
              style={[styles.reportInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
              placeholder="اكتب سبب الإبلاغ..." placeholderTextColor={C.textMuted}
              value={reportReason} onChangeText={setReportReason}
              multiline numberOfLines={3} textAlign="right" textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.errorBg, borderColor: C.error, borderWidth: 1, opacity: reportSubmitting ? 0.6 : 1 }]}
              onPress={submitReport} disabled={reportSubmitting}
            >
              {reportSubmitting ? <ActivityIndicator color={C.error} /> : <Text style={[styles.actionBtnText, { color: C.error }]}>إرسال البلاغ</Text>}
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
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  heroWrapper: { position: 'relative' },
  heroImage: { width: '100%', height: 260, resizeMode: 'cover' },
  heroPlaceholder: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center' },
  heroOverlayRow: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  urgentOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '700' },
  premiumOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
  },
  premiumText: { fontSize: FontSizes.xs, color: '#fff', fontWeight: '700' },

  section: { padding: Spacing.lg, gap: Spacing.md },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusBadgeText: { fontSize: FontSizes.sm, fontWeight: '700' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  typeBadgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  dualBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  dualBadgeText: { fontSize: FontSizes.xs, fontWeight: '700' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  catBadgeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  title: { fontSize: FontSizes.xl, fontWeight: '800', textAlign: 'right', lineHeight: 30 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSizes.xs },
  countdownBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, justifyContent: 'flex-end',
  },
  countdownBannerText: { fontSize: FontSizes.md, fontWeight: '700' },
  description: { fontSize: FontSizes.md, textAlign: 'right', lineHeight: 26 },

  ownerCard: { marginHorizontal: Spacing.lg, marginVertical: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md },
  ownerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  ownerText: { flex: 1, alignItems: 'flex-end' },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  ownerName: { fontSize: FontSizes.md, fontWeight: '700' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full },
  verifiedText: { fontSize: 10, fontWeight: '700' },
  phoneVerifiedBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full },
  phoneVerifiedText: { fontSize: 10, fontWeight: '700' },
  ownerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: FontSizes.sm, fontWeight: '600' },
  ownerListings: { fontSize: FontSizes.xs },

  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'right' },
  deliveryCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  deliveryText: { fontSize: FontSizes.md, fontWeight: '600' },

  myResBanner: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4 },
  myResRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  myResText: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right', flex: 1 },
  myResCountdown: { fontSize: FontSizes.xs, textAlign: 'right' },

  actionBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, borderRadius: BorderRadius.md, paddingVertical: 14,
  },
  actionBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },
  primaryActionBtn: {
    paddingVertical: 17,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 10,
  },
  primaryActionBtnText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#000' },

  deliveryForm: { gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.md },
  formTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  formLabel: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  formInput: {
    borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSizes.md, textAlign: 'right',
  },

  resSection: { gap: Spacing.sm },
  resSectionTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  resCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  resCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resCardTime: { fontSize: FontSizes.xs },
  resCardStatus: { fontSize: FontSizes.sm, fontWeight: '700' },
  resCardCountdown: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'right' },
  resActions: { flexDirection: 'row', gap: Spacing.md },
  acceptBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingVertical: 10 },
  rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingVertical: 10 },
  resActionText: { fontWeight: '700', fontSize: FontSizes.sm },

  monoPlaceholderRow: { flexDirection: 'row', gap: Spacing.md },
  monoPlaceholder: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: BorderRadius.md, paddingVertical: 10, borderWidth: 1 },
  monoPlaceholderText: { fontSize: FontSizes.xs, fontWeight: '600' },

  offerCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  offerImg: { width: '100%', height: 100, borderRadius: BorderRadius.sm, resizeMode: 'cover' },
  offerDesc: { fontSize: FontSizes.md, textAlign: 'right' },
  offerTime: { fontSize: FontSizes.xs, textAlign: 'right' },
  offerStatusBadge: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  offerStatusText: { fontSize: FontSizes.xs, fontWeight: '700' },

  phoneSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1 },
  phoneText: { fontSize: FontSizes.md, fontWeight: '600' },

  fieldLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.sm, borderTopWidth: 1 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  reportInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.md, minHeight: 80, textAlign: 'right' },
});
