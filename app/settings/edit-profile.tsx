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
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
      <View style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>تعديل الملف الشخصي</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>تعديل الملف الشخصي</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={12}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.primary[600]} />
            : <Check size={24} color={Colors.primary[600]} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Feedback */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>تم حفظ التعديلات بنجاح</Text>
          </View>
        )}

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrap}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={44} color={Colors.primary[400]} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Camera size={16} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>اضغط لتغيير الصورة الشخصية</Text>
        </View>

        {/* الاسم */}
        <Text style={styles.label}>الاسم الكامل</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="أدخل اسمك الكامل"
          placeholderTextColor={Colors.neutral[400]}
          textAlign="right"
        />

        {/* رقم الجوال */}
        <Text style={styles.label}>رقم الجوال</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="05xxxxxxxx"
          placeholderTextColor={Colors.neutral[400]}
          keyboardType="phone-pad"
          textAlign="right"
        />

        {/* نوع الحساب */}
        <Text style={styles.label}>نوع الحساب</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleChip, role === r.value && styles.roleChipActive]}
              onPress={() => setRole(r.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleChipText, role === r.value && styles.roleChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* المدينة */}
        <Text style={styles.label}>المدينة</Text>
        <View style={styles.cityGrid}>
          {CITIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.cityChip, city === c && styles.cityChipActive]}
              onPress={() => setCity(c)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cityChipText, city === c && styles.cityChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
          }
        </TouchableOpacity>
      </ScrollView>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md },

  errorBox: {
    backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[400],
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  errorText: { color: Colors.error[600], fontSize: FontSizes.sm, textAlign: 'right' },
  successBox: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac',
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  successText: { color: '#16a34a', fontSize: FontSizes.sm, textAlign: 'right', fontWeight: '600' },

  avatarSection: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary[200] },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary[50], justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.primary[200],
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  avatarHint: { fontSize: FontSizes.sm, color: Colors.textSecondary },

  label: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  input: {
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSizes.md, color: Colors.text, textAlign: 'right',
  },

  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  roleChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  roleChipText: { fontSize: FontSizes.md, color: Colors.textSecondary, fontWeight: '600' },
  roleChipTextActive: { color: Colors.white },

  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  cityChipActive: { backgroundColor: Colors.primary[600], borderColor: Colors.primary[600] },
  cityChipText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  cityChipTextActive: { color: Colors.white, fontWeight: '600' },

  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md,
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
});
