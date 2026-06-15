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
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, User, Camera, Check, Clock, Globe, ChevronDown, X, Phone } from 'lucide-react-native';
import { COUNTRIES, getCitiesByCountry, COUNTRY_MAP, type Country } from '@/lib/countries';

const ROLES = [
  { value: 'advertiser', label: 'معلن' },
  { value: 'delivery_agent', label: 'مندوب توصيل' },
];

const RPC_ERRORS: Record<string, string> = {
  display_name_cooldown: 'لا يمكن تغيير الاسم الظاهر الآن',
  username_cooldown: 'لا يمكن تغيير اليوزر الآن',
  username_taken: 'هذا اليوزر مستخدم من قبل شخص آخر',
  phone_taken: 'رقم الجوال هذا مستخدم بالفعل',
};

function cooldownMessage(reason: string, remainingDays: number): string {
  const days = Math.ceil(remainingDays);
  if (reason === 'display_name_cooldown') return `لا يمكن تغيير الاسم الظاهر قبل ${days} يوم`;
  if (reason === 'username_cooldown') return `لا يمكن تغيير اليوزر قبل ${days} يوم`;
  return RPC_ERRORS[reason] || 'حدث خطأ غير متوقع';
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile: baseProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const C = colors;

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState('advertiser');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  const [lastDisplayNameChange, setLastDisplayNameChange] = useState<string | null>(null);
  const [lastUsernameChange, setLastUsernameChange] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableCities = getCitiesByCountry(selectedCountry?.nameEn);

  useEffect(() => {
    fetchProfile();
  }, [baseProfile?.id]);

  // Reset city if it doesn't belong to the newly selected country
  useEffect(() => {
    if (selectedCountry && city && !availableCities.includes(city)) {
      setCity('');
    }
  }, [selectedCountry]);

  const fetchProfile = async () => {
    if (!baseProfile?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, display_name, username, phone, phone_number, city, role, avatar_url, last_display_name_change_at, last_username_change_at, country, country_code')
        .eq('id', baseProfile.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || '');
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setPhoneNumber(data.phone_number || data.phone || '');
        setCity(data.city || '');
        setRole(data.role || 'advertiser');
        setCurrentAvatarUrl(data.avatar_url || '');
        setLastDisplayNameChange(data.last_display_name_change_at || null);
        setLastUsernameChange(data.last_username_change_at || null);
        if (data.country) {
          setSelectedCountry(COUNTRY_MAP[data.country] ?? null);
        }
      }
    } catch (e) {
      console.error('[edit-profile] fetchProfile:', e);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilAllowed = (lastChangeAt: string | null, cooldownDays: number): number => {
    if (!lastChangeAt) return 0;
    const elapsed = (Date.now() - new Date(lastChangeAt).getTime()) / 86400000;
    const remaining = cooldownDays - elapsed;
    return remaining > 0 ? remaining : 0;
  };

  const displayNameRemaining = getDaysUntilAllowed(lastDisplayNameChange, 7);
  const usernameRemaining = getDaysUntilAllowed(lastUsernameChange, 30);

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setError('يرجى السماح بالوصول إلى الصور'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string): Promise<string> => {
    const filename = `${baseProfile?.id ?? 'unknown'}/avatar.jpg`;
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
    if (!baseProfile?.id) return;
    if (!fullName.trim()) { setError('الرجاء إدخال الاسم الكامل'); return; }
    if (phoneNumber.trim() && /[a-zA-Z]/.test(phoneNumber)) {
      setError('رقم الجوال يجب أن يحتوي على أرقام فقط');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    let avatarUrl = currentAvatarUrl;
    if (avatarUri) {
      try { avatarUrl = await uploadAvatar(avatarUri); }
      catch { setError('فشل رفع الصورة الشخصية، حاول مرة أخرى'); setSaving(false); return; }
    }

    const fullPhone = selectedCountry && phoneNumber
      ? `${selectedCountry.code}${phoneNumber.replace(/^0/, '')}`
      : phoneNumber;

    const { data, error: rpcError } = await supabase.rpc('update_profile_fields', {
      p_full_name: fullName.trim(),
      p_display_name: displayName.trim() || null,
      p_username: username.trim() || null,
      p_phone: fullPhone || null,
      p_city: city,
      p_avatar_url: avatarUrl || null,
      p_country: selectedCountry?.nameEn ?? null,
      p_country_code: selectedCountry?.code ?? null,
      p_phone_number: phoneNumber.trim() || null,
      p_full_phone_number: fullPhone || null,
    });

    if (rpcError) { setError(rpcError.message); setSaving(false); return; }

    const result = data as { success: boolean; reason?: string; remaining_days?: number };
    if (!result.success) {
      const reason = result.reason || '';
      const remaining = result.remaining_days || 0;
      if (reason === 'display_name_cooldown' || reason === 'username_cooldown') {
        setError(cooldownMessage(reason, remaining));
      } else {
        setError(RPC_ERRORS[reason] || 'حدث خطأ غير متوقع');
      }
      setSaving(false);
      return;
    }

    setSuccess(true);
    setAvatarUri(null);
    await fetchProfile();
    setTimeout(() => { setSuccess(false); router.back(); }, 1200);
    setSaving(false);
  };

  const displayAvatar = avatarUri || currentAvatarUrl;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]} hitSlop={12}>
            <ChevronLeft size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.text }]}>تعديل الملف الشخصي</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Country picker modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: isDark ? '#0D1410' : '#fff' }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8EDF2' }]}>
              <Text style={[styles.pickerTitle, { color: C.text }]}>اختر دولتك</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={[styles.closeBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
                <X size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.nameEn}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F0F4F2' }, selectedCountry?.nameEn === item.nameEn && { backgroundColor: isDark ? 'rgba(0,200,83,0.08)' : '#ECFDF5' }]}
                  onPress={() => { setSelectedCountry(item); setShowCountryPicker(false); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.codeBadge, { backgroundColor: isDark ? 'rgba(0,200,83,0.10)' : '#E6F9EE', borderColor: isDark ? 'rgba(0,200,83,0.20)' : '#A7F3D0' }]}>
                    <Text style={[styles.codeText, { color: C.primary }]}>{item.code}</Text>
                  </View>
                  <Text style={[styles.countryItemName, { color: C.text }, selectedCountry?.nameEn === item.nameEn && { color: C.primary, fontWeight: '700' }]}>
                    {item.nameAr}
                  </Text>
                  {selectedCountry?.nameEn === item.nameEn && <Check size={16} color={C.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]} hitSlop={12}>
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>تعديل الملف الشخصي</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]} hitSlop={12}>
          {saving ? <ActivityIndicator size="small" color={C.primary} /> : <Check size={20} color={C.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

        {/* Avatar */}
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

        {/* Full name */}
        <Text style={[styles.label, { color: C.text }]}>الاسم الكامل</Text>
        <TextInput style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]} value={fullName} onChangeText={setFullName} placeholder="أدخل اسمك الكامل" placeholderTextColor={C.textMuted} textAlign="right" />

        {/* Display name */}
        <View style={styles.fieldHeaderRow}>
          <Text style={[styles.label, { color: C.text }]}>الاسم الظاهر</Text>
          {displayNameRemaining > 0 && (
            <View style={[styles.cooldownBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D' }]}>
              <Clock size={12} color="#D97706" />
              <Text style={[styles.cooldownText, { color: '#D97706' }]}>{Math.ceil(displayNameRemaining)} يوم</Text>
            </View>
          )}
        </View>
        <TextInput
          style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }, displayNameRemaining > 0 && styles.inputDisabled]}
          value={displayName} onChangeText={setDisplayName}
          placeholder="الاسم الذي يظهر للآخرين" placeholderTextColor={C.textMuted}
          textAlign="right" editable={displayNameRemaining === 0}
        />
        {displayNameRemaining > 0 && <Text style={[styles.fieldHint, { color: C.textMuted }]}>يمكن التغيير بعد {Math.ceil(displayNameRemaining)} يوم</Text>}

        {/* Username */}
        <View style={styles.fieldHeaderRow}>
          <Text style={[styles.label, { color: C.text }]}>اليوزر (@)</Text>
          {usernameRemaining > 0 && (
            <View style={[styles.cooldownBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D' }]}>
              <Clock size={12} color="#D97706" />
              <Text style={[styles.cooldownText, { color: '#D97706' }]}>{Math.ceil(usernameRemaining)} يوم</Text>
            </View>
          )}
        </View>
        <TextInput
          style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }, usernameRemaining > 0 && styles.inputDisabled]}
          value={username} onChangeText={(v) => setUsername(v.replace(/\s/g, '').toLowerCase())}
          placeholder="اختر معرّفاً فريداً" placeholderTextColor={C.textMuted}
          textAlign="right" autoCapitalize="none" editable={usernameRemaining === 0}
        />
        {usernameRemaining > 0 && <Text style={[styles.fieldHint, { color: C.textMuted }]}>يمكن التغيير بعد {Math.ceil(usernameRemaining)} يوم</Text>}

        {/* Country */}
        <Text style={[styles.label, { color: C.text }]}>الدولة</Text>
        <TouchableOpacity
          style={[styles.selectRow, { backgroundColor: C.input, borderColor: selectedCountry ? C.primary + '60' : C.inputBorder }]}
          onPress={() => setShowCountryPicker(true)}
          activeOpacity={0.8}
        >
          <ChevronDown size={16} color={selectedCountry ? C.primary : C.textMuted} />
          <Text style={[styles.selectText, { color: selectedCountry ? C.text : C.textMuted }]}>
            {selectedCountry ? selectedCountry.nameAr : 'اختر دولتك'}
          </Text>
          <Globe size={16} color={selectedCountry ? C.primary : C.textMuted} />
        </TouchableOpacity>

        {/* Phone */}
        <Text style={[styles.label, { color: C.text }]}>رقم الجوال</Text>
        <View style={[styles.phoneRow, { backgroundColor: C.input, borderColor: C.inputBorder }]}>
          <TextInput
            style={[styles.phoneInput, { color: C.text }]}
            value={phoneNumber}
            onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))}
            placeholder="اكتب رقم جوالك"
            placeholderTextColor={C.textMuted}
            keyboardType="phone-pad"
            textAlign="right"
          />
          <View style={[styles.codeBox, { backgroundColor: isDark ? 'rgba(0,200,83,0.08)' : '#E6F9EE', borderColor: isDark ? 'rgba(0,200,83,0.20)' : '#A7F3D0' }]}>
            <Phone size={13} color={C.primary} />
            <Text style={[styles.codeBoxText, { color: C.primary }]}>
              {selectedCountry ? selectedCountry.code : '+---'}
            </Text>
          </View>
        </View>

        {/* Role */}
        <Text style={[styles.label, { color: C.text }]}>نوع الحساب</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleChip, { backgroundColor: role === r.value ? (isDark ? `${C.primary}18` : C.primary) : (isDark ? C.card : '#F4F7FA'), borderColor: role === r.value ? C.primary : (isDark ? C.border : '#E8EDF2') }]}
              onPress={() => setRole(r.value)} activeOpacity={0.7}
            >
              <Text style={[styles.roleChipText, { color: role === r.value ? (isDark ? C.primary : '#fff') : C.textSecondary }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* City — only from selected country */}
        <Text style={[styles.label, { color: C.text }]}>المدينة</Text>
        {!selectedCountry && (
          <Text style={[styles.fieldHint, { color: C.textMuted, marginBottom: 4 }]}>اختر الدولة أولاً لعرض المدن</Text>
        )}
        <View style={styles.cityGrid}>
          {availableCities.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.cityChip, { backgroundColor: city === c ? (isDark ? `${C.primary}18` : C.primary) : (isDark ? C.card : '#F4F7FA'), borderColor: city === c ? C.primary : (isDark ? C.border : '#E8EDF2') }]}
              onPress={() => setCity(c)} activeOpacity={0.7}
            >
              <Text style={[styles.cityChipText, { color: city === c ? (isDark ? C.primary : '#fff') : C.textSecondary, fontWeight: city === c ? '600' : '400' }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: C.primary, shadowColor: C.primary }, saving && styles.btnDisabled]}
          onPress={handleSave} disabled={saving} activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color="#000" /> : <Text style={[styles.saveBtnText, { color: '#000' }]}>حفظ التعديلات</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md, borderBottomWidth: 1,
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
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  cameraBadge: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { fontSize: FontSizes.sm },

  fieldHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSizes.md, fontWeight: '700', textAlign: 'right' },
  input: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSizes.md, textAlign: 'right' },
  inputDisabled: { opacity: 0.5 },
  fieldHint: { fontSize: FontSizes.xs, textAlign: 'right', marginTop: -Spacing.sm / 2 },

  cooldownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  cooldownText: { fontSize: FontSizes.xs, fontWeight: '600' },

  selectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 52,
  },
  selectText: { flex: 1, fontSize: FontSizes.md, textAlign: 'right' },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, minHeight: 52,
  },
  phoneInput: { flex: 1, fontSize: FontSizes.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  codeBoxText: { fontSize: 14, fontWeight: '700' },

  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, alignItems: 'center' },
  roleChipText: { fontSize: FontSizes.md, fontWeight: '600' },

  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cityChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  cityChipText: { fontSize: FontSizes.sm },

  saveBtn: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: FontSizes.lg, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  countryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  codeBadge: { minWidth: 56, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  codeText: { fontSize: 13, fontWeight: '700' },
  countryItemName: { flex: 1, fontSize: 15, textAlign: 'right' },
});
