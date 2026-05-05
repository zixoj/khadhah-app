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
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
  const { colors, isDark } = useTheme();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    if (selectedCategory) query = query.eq('category', selectedCategory);
    const { data } = await query;
    if (data) setListings(data);
    setLoading(false);
    setRefreshing(false);
  }, [selectedCategory]);

  useEffect(() => { setLoading(true); fetchListings(); }, [fetchListings]);

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

  const onRefresh = () => { setRefreshing(true); fetchListings(); };

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
    if (!result.canceled && result.assets[0]) setOfferImageUri(result.assets[0].uri);
  };

  const submitOffer = async () => {
    if (!profile || !selectedListing) return;
    if (!offerDesc.trim()) { Alert.alert('خطأ', 'الرجاء كتابة وصف موجز لما تعرض تبديله'); return; }
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
      listing_id: selectedListing.id, offerer_id: profile.id,
      offer_description: offerDesc.trim(), offer_image_url: imageUrl, status: 'pending',
    });
    setSubmittingOffer(false);
    if (error) Alert.alert('خطأ', error.message);
    else { setOfferedIds((prev) => new Set([...prev, selectedListing.id])); setOfferSuccess(true); }
  };

  const renderItem = ({ item }: { item: Listing }) => {
    const isMyListing = profile?.id === item.user_id;
    const hasOffered = offeredIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.postCard, {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.cardBorder : '#E8EDF2',
          shadowColor: isDark ? colors.exchange : '#000',
        }]}
        onPress={() => router.push(`/post-detail?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.imageWrapper}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          ) : (
            <View style={[styles.postImagePlaceholder, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF' }]}>
              <ArrowLeftRight size={28} color={colors.exchange} />
            </View>
          )}
          {item.is_urgent && (
            <View style={styles.urgentBadge}>
              <Flame size={9} color="#fff" />
              <Text style={styles.urgentText}>مستعجل</Text>
            </View>
          )}
        </View>

        <View style={styles.postBody}>
          <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>

          {item.category ? (
            <View style={[styles.catBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF' }]}>
              <Text style={[styles.catBadgeText, { color: colors.exchange }]}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
            </View>
          ) : null}

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
              <Users size={11} color={colors.exchange} />
              <Text style={[styles.interestText, { color: colors.exchange }]}>{item.interest_count} عروض</Text>
            </View>
          )}

          {!isMyListing && (
            <TouchableOpacity
              style={[styles.offerBtn, {
                backgroundColor: hasOffered
                  ? (isDark ? 'rgba(0,200,83,0.12)' : colors.primary)
                  : colors.exchange,
                borderColor: hasOffered ? colors.primary : 'transparent',
                borderWidth: hasOffered && isDark ? 1 : 0,
              }]}
              onPress={() => !hasOffered && openOfferModal(item)}
              activeOpacity={0.8}
            >
              {hasOffered ? (
                <View style={styles.btnInner}>
                  <Check size={13} color={isDark ? colors.primary : '#fff'} />
                  <Text style={[styles.offerBtnText, { color: isDark ? colors.primary : '#fff' }]}>تم الإرسال</Text>
                </View>
              ) : (
                <Text style={[styles.offerBtnText, { color: '#fff' }]}>اعرض تبديل</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: isDark ? colors.cardBorder : '#E8EDF2', borderBottomWidth: 1 }]}>
        <View style={styles.headerContent}>
          <ArrowLeftRight size={22} color={colors.exchange} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>بدّل</Text>
        </View>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>اعرض تبديل وتفاوض مباشرة</Text>
      </View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, {
                backgroundColor: !selectedCategory ? colors.exchange : (isDark ? colors.card : '#fff'),
                borderColor: !selectedCategory ? colors.exchange : (isDark ? colors.cardBorder : '#E0E8EF'),
              }]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, { color: !selectedCategory ? '#fff' : colors.textSecondary }]}>الكل</Text>
            </TouchableOpacity>
            {CATEGORIES.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.filterChip, {
                  backgroundColor: selectedCategory === value ? colors.exchange : (isDark ? colors.card : '#fff'),
                  borderColor: selectedCategory === value ? colors.exchange : (isDark ? colors.cardBorder : '#E0E8EF'),
                }]}
                onPress={() => setSelectedCategory(value)}
              >
                <Text style={[styles.filterChipText, { color: selectedCategory === value ? '#fff' : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.exchange} />
            </View>
          ) : (
            <View style={styles.centerContent}>
              <ArrowLeftRight size={48} color={isDark ? 'rgba(255,255,255,0.1)' : '#E0E8EF'} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد إعلانات تبديل حالياً</Text>
            </View>
          )
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.exchange} colors={[colors.exchange]} />
        }
      />

      {profile && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.exchange, shadowColor: colors.exchange }]}
          onPress={() => router.push('/add-post?type=exchange')}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
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
      <Modal visible={offerModalVisible} animationType="slide" transparent onRequestClose={() => setOfferModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderTopColor: isDark ? colors.cardBorder : '#E8EDF2' }]}>
            <View style={[styles.modalHandle, { backgroundColor: isDark ? colors.border : '#E0E8EF' }]} />
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? colors.border : '#E8EDF2' }]}>
              <TouchableOpacity onPress={() => setOfferModalVisible(false)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>اعرض تبديل</Text>
              <View style={{ width: 22 }} />
            </View>

            {offerSuccess ? (
              <View style={styles.successState}>
                <View style={[styles.successCircle, { backgroundColor: isDark ? 'rgba(0,200,83,0.14)' : colors.primary, borderColor: isDark ? colors.primary : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
                  <Check size={32} color={isDark ? colors.primary : '#fff'} />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>تم إرسال عرضك!</Text>
                <Text style={[styles.successSub, { color: colors.textSecondary }]}>سيتواصل معك صاحب الإعلان إذا أعجبه العرض</Text>
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setOfferModalVisible(false)}
                >
                  <Text style={[styles.doneBtnText, { color: '#000' }]}>حسناً</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                {selectedListing && (
                  <View style={[styles.targetCard, { backgroundColor: isDark ? colors.card : '#F4F7FA', borderColor: isDark ? colors.cardBorder : '#E8EDF2' }]}>
                    <Text style={[styles.targetLabel, { color: colors.textSecondary }]}>تريد تبديل ماذا مقابل:</Text>
                    <Text style={[styles.targetTitle, { color: colors.text }]} numberOfLines={2}>{selectedListing.title}</Text>
                  </View>
                )}
                <Text style={[styles.fieldLabel, { color: colors.text }]}>ما الذي تعرضه للتبديل؟</Text>
                <TextInput
                  style={[styles.descInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="اكتب وصفاً موجزاً لما تعرضه..."
                  placeholderTextColor={colors.textMuted}
                  value={offerDesc}
                  onChangeText={setOfferDesc}
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                  textAlignVertical="top"
                />
                <Text style={[styles.fieldLabel, { color: colors.text }]}>صورة (اختياري)</Text>
                {offerImageUri ? (
                  <View style={styles.imgPreviewWrap}>
                    <Image source={{ uri: offerImageUri }} style={styles.imgPreview} />
                    <TouchableOpacity style={styles.removeImg} onPress={() => setOfferImageUri(null)}>
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.imgPickBtn, { backgroundColor: colors.input, borderColor: colors.inputBorder }]} onPress={pickOfferImage}>
                    <Camera size={24} color={colors.textSecondary} />
                    <Text style={[styles.imgPickText, { color: colors.textSecondary }]}>أضف صورة</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.submitOfferBtn, {
                    backgroundColor: colors.exchange,
                    opacity: submittingOffer ? 0.6 : 1,
                  }]}
                  onPress={submitOffer}
                  disabled={submittingOffer}
                  activeOpacity={0.8}
                >
                  {submittingOffer
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={[styles.submitOfferText, { color: '#fff' }]}>إرسال العرض</Text>
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
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full, borderWidth: 1 },
  filterChipText: { fontSize: FontSizes.sm, fontWeight: '600' },

  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingVertical: 80 },
  emptyText: { fontSize: FontSizes.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  row: { gap: Spacing.md, marginBottom: Spacing.md },

  postCard: {
    flex: 1, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  imageWrapper: { position: 'relative' },
  postImage: { width: '100%', height: 110, resizeMode: 'cover' },
  postImagePlaceholder: { width: '100%', height: 110, justifyContent: 'center', alignItems: 'center' },
  urgentBadge: {
    position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 3, borderRadius: BorderRadius.full,
  },
  urgentText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  postBody: { padding: 10, gap: 6 },
  postTitle: { fontSize: FontSizes.sm, fontWeight: '700', textAlign: 'right', lineHeight: 18 },
  catBadge: { alignSelf: 'flex-end', paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10 },
  interestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  interestText: { fontSize: 10, fontWeight: '600' },

  offerBtn: { borderRadius: BorderRadius.md, paddingVertical: 9, alignItems: 'center', marginTop: 2 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerBtnText: { fontSize: FontSizes.sm, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.lg,
    width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.sm,
    maxHeight: '90%', borderTopWidth: 1,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  targetCard: {
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1,
  },
  targetLabel: { fontSize: FontSizes.xs, textAlign: 'right', marginBottom: 4 },
  targetTitle: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  fieldLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.xs, marginTop: Spacing.sm },
  descInput: {
    borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md,
    fontSize: FontSizes.md, minHeight: 90, textAlign: 'right',
  },
  imgPickBtn: {
    height: 100, borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md,
  },
  imgPickText: { fontSize: FontSizes.sm },
  imgPreviewWrap: { position: 'relative', marginBottom: Spacing.md },
  imgPreview: { width: '100%', height: 120, borderRadius: BorderRadius.md, resizeMode: 'cover' },
  removeImg: {
    position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
  },
  submitOfferBtn: { borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md },
  submitOfferText: { fontSize: FontSizes.lg, fontWeight: '700' },
  successState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: '700' },
  successSub: { fontSize: FontSizes.md, textAlign: 'center' },
  doneBtn: { borderRadius: BorderRadius.md, paddingVertical: 12, paddingHorizontal: Spacing.xl, marginTop: Spacing.sm },
  doneBtnText: { fontSize: FontSizes.md, fontWeight: '700' },
});
