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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  city: string;
  phone: string;
  delivery_method: string;
  image_url: string;
  created_at: string;
  status: string;
  is_urgent: boolean;
  interest_count: number;
  views_count: number;
  reserved_by: string | null;
  reserved_until: string | null;
  dual_mode: boolean;
  is_featured: boolean;
  premium_badge: boolean;
}

interface OwnerProfile {
  full_name: string;
  avatar_url: string | null;
  rating: number;
  is_verified: boolean;
  phone_verified: boolean;
  allow_whatsapp: boolean;
  listings_count: number;
}

interface BarterOffer {
  id: string;
  offerer_id: string;
  offer_description: string;
  offer_image_url: string;
  status: string;
  created_at: string;
}

interface Reservation {
  id: string;
  requester_id: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  electronics: 'إلكترونيات',
  clothing:    'ملابس',
  furniture:   'أثاث',
  books:       'كتب',
  toys:        'ألعاب',
  home_tools:  'أدوات منزلية',
  cars:        'سيارات',
  sports:      'رياضة',
  animals:     'حيوانات',
  other:       'أخرى',
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    available:     { label: 'متاح',          color: '#059669' },
    reserved_temp: { label: 'محجوز مؤقتًا', color: Colors.accent[500] },
    reserved:      { label: 'محجوز',         color: '#2563eb' },
    taken:         { label: 'تم أخذه',       color: Colors.neutral[400] },
  };
  const cfg = map[status] ?? { label: status, color: Colors.neutral[400] };
  return (
    <View style={[badgeSt.base, { backgroundColor: cfg.color }]}>
      <Text style={badgeSt.text}>{cfg.label}</Text>
    </View>
  );
}

const badgeSt = StyleSheet.create({
  base: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  text: { color: Colors.white, fontSize: FontSizes.sm, fontWeight: '700' },
});

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
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

  const fetchListing = useCallback(async () => {
    const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
    if (!data) { setLoading(false); return; }
    setListing(data);

    supabase.rpc('increment_listing_views', { p_listing_id: id });

    // Fetch owner
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, rating_avg, is_verified, phone_verified, allow_whatsapp')
      .eq('id', data.user_id)
      .maybeSingle();

    if (ownerData) {
      const { count } = await supabase
        .from('listings').select('*', { count: 'exact', head: true }).eq('user_id', data.user_id);
      setOwner({ ...ownerData, rating: ownerData.rating_avg ?? 0, listings_count: count ?? 0 });
    }

    if (profile) {
      // Favorite
      const { data: fav } = await supabase
        .from('favorites').select('id').eq('user_id', profile.id).eq('listing_id', id).maybeSingle();
      if (fav) { setIsFavorited(true); setFavoriteId(fav.id); }

      // My reservation
      const { data: myRes } = await supabase
        .from('reservations').select('*')
        .eq('listing_id', id).eq('requester_id', profile.id)
        .in('status', ['pending', 'confirmed']).maybeSingle();
      if (myRes) setMyReservation(myRes);

      // My chat room
      const { data: room } = await supabase
        .from('chat_rooms').select('id')
        .eq('listing_id', id)
        .or(`owner_id.eq.${profile.id},other_user_id.eq.${profile.id}`)
        .maybeSingle();
      if (room) setMyChatRoomId(room.id);

      // Report
      const { data: report } = await supabase
        .from('listing_reports').select('id')
        .eq('reporter_id', profile.id).eq('listing_id', id).maybeSingle();
      if (report) setHasReported(true);

      // Owner: fetch reservations + barter offers
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
      {
        text: 'نعم، تم أخذه', onPress: async () => {
          const { data } = await supabase.rpc('confirm_taken', { p_listing_id: listing.id });
          if (data?.success) fetchListing();
        },
      },
    ]);
  };

  const handleBarterOfferAction = async (offerId: string, newStatus: 'accepted' | 'rejected') => {
    if (newStatus === 'accepted' && listing) {
      // open chat room with the offerer
      const offer = offers.find((o) => o.id === offerId);
      if (offer) {
        const { data } = await supabase.rpc('open_chat_room', {
          p_listing_id: listing.id, p_other_user_id: offer.offerer_id,
        });
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

  if (loading) return <View style={styles.centerContent}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>;
  if (!listing) return <View style={styles.centerContent}><Text style={styles.notFound}>الإعلان غير موجود</Text></View>;

  const isOwner = profile?.id === listing.user_id;
  const isExchange = listing.type === 'exchange';
  const isFree = listing.type === 'free';
  const isTaken = listing.status === 'taken';
  const isTempReserved = listing.status === 'reserved_temp';
  const isConfirmedReserved = listing.status === 'reserved';
  const canWhatsApp = owner?.allow_whatsapp !== false && !!listing.phone;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>تفاصيل الإعلان</Text>
        <View style={styles.navActions}>
          {!isOwner && (
            <TouchableOpacity onPress={() => setReportModalVisible(true)} style={styles.navBtn}>
              <Flag size={20} color={hasReported ? Colors.error[500] : Colors.neutral[400]} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleFavorite} activeOpacity={0.7} style={styles.navBtn}>
            <Heart size={22} color={isFavorited ? '#ef4444' : Colors.neutral[400]} fill={isFavorited ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        {listing.image_url ? (
          <View style={styles.heroWrapper}>
            <Image source={{ uri: listing.image_url }} style={styles.heroImage} />
            {listing.is_urgent && (
              <View style={styles.urgentOverlay}>
                <Flame size={14} color={Colors.white} />
                <Text style={styles.urgentText}>مستعجل</Text>
              </View>
            )}
            {listing.premium_badge && (
              <View style={styles.premiumOverlay}>
                <Zap size={12} color={Colors.white} />
                <Text style={styles.premiumText}>مميز</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, isExchange ? styles.heroExchange : styles.heroFree]}>
            {isExchange ? <ArrowLeftRight size={52} color={Colors.white} /> : <Gift size={52} color={Colors.white} />}
          </View>
        )}

        <View style={styles.section}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            <StatusBadge status={listing.status} />
            <View style={[styles.typeBadge, isExchange ? styles.typeBadgeExchange : styles.typeBadgeFree]}>
              {isExchange ? <ArrowLeftRight size={11} color={Colors.white} /> : <Gift size={11} color={Colors.white} />}
              <Text style={styles.typeBadgeText}>{isExchange ? 'بدّل' : 'خذه'}</Text>
            </View>
            {listing.dual_mode && (
              <View style={styles.dualBadge}><Text style={styles.dualBadgeText}>خذه + بدّل</Text></View>
            )}
            {listing.category ? (
              <View style={styles.catBadge}>
                <Tag size={11} color={Colors.primary[700]} />
                <Text style={styles.catBadgeText}>{CATEGORY_LABEL[listing.category] ?? listing.category}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{listing.title}</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Eye size={13} color={Colors.neutral[400]} />
              <Text style={styles.statText}>{(listing.views_count ?? 0) + 1}</Text>
            </View>
            {listing.interest_count > 0 && (
              <View style={styles.statItem}>
                <Users size={13} color={Colors.primary[600]} />
                <Text style={[styles.statText, { color: Colors.primary[600] }]}>{listing.interest_count} مهتمين</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Clock size={13} color={Colors.neutral[400]} />
              <Text style={styles.statText}>{timeAgo(listing.created_at)}</Text>
            </View>
          </View>

          {/* Countdown for reserved_temp */}
          {(isTempReserved || isConfirmedReserved) && listing.reserved_until && (
            <View style={styles.countdownBanner}>
              <Clock size={14} color={Colors.accent[700]} />
              <Text style={styles.countdownBannerText}>{countdownText(listing.reserved_until)}</Text>
            </View>
          )}

          {listing.description ? <Text style={styles.description}>{listing.description}</Text> : null}
        </View>

        {/* Location */}
        {listing.city ? (
          <View style={styles.infoRow}>
            <MapPin size={16} color={Colors.primary[500]} />
            <Text style={styles.infoText}>{listing.city}</Text>
          </View>
        ) : null}

        {/* Owner card */}
        {owner && (
          <View style={styles.ownerCard}>
            <View style={styles.ownerInfo}>
              <View style={styles.ownerAvatar}>
                {owner.avatar_url
                  ? <Image source={{ uri: owner.avatar_url }} style={styles.avatarImg} />
                  : <User size={22} color={Colors.neutral[400]} />
                }
              </View>
              <View style={styles.ownerText}>
                <View style={styles.ownerNameRow}>
                  <Text style={styles.ownerName}>{owner.full_name}</Text>
                  {owner.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <ShieldCheck size={11} color={Colors.white} />
                      <Text style={styles.verifiedText}>موثوق</Text>
                    </View>
                  )}
                  {owner.phone_verified && (
                    <View style={styles.phoneVerifiedBadge}>
                      <Text style={styles.phoneVerifiedText}>رقم موثق</Text>
                    </View>
                  )}
                </View>
                <View style={styles.ownerMeta}>
                  {owner.rating > 0 && (
                    <View style={styles.ratingRow}>
                      <Star size={12} color={Colors.accent[500]} fill={Colors.accent[500]} />
                      <Text style={styles.ratingText}>{owner.rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <Text style={styles.ownerListings}>{owner.listings_count} إعلان</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Delivery method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>طريقة التسليم</Text>
          <View style={styles.deliveryCard}>
            {listing.delivery_method === 'pickup' && (
              <View style={styles.deliveryRow}><User size={18} color={Colors.primary[600]} /><Text style={styles.deliveryText}>استلام شخصي</Text></View>
            )}
            {listing.delivery_method === 'delivery_agent' && (
              <View style={styles.deliveryRow}><Truck size={18} color={Colors.primary[600]} /><Text style={styles.deliveryText}>عبر مندوب توصيل</Text></View>
            )}
            {listing.delivery_method === 'direct_contact' && (
              <View style={styles.deliveryRow}><MessageCircle size={18} color={Colors.primary[600]} /><Text style={styles.deliveryText}>تواصل مباشر</Text></View>
            )}
          </View>
        </View>

        {/* ─── NON-OWNER CTAs ─── */}
        {!isOwner && !isTaken && (
          <View style={styles.section}>
            {/* My active reservation status */}
            {myReservation && (
              <View style={[styles.myResBanner, myReservation.status === 'confirmed' && styles.myResBannerConfirmed]}>
                <View style={styles.myResRow}>
                  <Check size={16} color={Colors.white} />
                  <Text style={styles.myResText}>
                    {myReservation.status === 'confirmed'
                      ? 'قُبل حجزك! يمكنك التواصل الآن'
                      : 'طلب الحجز بانتظار موافقة صاحب الإعلان'}
                  </Text>
                </View>
                {myReservation.status !== 'confirmed' && (
                  <Text style={styles.myResCountdown}>{countdownText(myReservation.expires_at)}</Text>
                )}
              </View>
            )}

            {/* Chat (only after confirmed reservation or accepted barter offer) */}
            {myChatRoomId && (
              <TouchableOpacity style={styles.chatEntryBtn} onPress={() => router.push(`/chat?room=${myChatRoomId}`)}>
                <MessageSquare size={20} color={Colors.white} />
                <Text style={styles.chatEntryText}>فتح المحادثة</Text>
              </TouchableOpacity>
            )}

            {/* WhatsApp — respects owner privacy setting */}
            {canWhatsApp && (
              <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp} activeOpacity={0.8}>
                <Phone size={18} color={Colors.white} />
                <Text style={styles.whatsappBtnText}>تواصل عبر واتساب</Text>
              </TouchableOpacity>
            )}

            {/* Delivery request */}
            {listing.delivery_method === 'delivery_agent' && (
              <>
                <TouchableOpacity style={styles.deliveryBtn} onPress={() => setShowDeliveryForm(!showDeliveryForm)} activeOpacity={0.7}>
                  <Truck size={18} color={Colors.white} />
                  <Text style={styles.deliveryBtnText}>طلب مندوب توصيل</Text>
                </TouchableOpacity>
                {showDeliveryForm && (
                  <View style={styles.deliveryForm}>
                    <Text style={styles.formTitle}>بيانات طلب التوصيل</Text>
                    <Text style={styles.formLabel}>عنوان الاستلام</Text>
                    <TextInput style={styles.formInput} placeholder="أدخل عنوان الاستلام" placeholderTextColor={Colors.neutral[400]} value={pickupAddress} onChangeText={setPickupAddress} textAlign="right" />
                    <Text style={styles.formLabel}>عنوان التسليم</Text>
                    <TextInput style={styles.formInput} placeholder="أدخل عنوان التسليم" placeholderTextColor={Colors.neutral[400]} value={dropoffAddress} onChangeText={setDropoffAddress} textAlign="right" />
                    <TouchableOpacity style={styles.submitDeliveryBtn} onPress={requestDelivery} disabled={submitting} activeOpacity={0.7}>
                      {submitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitDeliveryText}>إرسال الطلب</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ─── OWNER CONTROLS ─── */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>أدوات المالك</Text>

            {/* Pending reservations */}
            {reservations.length > 0 && (
              <View style={styles.resSection}>
                <Text style={styles.resSectionTitle}>طلبات الحجز ({reservations.length})</Text>
                {reservations.map((res) => (
                  <View key={res.id} style={styles.resCard}>
                    <View style={styles.resCardHeader}>
                      <Text style={styles.resCardTime}>{timeAgo(res.created_at)}</Text>
                      <Text style={styles.resCardStatus}>
                        {res.status === 'confirmed' ? 'مقبول ✓' : 'بانتظار الموافقة'}
                      </Text>
                    </View>
                    <Text style={styles.resCardCountdown}>{countdownText(res.expires_at)}</Text>
                    {res.status === 'pending' && (
                      <View style={styles.resActions}>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleApproveReservation(res.id)}>
                          <Check size={15} color={Colors.white} />
                          <Text style={styles.acceptBtnText}>قبول الحجز</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectReservation(res.id)}>
                          <X size={15} color={Colors.white} />
                          <Text style={styles.rejectBtnText}>رفض الحجز</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {res.status === 'confirmed' && myChatRoomId && (
                      <TouchableOpacity style={styles.chatEntryBtn} onPress={() => router.push(`/chat?room=${myChatRoomId}`)}>
                        <MessageSquare size={16} color={Colors.white} />
                        <Text style={styles.chatEntryText}>فتح المحادثة</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Confirm taken */}
            {!isTaken && (
              <TouchableOpacity style={styles.confirmTakenBtn} onPress={handleConfirmTaken} activeOpacity={0.8}>
                <Check size={18} color={Colors.white} />
                <Text style={styles.confirmTakenText}>تأكيد أنه تم أخذه</Text>
              </TouchableOpacity>
            )}

            {/* Monetization placeholder (disabled) */}
            <View style={styles.monoPlaceholderRow}>
              <View style={styles.monoPlaceholder}>
                <Zap size={14} color={Colors.neutral[400]} />
                <Text style={styles.monoPlaceholderText}>تمييز الإعلان — قريبًا</Text>
              </View>
              <View style={styles.monoPlaceholder}>
                <Zap size={14} color={Colors.neutral[400]} />
                <Text style={styles.monoPlaceholderText}>رفع الإعلان — قريبًا</Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── BARTER OFFERS (owner view) ─── */}
        {isOwner && offers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>عروض التبديل ({offers.length})</Text>
            {offers.map((offer) => (
              <View key={offer.id} style={styles.offerCard}>
                {offer.offer_image_url ? <Image source={{ uri: offer.offer_image_url }} style={styles.offerImg} /> : null}
                <Text style={styles.offerDesc} numberOfLines={3}>{offer.offer_description}</Text>
                <Text style={styles.offerTime}>{timeAgo(offer.created_at)}</Text>
                {offer.status === 'pending' ? (
                  <View style={styles.offerActions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleBarterOfferAction(offer.id, 'accepted')}>
                      <Check size={15} color={Colors.white} /><Text style={styles.acceptBtnText}>قبول</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleBarterOfferAction(offer.id, 'rejected')}>
                      <X size={15} color={Colors.white} /><Text style={styles.rejectBtnText}>رفض</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.offerStatusBadge, offer.status === 'accepted' ? styles.offerAccepted : styles.offerRejected]}>
                    <Text style={styles.offerStatusText}>{offer.status === 'accepted' ? 'تم القبول' : 'تم الرفض'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {listing.phone ? (
          <View style={styles.phoneSection}>
            <Phone size={14} color={Colors.primary[500]} />
            <Text style={styles.phoneText}>{listing.phone}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} animationType="slide" transparent onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}><X size={22} color={Colors.text} /></TouchableOpacity>
              <Text style={styles.modalTitle}>إبلاغ عن الإعلان</Text>
              <View style={{ width: 22 }} />
            </View>
            <Text style={styles.reportLabel}>سبب الإبلاغ</Text>
            <TextInput style={styles.reportInput} placeholder="اكتب سبب الإبلاغ..." placeholderTextColor={Colors.neutral[400]} value={reportReason} onChangeText={setReportReason} multiline numberOfLines={3} textAlign="right" textAlignVertical="top" />
            <TouchableOpacity style={[styles.reportSubmitBtn, reportSubmitting && { opacity: 0.6 }]} onPress={submitReport} disabled={reportSubmitting}>
              {reportSubmitting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.reportSubmitText}>إرسال البلاغ</Text>}
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
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navBtn: { padding: 4 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  notFound: { fontSize: FontSizes.lg, color: Colors.textSecondary },
  scroll: { flex: 1 },

  heroWrapper: { position: 'relative' },
  heroImage: { width: '100%', height: 260, resizeMode: 'cover' },
  heroPlaceholder: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center' },
  heroFree: { backgroundColor: '#059669' },
  heroExchange: { backgroundColor: '#2563eb' },
  urgentOverlay: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700' },
  premiumOverlay: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent[500], paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  premiumText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700' },

  section: { padding: Spacing.lg, gap: Spacing.md },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  typeBadgeExchange: { backgroundColor: '#2563eb' },
  typeBadgeFree: { backgroundColor: '#059669' },
  typeBadgeText: { color: Colors.white, fontSize: FontSizes.sm, fontWeight: '700' },
  dualBadge: { backgroundColor: Colors.primary[600], paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  dualBadgeText: { color: Colors.white, fontSize: FontSizes.xs, fontWeight: '700' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary[50], paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  catBadgeText: { fontSize: FontSizes.sm, color: Colors.primary[700], fontWeight: '600' },
  title: { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.text, textAlign: 'right', lineHeight: 30 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'flex-end', flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: FontSizes.xs, color: Colors.neutral[400] },
  countdownBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent[50], borderWidth: 1, borderColor: Colors.accent[400],
    borderRadius: BorderRadius.md, padding: Spacing.md, justifyContent: 'flex-end',
  },
  countdownBannerText: { fontSize: FontSizes.md, color: Colors.accent[700], fontWeight: '700' },
  description: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'right', lineHeight: 26 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  infoText: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '600' },

  ownerCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  ownerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  ownerText: { flex: 1, alignItems: 'flex-end' },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  ownerName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primary[600], paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  verifiedText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  phoneVerifiedBadge: { backgroundColor: '#0891b2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  phoneVerifiedText: { fontSize: 10, color: Colors.white, fontWeight: '700' },
  ownerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600' },
  ownerListings: { fontSize: FontSizes.xs, color: Colors.textSecondary },

  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  deliveryCard: { backgroundColor: Colors.primary[50], borderRadius: BorderRadius.md, padding: Spacing.md },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  deliveryText: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '600' },

  // Non-owner CTAs
  myResBanner: {
    backgroundColor: Colors.accent[500], borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4,
  },
  myResBannerConfirmed: { backgroundColor: Colors.primary[600] },
  myResRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  myResText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700', textAlign: 'right', flex: 1 },
  myResCountdown: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.85)', textAlign: 'right' },

  chatEntryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: '#2563eb',
    borderRadius: BorderRadius.md, paddingVertical: 13,
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  chatEntryText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },

  whatsappBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, paddingVertical: 13,
    shadowColor: '#25D366', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  whatsappBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },

  deliveryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primary[600],
    borderRadius: BorderRadius.md, paddingVertical: 13,
  },
  deliveryBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
  deliveryForm: {
    gap: Spacing.md, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  formTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  formLabel: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary, textAlign: 'right' },
  formInput: {
    backgroundColor: Colors.neutral[50], borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSizes.md, color: Colors.text, textAlign: 'right',
  },
  submitDeliveryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primary[700],
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md,
  },
  submitDeliveryText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },

  // Owner controls
  resSection: { gap: Spacing.sm },
  resSectionTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  resCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  resCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resCardTime: { fontSize: FontSizes.xs, color: Colors.neutral[400] },
  resCardStatus: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  resCardCountdown: { fontSize: FontSizes.sm, color: Colors.accent[600], fontWeight: '600', textAlign: 'right' },
  resActions: { flexDirection: 'row', gap: Spacing.md },
  acceptBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md, paddingVertical: 9,
  },
  acceptBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },
  rejectBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 4, backgroundColor: Colors.error[500], borderRadius: BorderRadius.md, paddingVertical: 9,
  },
  rejectBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSizes.sm },

  confirmTakenBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primary[700],
    borderRadius: BorderRadius.md, paddingVertical: 13,
  },
  confirmTakenText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },

  monoPlaceholderRow: { flexDirection: 'row', gap: Spacing.md },
  monoPlaceholder: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.neutral[100], borderRadius: BorderRadius.md,
    paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  monoPlaceholderText: { fontSize: FontSizes.xs, color: Colors.neutral[400], fontWeight: '600' },

  // Barter offers
  offerCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  offerImg: { width: '100%', height: 100, borderRadius: BorderRadius.sm, resizeMode: 'cover' },
  offerDesc: { fontSize: FontSizes.md, color: Colors.text, textAlign: 'right' },
  offerTime: { fontSize: FontSizes.xs, color: Colors.neutral[400], textAlign: 'right' },
  offerActions: { flexDirection: 'row', gap: Spacing.md },
  offerStatusBadge: { alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  offerAccepted: { backgroundColor: Colors.primary[100] },
  offerRejected: { backgroundColor: Colors.error[100] },
  offerStatusText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.text },

  phoneSection: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  phoneText: { fontSize: FontSizes.md, color: Colors.primary[600], fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  reportLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right', marginBottom: Spacing.xs },
  reportInput: {
    backgroundColor: Colors.neutral[50], borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    fontSize: FontSizes.md, color: Colors.text, minHeight: 80, textAlign: 'right',
  },
  reportSubmitBtn: {
    backgroundColor: Colors.error[500], borderRadius: BorderRadius.md,
    paddingVertical: 13, alignItems: 'center', marginTop: Spacing.md,
  },
  reportSubmitText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
});
