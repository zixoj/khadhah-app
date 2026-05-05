import { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, User, Camera, Check } from 'lucide-react-native';

const CITIES = [
  'الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام',
  'الخبر', 'الظهران', 'تبوك', 'أبها', 'الطائف',
  'بريدة', 'نجران', 'حائل', 'ينبع', 'الجبيل',
];

const ROLES = [
  { value: 'advertiser', label: 'معلن' },
  { value: 'delivery_agent', label: 'مندوب توصيل' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile: baseProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const C = colors;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState('advertiser');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, city, role, avatar_url')
      .eq('id', baseProfile!.id)
      .maybeSingle();
    if (data) {
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setCity(data.city || '');
      setRole(data.role || 'advertiser');
      setCurrentAvatarUrl(data.avatar_url || '');
    }
    setLoading(false);
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('يرجى السماح بالوصول إلى الصور');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string): Promise<string> => {
    const filename = `avatars/${baseProfile!.id}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error: uploadError } = await supabase.storage
      .from('listing-images')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('الرجاء إدخال الاسم الكامل');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    let avatarUrl = currentAvatarUrl;
    if (avatarUri) {
      try {
        avatarUrl = await uploadAvatar(avatarUri);
      } catch {
        setError('فشل رفع الصورة الشخصية، حاول مرة أخرى');
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        city,
        role,
        avatar_url: avatarUrl,
      })
      .eq('id', baseProfile!.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await supabase.from('activity_log').insert({
        user_id: baseProfile!.id,
        action: 'profile_updated',
        description: 'تم تحديث الملف الشخصي',
      }).maybeSingle();
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    }
    setSaving(false);
  };

  const displayAvatar = avatarUri || currentAvatarUrl;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>تعديل الملف الشخصي</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
          hitSlop={12}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تعديل الملف الشخصي</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
          hitSlop={12}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Check size={20} color={C.primary} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={[styles.errorBox, { backgroundColor: C.errorBg, borderColor: C.error }]}>
            <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(0,204,106,0.12)' : '#F0FDF4', borderColor: isDark ? C.primary : '#86EFAC' }]}>
            <Text style={[styles.successText, { color: C.primary }]}>تم حفظ التعديلات بنجاح</Text>
          </View>
        )}

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrap}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={[styles.avatar, { borderColor: isDark ? C.primary : `${C.primary}66` }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? C.card : `${C.primary}10`, borderColor: isDark ? C.primary : `${C.primary}66` }]}>
                <User size={44} color={C.primary} />
              </View>
            )}
            <View style={[styles.cameraBadge, { backgroundColor: C.primary }]}>
              <Camera size={16} color={isDark ? '#000' : '#fff'} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: C.textSecondary }]}>اضغط لتغيير الصورة الشخصية</Text>
        </View>

        <Text style={[styles.label, { color: C.text }]}>الاسم الكامل</Text>
        <TextInput
          style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
          value={fullName}
          onChangeText={setFullName}
          placeholder="أدخل اسمك الكامل"
          placeholderTextColor={C.textMuted}
          textAlign="right"
        />

        <Text style={[styles.label, { color: C.text }]}>رقم الجوال</Text>
        <TextInput
          style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="05xxxxxxxx"
          placeholderTextColor={C.textMuted}
          keyboardType="phone-pad"
          textAlign="right"
        />

        <Text style={[styles.label, { color: C.text }]}>نوع الحساب</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[
                styles.roleChip,
                {
                  backgroundColor: role === r.value
                    ? (isDark ? `${C.primary}18` : C.primary)
                    : (isDark ? C.card : '#F4F7FA'),
                  borderColor: role === r.value ? C.primary : (isDark ? C.border : '#E8EDF2'),
                },
              ]}
              onPress={() => setRole(r.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleChipText, {
                color: role === r.value
                  ? (isDark ? C.primary : '#fff')
                  : C.textSecondary,
              }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: C.text }]}>المدينة</Text>
        <View style={styles.cityGrid}>
          {CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.cityChip,
                {
                  backgroundColor: city === c
                    ? (isDark ? `${C.primary}18` : C.primary)
                    : (isDark ? C.card : '#F4F7FA'),
                  borderColor: city === c ? C.primary : (isDark ? C.border : '#E8EDF2'),
                },
              ]}
              onPress={() => setCity(c)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityChipText, {
                color: city === c
                  ? (isDark ? C.primary : '#fff')
                  : C.textSecondary,
                fontWeight: city === c ? '600' : '400',
              }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, {
            backgroundColor: isDark ? 'transparent' : C.primary,
            borderColor: C.primary, borderWidth: isDark ? 1.5 : 0,
            shadowColor: C.primary,
          }, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={isDark ? C.primary : '#fff'} />
            : <Text style={[styles.saveBtnText, { color: isDark ? C.primary : '#fff' }]}>حفظ التعديلات</Text>
          }
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md },

  errorBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  errorText: { fontSize: FontSizes.sm, textAlign: 'right' },
  successBox: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  successText: { fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3,
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { fontSize: FontSizes.sm },

  label: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, textAlign: 'right',
  },

  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1.5, alignItems: 'center',
  },
  roleChipText: { fontSize: FontSizes.md, fontWeight: '600' },

  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  cityChipText: { fontSize: FontSizes.sm },

  saveBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },
});
