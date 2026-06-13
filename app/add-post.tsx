import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  Switch,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import {
  ChevronLeft, Camera, MapPin, Check, Truck, User,
  MessageCircle, ArrowLeftRight, Gift, X, Flame, Plus,
  CheckCircle,
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
type SubmitStep = 'idle' | 'uploading' | 'saving' | 'success';

interface PickedImage {
  uri: string;
  mimeType: string;
  fileSize?: number;
}

const RPC_ERRORS: Record<string, string> = {
  missing_title: 'الرجاء إدخال عنوان الإعلان',
  missing_category: 'الرجاء اختيار التصنيف',
  missing_city: 'الرجاء اختيار المدينة',
  invalid_type: 'نوع الإعلان غير صحيح',
  daily_limit_reached: 'وصلت للحد اليومي (إعلانان/يوم). حاول غداً.',
};

const MAX_IMAGES = 5;

export default function AddPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type: typeParam } = useLocalSearchParams<{ type: string }>();
  const { profile, loading: authLoading } = useAuth();
  const { colors: C, isDark } = useTheme();

  const [postType, setPostType] = useState<PostType>(typeParam === 'free' ? 'free' : 'exchange');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('direct_contact');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [step, setStep] = useState<SubmitStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);

  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const isLoading = step === 'uploading' || step === 'saving';
  const isSubmitDisabled = isLoading || authLoading || !profile?.id;

  const SUPPORTED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

  const resolveMime = (asset: ImagePicker.ImagePickerAsset): string => {
    const m = asset.mimeType?.toLowerCase();
    if (m && SUPPORTED_MIME.includes(m)) return m;
    // Derive from URI extension as fallback
    const ext = asset.uri.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp',
      heic: 'image/heic', heif: 'image/heif',
    };
    return map[ext] ?? 'image/jpeg';
  };

  const mimeToExt = (mime: string): string => {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/webp': 'webp',
      'image/heic': 'jpg', 'image/heif': 'jpg', // convert HEIC to JPEG at upload
    };
    return map[mime] ?? 'jpg';
  };

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES || isLoading) return;
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setError('يرجى السماح بالوصول إلى الصور'); return; }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.75,
        exif: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('[ImagePicker] selected assets:', result.assets.map((a) => ({
          uri: a.uri.slice(0, 80),
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          width: a.width,
          height: a.height,
        })));

        const valid: PickedImage[] = [];
        for (const a of result.assets) {
          if (!a.uri) continue;
          const mime = resolveMime(a);
          if (!SUPPORTED_MIME.includes(mime)) {
            console.warn('[ImagePicker] unsupported mime, skipping:', mime);
            continue;
          }
          if (a.fileSize && a.fileSize > MAX_FILE_BYTES) {
            setError('حجم الصورة كبير، حاول بصورة أصغر');
            continue;
          }
          valid.push({ uri: a.uri, mimeType: mime, fileSize: a.fileSize });
        }
        if (valid.length > 0) {
          setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
          setError(null);
        }
      }
    } catch (err) {
      console.error('[ImagePicker] error:', err);
      setError('فشل فتح معرض الصور، حاول مرة أخرى');
    }
  };

  const removeImage = (idx: number) => {
    if (isLoading) return;
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Returns { publicUrl, storagePath }
  const uploadImage = async (
    img: PickedImage,
  ): Promise<{ publicUrl: string; storagePath: string }> => {
    // ── 1. Verify live auth session ─────────────────────────────────────────
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[Upload] auth.getUser ->', user?.id ?? 'NO USER', userError?.message ?? '');
    if (userError || !user) {
      throw new Error('المستخدم غير مسجّل الدخول — ' + (userError?.message ?? 'no session'));
    }

    // ── 2. Build file path ──────────────────────────────────────────────────
    const effectiveMime = img.mimeType.startsWith('image/hei') ? 'image/jpeg' : img.mimeType;
    const ext = mimeToExt(effectiveMime);
    // Path format: ads/{userId}/{timestamp}-{random}.ext
    // foldername(name)[1] in the INSERT policy checks the FIRST segment = user.id
    const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    console.log('[Upload] ── DIAGNOSTIC ──');
    console.log('[Upload] uri       :', img.uri);
    console.log('[Upload] mimeType  :', img.mimeType, '→ effective:', effectiveMime);
    console.log('[Upload] fileSize  :', img.fileSize ?? 'unknown');
    console.log('[Upload] userId    :', user.id);
    console.log('[Upload] bucket    : ads-images');
    console.log('[Upload] filePath  :', filePath);

    // ── 3. Read image bytes ─────────────────────────────────────────────────
    let uploadBody: Blob | Uint8Array;
    if (Platform.OS === 'web') {
      // Web: image picker gives a blob: URL — fetch + blob is the correct path.
      // Supabase wraps Blob in FormData which browsers handle correctly.
      const res = await fetch(img.uri);
      if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();
      console.log('[Upload] blob size:', blob.size, 'type:', blob.type);
      if (blob.size === 0) throw new Error('الصورة فارغة');
      if (blob.size > MAX_FILE_BYTES) throw new Error('حجم الصورة أكبر من 5 ميغابايت');
      uploadBody = blob.type ? blob : new Blob([blob], { type: effectiveMime });
    } else {
      // Native: expo-image-picker returns file:// URIs.
      // fetch() on file:// works in RN. We convert to Uint8Array so Supabase
      // sends raw bytes with content-type header (bypasses broken FormData path).
      const res = await fetch(img.uri);
      if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
      const blob = await res.blob();
      console.log('[Upload] blob size:', blob.size, 'type:', blob.type);
      if (blob.size === 0) throw new Error('الصورة فارغة');
      if (blob.size > MAX_FILE_BYTES) throw new Error('حجم الصورة أكبر من 5 ميغابايت');
      const ab = await blob.arrayBuffer();
      uploadBody = new Uint8Array(ab);
    }

    // ── 4. Upload to Supabase Storage ───────────────────────────────────────
    console.log('[Upload] calling supabase.storage.upload ...');
    const { data, error: uploadError } = await supabase.storage
      .from('ads-images')
      .upload(filePath, uploadBody, {
        contentType: effectiveMime,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[Upload] ── UPLOAD ERROR ──');
      console.error('[Upload] message :', uploadError.message);
      console.error('[Upload] status  :', (uploadError as any).status);
      console.error('[Upload] error   :', (uploadError as any).error);
      console.error('[Upload] details :', (uploadError as any).details);
      console.error('[Upload] full    :', JSON.stringify(uploadError, null, 2));
      // Re-throw with FULL raw message so it surfaces on screen unfiltered
      throw uploadError;
    }

    const uploadedPath = data?.path ?? null;
    if (!uploadedPath) {
      console.error('[Upload] missing path in response:', JSON.stringify(data));
      throw new Error('رفع الصورة نجح لكن لم يُرجع مساراً');
    }

    const { data: urlData } = supabase.storage.from('ads-images').getPublicUrl(uploadedPath);
    const publicUrl = urlData?.publicUrl ?? null;
    if (!publicUrl) throw new Error('فشل الحصول على الرابط العام للصورة');

    console.log('[Upload] ── UPLOAD SUCCESS ──');
    console.log('[Upload] publicUrl:', publicUrl);
    return { publicUrl, storagePath: uploadedPath };
  };

  const handleSubmit = async () => {
    setError(null);

    // ── Auth guard ──────────────────────────────────────────────────────────
    console.log('[AddPost] USER (profile):', profile);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('[AddPost] supabase.auth.getUser ->', user?.id ?? 'NO USER', userError?.message ?? '');
    if (userError || !user?.id) {
      setError('جلسة المستخدم غير موجودة، يرجى تسجيل الدخول مجدداً');
      return;
    }
    if (!profile?.id) {
      setError('لم يتم تحميل بيانات الملف الشخصي، يرجى المحاولة مجدداً');
      return;
    }

    if (!title.trim()) { setError('الرجاء إدخال عنوان الإعلان'); return; }
    if (!category) { setError('الرجاء اختيار التصنيف'); return; }
    if (!city) { setError('الرجاء اختيار المدينة'); return; }
    if (!phone.trim()) { setError('الرجاء إدخال رقم الهاتف'); return; }

    // --- Step 1: Upload all images first, sequentially (avoids race conditions) ---
    type UploadedImage = { publicUrl: string; storagePath: string };
    const uploaded: UploadedImage[] = [];

    if (images.length > 0) {
      setStep('uploading');
      // Snapshot so user cannot mutate list while uploading (isLoading=true disables UI)
      const snapshot = [...images];
      for (let i = 0; i < snapshot.length; i++) {
        try {
          const result = await uploadImage(snapshot[i]);
          uploaded.push(result);
        } catch (err: any) {
          setStep('idle');
          // Show the REAL error unfiltered so the cause is visible
          const msg: string =
            err?.message ||
            err?.error ||
            err?.details ||
            JSON.stringify(err) ||
            'فشل رفع الصورة';
          console.error('[handleSubmit] upload[' + i + '] FAILED:', msg, err);
          setError('خطأ رفع الصورة: ' + msg);
          return;
        }
      }
    }

    // --- Step 2: Create the listing record ---
    setStep('saving');

    const primaryUrl = uploaded[0]?.publicUrl ?? '';
    const { data, error: rpcError } = await supabase.rpc('create_listing', {
      p_title: title.trim(),
      p_description: description.trim(),
      p_category: category,
      p_type: postType,
      p_city: city,
      p_phone: phone.trim(),
      p_delivery_method: deliveryMethod,
      p_image_url: primaryUrl,
      p_is_urgent: isUrgent,
      p_dual_mode: false,
    });

    console.log('[handleSubmit] create_listing RPC result:', JSON.stringify(data), rpcError);

    if (rpcError) {
      setStep('idle');
      setError(rpcError.message || 'حدث خطأ أثناء النشر');
      return;
    }

    if (!data?.success) {
      setStep('idle');
      setError(RPC_ERRORS[data?.reason as string] || 'حدث خطأ أثناء النشر');
      return;
    }

    const listingId: string | null = data?.listing_id ?? null;

    // --- Step 3: Insert all images into post_images (including primary at sort_order=0) ---
    if (uploaded.length > 0 && listingId) {
      const rows = uploaded.map((img, idx) => ({
        post_id: listingId,
        image_url: img.publicUrl,
        sort_order: idx,
        user_id: user.id,
      }));
      const { error: imgInsertError } = await supabase.from('post_images').insert(rows);
      if (imgInsertError) {
        // Non-fatal: listing was created; log the error but don't block success
        console.error('[handleSubmit] post_images insert error:', imgInsertError);
      } else {
        console.log('[handleSubmit] post_images inserted:', rows.length, 'rows for listing', listingId);
      }
    }

    setStep('success');
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleDone = () => {
    router.replace('/(tabs)/');
  };

  const handleViewListing = () => {
    router.replace('/(tabs)/');
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={[styles.successContainer, { backgroundColor: C.background, paddingTop: insets.top }]}>
        <Animated.View style={[styles.successInner, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
          <View style={[styles.successIconWrap, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(0,200,83,0.25)' : '#A7F3D0' }]}>
            <CheckCircle size={64} color={C.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.successTitle, { color: C.text }]}>تم نشر إعلانك!</Text>
          <Text style={[styles.successSub, { color: C.textSecondary }]}>
            ظهر إعلانك الآن في الصفحة الرئيسية وفي قسم إعلاناتي
          </Text>
          <View style={styles.successDetails}>
            {[
              { label: 'العنوان', value: title },
              { label: 'النوع', value: postType === 'free' ? 'خذه مجاناً' : 'بدّل' },
              { label: 'المدينة', value: city },
            ].map((row) => (
              <View key={row.label} style={[styles.successDetailRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#F0F0F0' }]}>
                <Text style={[styles.successDetailVal, { color: C.text }]}>{row.value}</Text>
                <Text style={[styles.successDetailKey, { color: C.textSecondary }]}>{row.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: C.primary, shadowColor: C.primary }]}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E0' }]}
            onPress={handleViewListing}
            activeOpacity={0.8}
          >
            <Text style={[styles.viewBtnText, { color: C.textSecondary }]}>إضافة إعلان آخر</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  const inputBg = isDark ? C.card : '#FAFAFA';
  const inputBorder = isDark ? C.cardBorder : '#E0E8EF';
  const cardBg = isDark ? C.card : '#fff';
  const activePrimary = isDark ? `${C.primary}18` : C.primary;
  const activeExchange = isDark ? `rgba(59,130,246,0.15)` : '#2563EB';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { backgroundColor: isDark ? C.navBar : '#fff', borderBottomColor: isDark ? C.border : '#EBEBEB', paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? '#1A2020' : '#F4F7FA' }]}>
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>إعلان جديد</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Error */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA' }]}>
            <X size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── نوع الإعلان ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>نوع الإعلان</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, {
              backgroundColor: postType === 'exchange' ? activeExchange : cardBg,
              borderColor: postType === 'exchange' ? C.exchange : inputBorder,
            }]}
            onPress={() => setPostType('exchange')}
            activeOpacity={0.75}
          >
            <ArrowLeftRight size={20} color={postType === 'exchange' ? (isDark ? C.exchange : '#fff') : C.textSecondary} />
            <Text style={[styles.typeBtnText, { color: postType === 'exchange' ? (isDark ? C.exchange : '#fff') : C.text }]}>بدّل</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, {
              backgroundColor: postType === 'free' ? activePrimary : cardBg,
              borderColor: postType === 'free' ? C.primary : inputBorder,
            }]}
            onPress={() => setPostType('free')}
            activeOpacity={0.75}
          >
            <Gift size={20} color={postType === 'free' ? (isDark ? C.primary : '#fff') : C.textSecondary} />
            <Text style={[styles.typeBtnText, { color: postType === 'free' ? (isDark ? C.primary : '#fff') : C.text }]}>خذه مجاناً</Text>
          </TouchableOpacity>
        </View>

        {/* ── Toggles ── */}
        <View style={[styles.toggleCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
          <View style={styles.toggleRow}>
            <Switch
              value={isUrgent}
              onValueChange={setIsUrgent}
              trackColor={{ false: isDark ? '#2A3530' : '#E0E8EF', true: 'rgba(239,68,68,0.4)' }}
              thumbColor={isUrgent ? '#EF4444' : (isDark ? '#4A5568' : '#CBD5E0')}
            />
            <View style={styles.toggleText}>
              <View style={styles.urgentRow}>
                <Flame size={13} color="#EF4444" />
                <Text style={[styles.toggleLabel, { color: '#EF4444' }]}>مستعجل</Text>
              </View>
              <Text style={[styles.toggleSub, { color: C.textSecondary }]}>يُعلَّم بشكل مميز لمدة 24 ساعة</Text>
            </View>
          </View>
        </View>

        {/* ── الصور ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>
          الصور{' '}
          <Text style={{ color: C.textSecondary, fontWeight: '500', fontSize: FontSizes.sm }}>
            ({images.length}/{MAX_IMAGES})
          </Text>
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imagesRow}
        >
          {images.map((img, idx) => (
            <View key={`${img.uri}-${idx}`} style={styles.imageThumbWrap}>
              <Image source={{ uri: img.uri }} style={styles.imageThumb} />
              {idx === 0 && (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>رئيسية</Text>
                </View>
              )}
              <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => removeImage(idx)}>
                <X size={11} color="#fff" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <TouchableOpacity
              style={[styles.addImgBtn, { backgroundColor: isDark ? '#0D1410' : '#F4F9F6', borderColor: isDark ? 'rgba(0,200,83,0.2)' : '#C8E6C9' }]}
              onPress={pickImages}
              activeOpacity={0.75}
            >
              <View style={[styles.addImgIcon, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : 'rgba(0,168,68,0.08)' }]}>
                <Camera size={22} color={C.primary} />
              </View>
              <Text style={[styles.addImgLabel, { color: C.primary }]}>أضف صورة</Text>
              <Text style={[styles.addImgSub, { color: C.textSecondary }]}>
                {MAX_IMAGES - images.length} متبقية
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* ── العنوان ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>عنوان الإعلان</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
          placeholder="اكتب عنواناً واضحاً..."
          placeholderTextColor={C.textMuted}
          value={title}
          onChangeText={(t) => { setTitle(t); setError(null); }}
          textAlign="right"
          maxLength={80}
        />

        {/* ── الوصف ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>الوصف</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
          placeholder="صف الغرض بالتفصيل: الحالة، الحجم، اللون، أي عيوب..."
          placeholderTextColor={C.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlign="right"
          textAlignVertical="top"
        />

        {/* ── التصنيف ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>التصنيف</Text>
        <View style={styles.chipGrid}>
          {CATEGORIES.map(({ label, value }) => {
            const active = category === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.chip, {
                  backgroundColor: active ? (isDark ? `${C.primary}18` : C.primary) : cardBg,
                  borderColor: active ? C.primary : inputBorder,
                }]}
                onPress={() => { setCategory(value); setError(null); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, { color: active ? (isDark ? C.primary : '#fff') : C.textSecondary }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── المدينة ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>المدينة</Text>
        <View style={styles.chipGrid}>
          {CITIES.map((c) => {
            const active = city === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.chip, styles.cityChip, {
                  backgroundColor: active ? (isDark ? `${C.primary}18` : C.primary) : cardBg,
                  borderColor: active ? C.primary : inputBorder,
                }]}
                onPress={() => { setCity(c); setError(null); }}
                activeOpacity={0.7}
              >
                <MapPin size={10} color={active ? (isDark ? C.primary : '#fff') : C.textSecondary} />
                <Text style={[styles.chipText, { color: active ? (isDark ? C.primary : '#fff') : C.textSecondary }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── رقم الهاتف ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>رقم الهاتف للتواصل</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
          placeholder="05xxxxxxxx"
          placeholderTextColor={C.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textAlign="right"
        />

        {/* ── طريقة التسليم ── */}
        <Text style={[styles.sectionLabel, { color: C.text }]}>طريقة التسليم</Text>
        <View style={styles.deliveryList}>
          {DELIVERY_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = deliveryMethod === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.deliveryRow, {
                  backgroundColor: active ? (isDark ? `${C.primary}10` : `${C.primary}08`) : cardBg,
                  borderColor: active ? C.primary : inputBorder,
                }]}
                onPress={() => setDeliveryMethod(value)}
                activeOpacity={0.75}
              >
                <View style={[styles.radioOuter, { borderColor: active ? C.primary : (isDark ? '#3A4A44' : '#C8D6D0') }]}>
                  {active && <View style={[styles.radioInner, { backgroundColor: C.primary }]} />}
                </View>
                <View style={[styles.deliveryIconWrap, { backgroundColor: active ? (isDark ? `${C.primary}18` : `${C.primary}12`) : (isDark ? '#1A2020' : '#F4F7FA') }]}>
                  <Icon size={17} color={active ? C.primary : C.textSecondary} />
                </View>
                <Text style={[styles.deliveryLabel, { color: active ? C.primary : C.text, fontWeight: active ? '700' : '500' }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── زر النشر ── */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: C.primary, shadowColor: C.primary, opacity: isSubmitDisabled ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitDisabled}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#000" size="small" />
              <Text style={styles.submitBtnText}>
                {step === 'uploading' ? 'جاري رفع الصور...' : 'جاري النشر...'}
              </Text>
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <Plus size={20} color="#000" strokeWidth={3} />
              <Text style={styles.submitBtnText}>نشر الإعلان</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontSize: FontSizes.lg, fontWeight: '700' },
  navIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorText: { color: '#EF4444', fontSize: FontSizes.sm, flex: 1, textAlign: 'right' },

  sectionLabel: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: -4,
  },

  typeRow: { flexDirection: 'row', gap: Spacing.md },
  typeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: Spacing.sm, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5,
  },
  typeBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },

  toggleCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: Spacing.md, padding: 14,
  },
  toggleText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  toggleSub: { fontSize: FontSizes.xs, textAlign: 'right' },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  imagesRow: { gap: 10, paddingVertical: 4 },
  imageThumbWrap: { width: 110, height: 110, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  imageThumb: { width: '100%', height: '100%', resizeMode: 'cover' },
  mainBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 3, alignItems: 'center',
  },
  mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  imgRemoveBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  addImgBtn: {
    width: 110, height: 110, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  addImgIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addImgLabel: { fontSize: FontSizes.sm, fontWeight: '700' },
  addImgSub: { fontSize: 10 },

  input: {
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: FontSizes.md,
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 99, borderWidth: 1,
  },
  cityChip: { paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: FontSizes.sm, fontWeight: '600' },

  deliveryList: { gap: 10 },
  deliveryRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  deliveryIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  deliveryLabel: { flex: 1, fontSize: FontSizes.md, textAlign: 'right' },

  submitBtn: {
    borderRadius: 16, paddingVertical: 17,
    alignItems: 'center', marginTop: Spacing.sm,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  submitBtnText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#000' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Success screen
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  successInner: { width: '100%', alignItems: 'center', gap: 16 },
  successIconWrap: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  successTitle: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  successSub: { fontSize: FontSizes.md, textAlign: 'center', lineHeight: 24, maxWidth: 280 },
  successDetails: { width: '100%', marginTop: 8 },
  successDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
  },
  successDetailKey: { fontSize: FontSizes.sm, fontWeight: '600' },
  successDetailVal: { fontSize: FontSizes.sm, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  doneBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5,
  },
  doneBtnText: { fontSize: FontSizes.lg, fontWeight: '800', color: '#000' },
  viewBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1,
  },
  viewBtnText: { fontSize: FontSizes.md, fontWeight: '600' },
});
