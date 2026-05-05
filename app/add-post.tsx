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
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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

const DELIVERY_OPTIONS = [
  { value: 'pickup', label: 'استلام شخصي', icon: User },
  { value: 'delivery_agent', label: 'مندوب توصيل', icon: Truck },
  { value: 'direct_contact', label: 'تواصل مباشر', icon: MessageCircle },
] as const;

type PostType = 'exchange' | 'free';
type DeliveryMethod = 'pickup' | 'delivery_agent' | 'direct_contact';

export default function AddPostScreen() {
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type: string }>();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const C = colors;

  const [postType, setPostType] = useState<PostType>(typeParam === 'free' ? 'free' : 'exchange');
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
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const filename = `${profile!.id}/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('الرجاء إدخال عنوان الإعلان'); return; }
    if (!category) { setError('الرجاء اختيار التصنيف'); return; }
    if (!city) { setError('الرجاء اختيار المدينة'); return; }
    if (!phone.trim()) { setError('الرجاء إدخال رقم الهاتف'); return; }
    setLoading(true); setError(null);
    let finalImageUrl = '';
    if (imageUri) {
      setUploading(true);
      try { finalImageUrl = await uploadImage(imageUri); }
      catch (err: any) { setError('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف')); setLoading(false); setUploading(false); return; }
      setUploading(false);
    }
    const urgentUntil = isUrgent ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const { error: insertError } = await supabase.from('listings').insert({
      user_id: profile!.id, title: title.trim(), description: description.trim(),
      category, type: postType, city, phone: phone.trim(), delivery_method: deliveryMethod,
      image_url: finalImageUrl, is_urgent: isUrgent, urgent_until: urgentUntil,
      dual_mode: dualMode, status: 'available',
    });
    setLoading(false);
    if (insertError) { setError(insertError.message || 'حدث خطأ أثناء النشر'); return; }
    Alert.alert('تم بنجاح', 'تم نشر إعلانك بنجاح', [{ text: 'حسناً', onPress: () => router.back() }]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Nav */}
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>إعلان جديد</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={[styles.errorBox, { backgroundColor: C.errorBg, borderColor: C.error }]}>
            <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
          </View>
        )}

        {/* نوع الإعلان */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>نوع الإعلان</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, {
              backgroundColor: postType === 'exchange' ? (isDark ? 'rgba(59,130,246,0.15)' : '#2563EB') : (isDark ? C.card : '#fff'),
              borderColor: postType === 'exchange' ? C.exchange : (isDark ? C.cardBorder : '#E0E8EF'),
            }]}
            onPress={() => setPostType('exchange')} activeOpacity={0.7}
          >
            <ArrowLeftRight size={20} color={postType === 'exchange' ? (isDark ? C.exchange : '#fff') : C.textSecondary} />
            <Text style={[styles.typeBtnText, { color: postType === 'exchange' ? (isDark ? C.exchange : '#fff') : C.text }]}>بدّل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, {
              backgroundColor: postType === 'free' ? (isDark ? `${C.primary}18` : C.free) : (isDark ? C.card : '#fff'),
              borderColor: postType === 'free' ? C.primary : (isDark ? C.cardBorder : '#E0E8EF'),
            }]}
            onPress={() => setPostType('free')} activeOpacity={0.7}
          >
            <Gift size={20} color={postType === 'free' ? (isDark ? C.primary : '#fff') : C.textSecondary} />
            <Text style={[styles.typeBtnText, { color: postType === 'free' ? (isDark ? C.primary : '#fff') : C.text }]}>خذه مجاناً</Text>
          </TouchableOpacity>
        </View>

        {/* Toggles */}
        <View style={[styles.toggleRow, { backgroundColor: isDark ? C.card : '#fff', borderColor: isDark ? C.cardBorder : '#E0E8EF' }]}>
          <Switch value={dualMode} onValueChange={setDualMode} trackColor={{ false: isDark ? C.border : '#E0E8EF', true: `${C.primary}44` }} thumbColor={dualMode ? C.primary : (isDark ? '#4A5568' : '#CBD5E0')} />
          <View style={styles.toggleTextBlock}>
            <Text style={[styles.toggleLabel, { color: C.text }]}>مجاني + قابل للتبديل</Text>
            <Text style={[styles.toggleSub, { color: C.textSecondary }]}>يظهر في قسمي خذه وبدّل</Text>
          </View>
        </View>
        <View style={[styles.toggleRow, { backgroundColor: isDark ? C.card : '#fff', borderColor: isDark ? 'rgba(255,71,87,0.2)' : '#FCA5A5' }]}>
          <Switch value={isUrgent} onValueChange={setIsUrgent} trackColor={{ false: isDark ? C.border : '#E0E8EF', true: 'rgba(255,71,87,0.35)' }} thumbColor={isUrgent ? C.error : (isDark ? '#4A5568' : '#CBD5E0')} />
          <View style={styles.toggleTextBlock}>
            <View style={styles.urgentLabelRow}>
              <Flame size={13} color={C.error} />
              <Text style={[styles.toggleLabel, { color: C.error }]}>مستعجل</Text>
            </View>
            <Text style={[styles.toggleSub, { color: C.textSecondary }]}>يُعلَّم بشكل مميز لمدة 24 ساعة</Text>
          </View>
        </View>

        {/* العنوان */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>العنوان</Text>
        <TextInput style={[styles.textInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} placeholder="عنوان الإعلان" placeholderTextColor={C.textMuted} value={title} onChangeText={setTitle} textAlign="right" />

        {/* الوصف */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>الوصف</Text>
        <TextInput style={[styles.textInput, styles.textArea, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} placeholder="وصف الإعلان" placeholderTextColor={C.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlign="right" />

        {/* التصنيف */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>التصنيف</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, {
                backgroundColor: category === value ? (isDark ? `${C.primary}18` : C.primary) : (isDark ? C.card : '#fff'),
                borderColor: category === value ? C.primary : (isDark ? C.cardBorder : '#E0E8EF'),
              }]}
              onPress={() => setCategory(value)} activeOpacity={0.7}
            >
              {value === 'animals' && <PawPrint size={12} color={category === value ? (isDark ? C.primary : '#fff') : C.textSecondary} />}
              <Text style={[styles.chipText, { color: category === value ? (isDark ? C.primary : '#fff') : C.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* المدينة */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>المدينة</Text>
        <View style={styles.chipGrid}>
          {CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, styles.cityChip, {
                backgroundColor: city === c ? (isDark ? `${C.primary}18` : C.primary) : (isDark ? C.card : '#fff'),
                borderColor: city === c ? C.primary : (isDark ? C.cardBorder : '#E0E8EF'),
              }]}
              onPress={() => setCity(c)} activeOpacity={0.7}
            >
              <MapPin size={11} color={city === c ? (isDark ? C.primary : '#fff') : C.textSecondary} />
              <Text style={[styles.chipText, { color: city === c ? (isDark ? C.primary : '#fff') : C.textSecondary }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* رقم الهاتف */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>رقم الهاتف للتواصل</Text>
        <TextInput style={[styles.textInput, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} placeholder="05xxxxxxxx" placeholderTextColor={C.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textAlign="right" />

        {/* طريقة التسليم */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>طريقة التسليم</Text>
        <View style={styles.deliveryList}>
          {DELIVERY_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = deliveryMethod === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.deliveryOption, {
                  backgroundColor: active ? (isDark ? `${C.primary}10` : `${C.primary}08`) : (isDark ? C.card : '#fff'),
                  borderColor: active ? C.primary : (isDark ? C.cardBorder : '#E0E8EF'),
                }]}
                onPress={() => setDeliveryMethod(value)} activeOpacity={0.7}
              >
                <View style={styles.deliveryOptionLeft}>
                  {active && <Check size={15} color={C.primary} />}
                </View>
                <View style={styles.deliveryOptionRight}>
                  <Icon size={17} color={active ? C.primary : C.textSecondary} />
                  <Text style={[styles.deliveryOptionText, { color: active ? C.primary : C.textSecondary, fontWeight: active ? '700' : '500' }]}>{label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* الصورة */}
        <Text style={[styles.fieldLabel, { color: C.text }]}>صورة الإعلان</Text>
        <View style={styles.imageSection}>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageUri(null)}>
                <X size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.addImgBtn, { backgroundColor: isDark ? C.card : '#F4F7FA', borderColor: isDark ? C.cardBorder : '#E0E8EF' }]} onPress={pickImage} activeOpacity={0.7}>
              <Camera size={30} color={C.textSecondary} />
              <Text style={[styles.addImgText, { color: C.textSecondary }]}>اضغط لاختيار صورة</Text>
              <Text style={[styles.addImgSubText, { color: C.textMuted }]}>من مكتبة الصور</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* زر النشر */}
        <TouchableOpacity
          style={[styles.submitBtn, {
            backgroundColor: isDark ? `${C.primary}18` : C.primary,
            borderColor: isDark ? C.primary : 'transparent',
            borderWidth: isDark ? 1 : 0,
            shadowColor: C.primary,
            opacity: (loading || uploading) ? 0.6 : 1,
          }]}
          onPress={handleSubmit}
          disabled={loading || uploading}
          activeOpacity={0.8}
        >
          {loading || uploading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={isDark ? C.primary : '#fff'} />
              <Text style={[styles.submitBtnText, { color: isDark ? C.primary : '#fff' }]}>
                {uploading ? 'جاري رفع الصورة...' : 'جاري النشر...'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.submitBtnText, { color: isDark ? C.primary : '#fff' }]}>نشر الإعلان</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  errorBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  errorText: { fontSize: FontSizes.sm, textAlign: 'right' },
  fieldLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.xs },
  typeRow: { flexDirection: 'row', gap: Spacing.md },
  typeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
  },
  typeBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md,
  },
  toggleTextBlock: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  toggleSub: { fontSize: FontSizes.xs, textAlign: 'right', marginTop: 2 },
  urgentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  textInput: {
    borderWidth: 1.5, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, textAlign: 'right',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  cityChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2 },
  chipText: { fontSize: FontSizes.sm },
  deliveryList: { gap: Spacing.sm },
  deliveryOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  deliveryOptionLeft: { width: 20, alignItems: 'center' },
  deliveryOptionRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.sm },
  deliveryOptionText: { fontSize: FontSizes.md, textAlign: 'right' },
  imageSection: { alignItems: 'center' },
  imagePreviewWrapper: { position: 'relative', width: '100%' },
  imagePreview: { width: '100%', height: 200, borderRadius: BorderRadius.xl, resizeMode: 'cover' },
  imageRemoveBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
  },
  addImgBtn: {
    width: '100%', height: 160, borderRadius: BorderRadius.xl,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: Spacing.sm,
  },
  addImgText: { fontSize: FontSizes.md, fontWeight: '600' },
  addImgSubText: { fontSize: FontSizes.sm },
  submitBtn: {
    borderRadius: BorderRadius.xl, paddingVertical: Spacing.md + 4,
    alignItems: 'center', marginTop: Spacing.md,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  submitBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
