import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft,
  Camera,
  MapPin,
  Check,
  Truck,
  User,
  MessageCircle,
  ArrowLeftRight,
  Gift,
  X,
  PawPrint,
  Flame,
} from 'lucide-react-native';

const CITIES = [
  'الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام',
  'الخبر', 'الظهران', 'تبوك', 'أبها', 'الطائف',
  'بريدة', 'نجران', 'حائل', 'ينبع', 'الجبيل',
];

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

type PostType = 'exchange' | 'free';
type DeliveryMethod = 'pickup' | 'delivery_agent' | 'direct_contact';

export default function AddPostScreen() {
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type: string }>();
  const { profile } = useAuth();

  const [postType, setPostType] = useState<PostType>(
    typeParam === 'free' ? 'free' : 'exchange'
  );
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extra toggles
  const [isUrgent, setIsUrgent] = useState(false);
  const [dualMode, setDualMode] = useState(false);

  // Post-submission state
  const [submitted, setSubmitted] = useState(false);
  const [createdListingId, setCreatedListingId] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى الصور');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const permitted = await requestPermission();
    if (!permitted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const filename = `${profile!.id}/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();

    const { data, error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('listing-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('الرجاء إدخال عنوان الإعلان'); return; }
    if (!category) { setError('الرجاء اختيار التصنيف'); return; }
    if (!city) { setError('الرجاء اختيار المدينة'); return; }
    if (!phone.trim()) { setError('الرجاء إدخال رقم الهاتف'); return; }

    setLoading(true);
    setError(null);

    let finalImageUrl = '';

    if (imageUri) {
      setUploading(true);
      try {
        finalImageUrl = await uploadImage(imageUri);
      } catch (err: any) {
        setError('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف'));
        setLoading(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const urgentUntil = isUrgent
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        user_id: profile!.id,
        title: title.trim(),
        description: description.trim(),
        category,
        type: postType,
        city,
        phone: phone.trim(),
        delivery_method: 'direct_contact',
        image_url: finalImageUrl,
        is_urgent: isUrgent,
        urgent_until: urgentUntil,
        dual_mode: dualMode,
        status: 'available',
      })
      .select()
      .maybeSingle();

    if (insertError || !listing) {
      setError(insertError?.message || 'حدث خطأ أثناء النشر');
      setLoading(false);
      return;
    }

    setCreatedListingId(listing.id);
    setSubmitted(true);
    setLoading(false);
  };

  const handleDeliveryChoice = async (method: DeliveryMethod) => {
    await supabase
      .from('listings')
      .update({ delivery_method: method })
      .eq('id', createdListingId);

    if (method === 'delivery_agent') {
      setShowDeliveryForm(true);
      return;
    }

    const message =
      method === 'pickup'
        ? 'تم نشر إعلانك - سيتم الاستلام شخصياً'
        : 'تم نشر إعلانك - تواصل مباشر مع المهتمين';

    Alert.alert('تم بنجاح', message, [
      { text: 'حسناً', onPress: () => router.back() },
    ]);
  };

  const handleDeliveryFormSubmit = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال عناوين الاستلام والتسليم');
      return;
    }
    await supabase.from('delivery_requests').insert({
      post_id: createdListingId,
      requester_id: profile!.id,
      pickup_address: pickupAddress.trim(),
      dropoff_address: dropoffAddress.trim(),
      status: 'pending',
    });
    Alert.alert('تم بنجاح', 'تم نشر إعلانك وطلب مندوب التوصيل', [
      { text: 'حسناً', onPress: () => router.back() },
    ]);
  };

  if (submitted && showDeliveryForm) {
    return (
      <View style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>طلب مندوب توصيل</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.successCircle}>
            <Check size={32} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>تم نشر الإعلان!</Text>
          <Text style={styles.fieldLabel}>عنوان الاستلام</Text>
          <TextInput
            style={styles.textInput}
            placeholder="أدخل عنوان الاستلام"
            placeholderTextColor={Colors.neutral[400]}
            value={pickupAddress}
            onChangeText={setPickupAddress}
            textAlign="right"
          />
          <Text style={styles.fieldLabel}>عنوان التسليم</Text>
          <TextInput
            style={styles.textInput}
            placeholder="أدخل عنوان التسليم"
            placeholderTextColor={Colors.neutral[400]}
            value={dropoffAddress}
            onChangeText={setDropoffAddress}
            textAlign="right"
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleDeliveryFormSubmit} activeOpacity={0.8}>
            <Text style={styles.submitBtnText}>إرسال طلب المندوب</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successHeader}>
          <View style={styles.successCircle}>
            <Check size={40} color={Colors.white} />
          </View>
          <Text style={styles.successTitle}>تم نشر إعلانك بنجاح!</Text>
          <Text style={styles.successSub}>اختر طريقة التسليم</Text>
        </View>

        <View style={styles.deliverySection}>
          <TouchableOpacity style={styles.deliveryCard} onPress={() => handleDeliveryChoice('pickup')} activeOpacity={0.7}>
            <View style={styles.deliveryIconCircle}>
              <User size={28} color={Colors.primary[600]} />
            </View>
            <View style={styles.deliveryTextBlock}>
              <Text style={styles.deliveryName}>استلام شخصي</Text>
              <Text style={styles.deliveryDesc}>استلم المنتج بنفسك من الموقع</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deliveryCard} onPress={() => handleDeliveryChoice('delivery_agent')} activeOpacity={0.7}>
            <View style={styles.deliveryIconCircle}>
              <Truck size={28} color={Colors.primary[600]} />
            </View>
            <View style={styles.deliveryTextBlock}>
              <Text style={styles.deliveryName}>طلب مندوب</Text>
              <Text style={styles.deliveryDesc}>اطلب مندوب توصيل لاستلام المنتج</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deliveryCard} onPress={() => handleDeliveryChoice('direct_contact')} activeOpacity={0.7}>
            <View style={styles.deliveryIconCircle}>
              <MessageCircle size={28} color={Colors.primary[600]} />
            </View>
            <View style={styles.deliveryTextBlock}>
              <Text style={styles.deliveryName}>تواصل مباشر</Text>
              <Text style={styles.deliveryDesc}>تواصل مع صاحب الإعلان مباشرة</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>إعلان جديد</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* نوع الإعلان */}
        <Text style={styles.fieldLabel}>نوع الإعلان</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, postType === 'exchange' && styles.typeBtnExchange]}
            onPress={() => setPostType('exchange')}
            activeOpacity={0.7}
          >
            <ArrowLeftRight size={20} color={postType === 'exchange' ? Colors.white : '#2563eb'} />
            <Text style={[styles.typeBtnText, postType === 'exchange' && styles.typeBtnTextActive]}>بدّل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, postType === 'free' && styles.typeBtnFree]}
            onPress={() => setPostType('free')}
            activeOpacity={0.7}
          >
            <Gift size={20} color={postType === 'free' ? Colors.white : '#059669'} />
            <Text style={[styles.typeBtnText, postType === 'free' && styles.typeBtnTextActive]}>خذه مجاناً</Text>
          </TouchableOpacity>
        </View>

        {/* Dual mode toggle */}
        <View style={styles.toggleRow}>
          <Switch
            value={dualMode}
            onValueChange={setDualMode}
            trackColor={{ false: Colors.border, true: Colors.primary[400] }}
            thumbColor={dualMode ? Colors.primary[600] : Colors.neutral[300]}
          />
          <View style={styles.toggleTextBlock}>
            <Text style={styles.toggleLabel}>مجاني + قابل للتبديل</Text>
            <Text style={styles.toggleSub}>يظهر في قسمي خذه وبدّل</Text>
          </View>
        </View>

        {/* Urgent toggle */}
        <View style={[styles.toggleRow, styles.toggleRowUrgent]}>
          <Switch
            value={isUrgent}
            onValueChange={setIsUrgent}
            trackColor={{ false: Colors.border, true: '#fca5a5' }}
            thumbColor={isUrgent ? '#ef4444' : Colors.neutral[300]}
          />
          <View style={styles.toggleTextBlock}>
            <View style={styles.urgentLabelRow}>
              <Flame size={14} color="#ef4444" />
              <Text style={[styles.toggleLabel, { color: '#ef4444' }]}>مستعجل</Text>
            </View>
            <Text style={styles.toggleSub}>يُعلَّم بشكل مميز لمدة 24 ساعة</Text>
          </View>
        </View>

        {/* العنوان */}
        <Text style={styles.fieldLabel}>العنوان</Text>
        <TextInput
          style={styles.textInput}
          placeholder="عنوان الإعلان"
          placeholderTextColor={Colors.neutral[400]}
          value={title}
          onChangeText={setTitle}
          textAlign="right"
        />

        {/* الوصف */}
        <Text style={styles.fieldLabel}>الوصف</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="وصف الإعلان"
          placeholderTextColor={Colors.neutral[400]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlign="right"
        />

        {/* التصنيف */}
        <Text style={styles.fieldLabel}>التصنيف</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.catChip, category === value && styles.catChipActive]}
              onPress={() => setCategory(value)}
              activeOpacity={0.7}
            >
              {value === 'animals' && (
                <PawPrint
                  size={13}
                  color={category === value ? Colors.white : Colors.neutral[400]}
                />
              )}
              <Text style={[styles.catChipText, category === value && styles.catChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* المدينة */}
        <Text style={styles.fieldLabel}>المدينة</Text>
        <View style={styles.cityGrid}>
          {CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.cityChip, city === c && styles.cityChipActive]}
              onPress={() => setCity(c)}
              activeOpacity={0.7}
            >
              <MapPin size={12} color={city === c ? Colors.white : Colors.neutral[400]} />
              <Text style={[styles.cityChipText, city === c && styles.cityChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* رقم الهاتف */}
        <Text style={styles.fieldLabel}>رقم الهاتف للتواصل</Text>
        <TextInput
          style={styles.textInput}
          placeholder="05xxxxxxxx"
          placeholderTextColor={Colors.neutral[400]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textAlign="right"
        />

        {/* الصورة */}
        <Text style={styles.fieldLabel}>صورة الإعلان</Text>
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageUri(null)}>
                <X size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addImgBtn} onPress={pickImage} activeOpacity={0.7}>
              <Camera size={32} color={Colors.neutral[400]} />
              <Text style={styles.addImgText}>اضغط لاختيار صورة</Text>
              <Text style={styles.addImgSubText}>من مكتبة الصور</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* زر النشر */}
        <TouchableOpacity
          style={[styles.submitBtn, (loading || uploading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploading}
          activeOpacity={0.8}
        >
          {loading || uploading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.white} />
              <Text style={styles.submitBtnText}>
                {uploading ? 'جاري رفع الصورة...' : 'جاري النشر...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>نشر الإعلان</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  errorBox: {
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[400],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  errorText: { color: Colors.error[600], fontSize: FontSizes.sm, textAlign: 'right' },
  fieldLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right', marginBottom: Spacing.xs },
  typeRow: { flexDirection: 'row', gap: Spacing.md },
  typeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.white,
  },
  typeBtnExchange: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeBtnFree: { backgroundColor: '#059669', borderColor: '#059669' },
  typeBtnText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  typeBtnTextActive: { color: Colors.white },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  toggleRowUrgent: { borderColor: '#fca5a5' },
  toggleTextBlock: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  toggleSub: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  urgentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  textInput: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, fontSize: FontSizes.md, color: Colors.text, textAlign: 'right',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  catChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  catChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  catChipTextActive: { color: Colors.white, fontWeight: '600' },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm - 2,
    borderRadius: BorderRadius.full, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  cityChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  cityChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  cityChipTextActive: { color: Colors.white, fontWeight: '600' },
  imageSection: { alignItems: 'center' },
  imagePreviewWrapper: { position: 'relative', width: '100%' },
  imagePreview: { width: '100%', height: 200, borderRadius: BorderRadius.lg, resizeMode: 'cover' },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.error[500],
    justifyContent: 'center', alignItems: 'center',
  },
  addImgBtn: {
    width: '100%', height: 160, borderRadius: BorderRadius.lg,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.neutral[50],
  },
  addImgText: { fontSize: FontSizes.md, color: Colors.neutral[500], fontWeight: '600' },
  addImgSubText: { fontSize: FontSizes.sm, color: Colors.neutral[400] },
  submitBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md,
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  successHeader: {
    alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl,
    backgroundColor: Colors.primary[50],
    borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl,
  },
  successCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  successTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  successSub: { fontSize: FontSizes.md, color: Colors.textSecondary },
  deliverySection: { padding: Spacing.lg, gap: Spacing.md },
  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: Spacing.md,
  },
  deliveryIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary[50], justifyContent: 'center', alignItems: 'center',
  },
  deliveryTextBlock: { flex: 1, alignItems: 'flex-end' },
  deliveryName: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  deliveryDesc: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
});
