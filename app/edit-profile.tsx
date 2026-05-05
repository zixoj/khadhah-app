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
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, User, Camera, Check } from 'lucide-react-native';

const CITIES = [
  'الرياض', 'جدة', 'مكة', 'المدينة', 'الدمام',
  'الخبر', 'الظهران', 'تبوك', 'أبها', 'الطائف',
  'بريدة', 'نجران', 'حائل', 'ينبع', 'الجبيل',
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile: baseProfile } = useAuth();
  const { colors: C, isDark } = useTheme();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', baseProfile!.id).maybeSingle();
    if (data) {
      setFullName(data.full_name || '');
      setPhone(data.phone || '');
      setCity(data.city || '');
      setCurrentAvatarUrl(data.avatar_url || '');
    }
    setLoading(false);
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
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
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم'); return; }
    setSaving(true);
    setError(null);

    let avatarUrl = currentAvatarUrl;
    if (avatarUri) {
      try {
        avatarUrl = await uploadAvatar(avatarUri);
      } catch {
        setError('فشل رفع الصورة الشخصية');
        setSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim(), city, avatar_url: avatarUrl })
      .eq('id', baseProfile!.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await supabase.from('activity_log').insert({
        user_id: baseProfile!.id,
        action: 'profile_updated',
        description: 'تم تحديث الملف الشخصي',
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        router.back();
      }, 1200);
    }
    setSaving(false);
  };

  const displayAvatar = avatarUri || currentAvatarUrl;
  const inputBg = isDark ? '#1A2020' : '#F5F5F5';
  const inputBorder = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';
  const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
  const navBg = isDark ? '#0D1410' : '#FFFFFF';
  const navBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const chipBg = isDark ? '#1A2020' : '#F5F5F5';
  const chipBorder = isDark ? 'rgba(255,255,255,0.12)' : '#D1D5DB';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: navBg, borderBottomColor: navBorder }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تعديل الملف الشخصي</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={C.primary} /> : <Check size={24} color={C.primary} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5', borderColor: isDark ? 'rgba(255,59,48,0.30)' : '#FECACA' }]}>
              <Text style={[styles.errorText, { color: isDark ? '#FF6B6B' : '#CC2222' }]}>{error}</Text>
            </View>
          )}

          {saveSuccess && (
            <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#ECFDF5', borderColor: isDark ? 'rgba(0,200,83,0.30)' : '#6EE7B7' }]}>
              <Check size={16} color={isDark ? '#00C853' : '#166534'} />
              <Text style={[styles.successText, { color: isDark ? '#00C853' : '#166534' }]}>تم حفظ التعديلات بنجاح</Text>
            </View>
          )}

          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrap}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={[styles.avatar, { borderColor: C.primary }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#1A2020' : '#F0FDF4', borderColor: C.primary }]}>
                  <User size={44} color={C.primary} />
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: C.primary }]}>
                <Camera size={16} color="#000" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: C.textSecondary }]}>اضغط لتغيير الصورة الشخصية</Text>
          </View>

          <Text style={[styles.label, { color: C.text }]}>الاسم الكامل</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="أدخل اسمك الكامل"
            placeholderTextColor={placeholderColor}
            textAlign="right"
          />

          <Text style={[styles.label, { color: C.text }]}>رقم الجوال</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: C.text }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="05xxxxxxxx"
            placeholderTextColor={placeholderColor}
            keyboardType="phone-pad"
            textAlign="right"
          />

          <Text style={[styles.label, { color: C.text }]}>المدينة</Text>
          <View style={styles.cityGrid}>
            {CITIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.cityChip,
                  city === c
                    ? { backgroundColor: C.primary, borderColor: C.primary }
                    : { backgroundColor: chipBg, borderColor: chipBorder },
                ]}
                onPress={() => setCity(c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cityChipText, { color: city === c ? '#000' : C.text }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: C.primary, shadowColor: C.primary }, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  errorBox: {
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center',
  },
  errorText: { fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600', flex: 1 },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  successText: { fontSize: FontSizes.sm, fontWeight: '600' },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', borderWidth: 3,
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarHint: { fontSize: FontSizes.sm },
  label: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, textAlign: 'right',
  },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  cityChipText: { fontSize: FontSizes.sm, fontWeight: '500' },
  saveBtn: {
    borderRadius: BorderRadius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontSize: FontSizes.lg, fontWeight: '700' },
});
