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

const DELIVERY_OPTIONS = [
  { value: 'pickup',         label: 'استلام شخصي',  icon: User },
  { value: 'delivery_agent', label: 'مندوب توصيل',  icon: Truck },
  { value: 'direct_contact', label: 'تواصل مباشر',  icon: MessageCircle },
] as const;

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
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('direct_contact');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [dualMode, setDualMode] = useState(false);

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

    const { error: insertError } = await supabase
      .from('listings')
      .insert({
        user_id: profile!.id,
        title: title.trim(),
        description: description.trim(),
        category,
        type: postType,
        city,
        phone: phone.trim(),
        delivery_method: deliveryMethod,
        image_url: finalImageUrl,
        is_urgent: isUrgent,
        urgent_until: urgentUntil,
        dual_mode: dualMode,
        status: 'available',
      });

    setLoading(false);

    if (insertError) {
      setError(insertError.message || 'حدث خطأ أثناء النشر');
      return;
    }

    Alert.alert('تم بنجاح', 'تم نشر إعلانك بنجاح', [
      { text: 'حسناً', onPress: () => router.back() },
    ]);
  };

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

        {/* طريقة التسليم */}
        <Text style={styles.fieldLabel}>طريقة التسليم</Text>
        <View style={styles.deliveryList}>
          {DELIVERY_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = deliveryMethod === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.deliveryOption, active && styles.deliveryOptionActive]}
                onPress={() => setDeliveryMethod(value)}
                activeOpacity={0.7}
              >
                <View style={styles.deliveryOptionLeft}>
                  {active && <Check size={16} color={Colors.primary[600]} />}
                </View>
                <View style={styles.deliveryOptionRight}>
                  <Icon size={18} color={active ? Colors.primary[600] : Colors.neutral[500]} />
                  <Text style={[styles.deliveryOptionText, active && styles.deliveryOptionTextActive]}>{label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

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
  deliveryList: { gap: Spacing.sm },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  deliveryOptionActive: { borderColor: Colors.primary[600], backgroundColor: Colors.primary[50] },
  deliveryOptionLeft: { width: 20, alignItems: 'center' },
  deliveryOptionRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  deliveryOptionText: { fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'right' },
  deliveryOptionTextActive: { color: Colors.primary[700], fontWeight: '600' },
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
});
