import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ArrowLeftRight, Plus, MapPin, Flame, Clock, Camera, X, Check, Users } from 'lucide-react-native';
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

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(({ label, value }) => [value, label])
);

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

export default function ExchangeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [offerDesc, setOfferDesc] = useState('');
  const [offerImageUri, setOfferImageUri] = useState<string | null>(null);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [offeredIds, setOfferedIds] = useState<Set<string>>(new Set());
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [pendingOfferListing, setPendingOfferListing] = useState<Listing | null>(null);

  const fetchListings = useCallback(async () => {
    let query = supabase
      .from('listings')
      .select('*')
      .or('type.eq.exchange,dual_mode.eq.true')
      .neq('status', 'taken')
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });

    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }

    const { data } = await query;
    if (data) setListings(data);
    setLoading(false);
    setRefreshing(false);
  }, [selectedCategory]);

  useEffect(() => {
    setLoading(true);
    fetchListings();
  }, [fetchListings]);

  // Load user's existing offers
  useEffect(() => {
    if (!profile) return;
    supabase
      .from('barter_offers')
      .select('listing_id')
      .eq('offerer_id', profile.id)
      .then(({ data }) => {
        if (data) setOfferedIds(new Set(data.map((r) => r.listing_id)));
      });
  }, [profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const openOfferModal = (item: Listing) => {
    if (!profile?.phone_verified) {
      setPendingOfferListing(item);
      setPhoneModalVisible(true);
      return;
    }
    setSelectedListing(item);
    setOfferDesc('');
    setOfferImageUri(null);
    setOfferSuccess(false);
    setOfferModalVisible(true);
  };

  const pickOfferImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setOfferImageUri(result.assets[0].uri);
    }
  };

  const submitOffer = async () => {
    if (!profile || !selectedListing) return;
    if (!offerDesc.trim()) {
      Alert.alert('خطأ', 'الرجاء كتابة وصف موجز لما تعرض تبديله');
      return;
    }

    setSubmittingOffer(true);
    let imageUrl = '';

    if (offerImageUri) {
      try {
        const filename = `${profile.id}/offer-${Date.now()}.jpg`;
        const resp = await fetch(offerImageUri);
        const blob = await resp.blob();
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('listing-images')
          .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(uploadData.path);
          imageUrl = urlData.publicUrl;
        }
      } catch (_) {}
    }

    const { error } = await supabase.from('barter_offers').insert({
      listing_id: selectedListing.id,
      offerer_id: profile.id,
      offer_description: offerDesc.trim(),
      offer_image_url: imageUrl,
      status: 'pending',
    });

    setSubmittingOffer(false);

    if (error) {
      Alert.alert('خطأ', error.message);
    } else {
      setOfferedIds((prev) => new Set([...prev, selectedListing.id]));
      setOfferSuccess(true);
    }
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const isMyListing = profile?.id === item.user_id;
    const hasOffered = offeredIds.has(item.id);

    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          ) : (
            <View style={styles.postImagePlaceholder}>
              <ArrowLeftRight size={28} color="#2563eb" />
            </View>
          )}
          {item.is_urgent && (
            <View style={styles.urgentBadge}>
              <Flame size={10} color={Colors.white} />
              <Text style={styles.urgentText}>مستعجل</Text>
            </View>
          )}
        </View>

        <View style={styles.postBody}>
          <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>

          {item.category ? (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
            </View>
          ) : null}

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
              <Users size={12} color="#2563eb" />
              <Text style={styles.interestText}>{item.interest_count} عروض</Text>
            </View>
          )}

          {!isMyListing && (
            <TouchableOpacity
              style={[styles.offerBtn, hasOffered && styles.offerBtnDone]}
              onPress={() => !hasOffered && openOfferModal(item)}
              activeOpacity={0.8}
            >
              {hasOffered ? (
                <View style={styles.btnInner}>
                  <Check size={14} color={Colors.white} />
                  <Text style={styles.offerBtnText}>تم الإرسال</Text>
                </View>
              ) : (
                <Text style={styles.offerBtnText}>اعرض تبديل</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ArrowLeftRight size={22} color={Colors.white} />
          <Text style={styles.headerTitle}>بدّل</Text>
        </View>
        <Text style={styles.headerSub}>اعرض تبديل وتفاوض مباشرة</Text>
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
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <View style={styles.centerContent}>
              <ArrowLeftRight size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyText}>لا توجد إعلانات تبديل حالياً</Text>
            </View>
          )
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      />

      {profile && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-post?type=exchange')}
          activeOpacity={0.8}
        >
          <Plus size={28} color={Colors.white} />
        </TouchableOpacity>
      )}

      <PhoneVerifyModal
        visible={phoneModalVisible}
        currentPhone={profile?.phone ?? ''}
        onClose={() => { setPhoneModalVisible(false); setPendingOfferListing(null); }}
        onVerified={() => {
          setPhoneModalVisible(false);
          if (pendingOfferListing) {
            setSelectedListing(pendingOfferListing);
            setOfferDesc('');
            setOfferImageUri(null);
            setOfferSuccess(false);
            setOfferModalVisible(true);
            setPendingOfferListing(null);
          }
        }}
      />

      {/* Offer Modal */}
      <Modal
        visible={offerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <X size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>اعرض تبديل</Text>
              <View style={{ width: 22 }} />
            </View>

            {offerSuccess ? (
              <View style={styles.successState}>
                <View style={styles.successCircle}>
                  <Check size={32} color={Colors.white} />
                </View>
                <Text style={styles.successTitle}>تم إرسال عرضك!</Text>
                <Text style={styles.successSub}>سيتواصل معك صاحب الإعلان إذا أعجبه العرض</Text>
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setOfferModalVisible(false)}
                >
                  <Text style={styles.doneBtnText}>حسناً</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                {selectedListing && (
                  <View style={styles.targetCard}>
                    <Text style={styles.targetLabel}>تريد تبديل ماذا مقابل:</Text>
                    <Text style={styles.targetTitle} numberOfLines={2}>{selectedListing.title}</Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>ما الذي تعرضه للتبديل؟</Text>
                <TextInput
                  style={styles.descInput}
                  placeholder="اكتب وصفاً موجزاً لما تعرضه..."
                  placeholderTextColor={Colors.neutral[400]}
                  value={offerDesc}
                  onChangeText={setOfferDesc}
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                  textAlignVertical="top"
                />

                <Text style={styles.fieldLabel}>صورة (اختياري)</Text>
                {offerImageUri ? (
                  <View style={styles.imgPreviewWrap}>
                    <Image source={{ uri: offerImageUri }} style={styles.imgPreview} />
                    <TouchableOpacity style={styles.removeImg} onPress={() => setOfferImageUri(null)}>
                      <X size={14} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.imgPickBtn} onPress={pickOfferImage}>
                    <Camera size={24} color={Colors.neutral[400]} />
                    <Text style={styles.imgPickText}>أضف صورة</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.submitOfferBtn, submittingOffer && { opacity: 0.6 }]}
                  onPress={submitOffer}
                  disabled={submittingOffer}
                  activeOpacity={0.8}
                >
                  {submittingOffer
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.submitOfferText}>إرسال العرض</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: Spacing.lg,
    paddingTop: 48,
    paddingBottom: Spacing.lg,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'flex-end' },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.75)', textAlign: 'right', marginTop: 4 },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontWeight: '700' },

  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },

  postCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  imageWrapper: { position: 'relative' },
  postImage: { width: '100%', height: 110, resizeMode: 'cover' },
  postImagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 10, color: Colors.white, fontWeight: '700' },

  postBody: { padding: Spacing.sm + 2, gap: 6 },
  postTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    lineHeight: 18,
  },
  catBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  catBadgeText: { fontSize: 10, color: '#1d4ed8', fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10, color: Colors.neutral[400] },
  interestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  interestText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },

  offerBtn: {
    backgroundColor: '#2563eb',
    borderRadius: BorderRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  offerBtnDone: { backgroundColor: Colors.primary[600] },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerBtnText: { fontSize: FontSizes.sm, color: Colors.white, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },

  targetCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  targetLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right', marginBottom: 4 },
  targetTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },

  fieldLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  descInput: {
    backgroundColor: Colors.neutral[50],
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    minHeight: 90,
    textAlign: 'right',
  },
  imgPickBtn: {
    height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neutral[50],
    marginBottom: Spacing.md,
  },
  imgPickText: { fontSize: FontSizes.sm, color: Colors.neutral[500] },
  imgPreviewWrap: { position: 'relative', marginBottom: Spacing.md },
  imgPreview: { width: '100%', height: 120, borderRadius: BorderRadius.md, resizeMode: 'cover' },
  removeImg: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.error[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitOfferBtn: {
    backgroundColor: '#2563eb',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.md,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitOfferText: { fontSize: FontSizes.lg, color: Colors.white, fontWeight: '700' },

  successState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text },
  successSub: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center' },
  doneBtn: {
    backgroundColor: Colors.primary[600],
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  doneBtnText: { fontSize: FontSizes.md, color: Colors.white, fontWeight: '700' },
});
