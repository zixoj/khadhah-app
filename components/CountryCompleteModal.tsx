import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, Phone, ChevronDown, X, Check } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, type Country } from '@/lib/countries';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  visible: boolean;
  onComplete: () => void;
}

export default function CountryCompleteModal({ visible, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { colors: C, isDark } = useTheme();

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhone = selectedCountry
    ? `${selectedCountry.code}${phoneNumber.replace(/^0/, '')}`
    : phoneNumber;

  const handleSave = async () => {
    if (!selectedCountry) { setError('الرجاء اختيار الدولة'); return; }
    if (!phoneNumber.trim()) { setError('الرجاء إدخال رقم الجوال'); return; }
    if (/[a-zA-Z]/.test(phoneNumber)) { setError('رقم الجوال يجب أن يحتوي على أرقام فقط'); return; }
    if (!profile?.id) return;

    setSaving(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc('update_profile_fields', {
      p_country: selectedCountry.nameEn,
      p_country_code: selectedCountry.code,
      p_phone_number: phoneNumber.trim(),
      p_full_phone_number: fullPhone,
      p_phone: fullPhone,
    });

    if (rpcErr) {
      setError(rpcErr.message);
      setSaving(false);
      return;
    }

    const result = data as { success: boolean; reason?: string };
    if (!result.success) {
      setError(result.reason === 'phone_taken' ? 'رقم الجوال هذا مستخدم بالفعل' : 'حدث خطأ، حاول مرة أخرى');
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    onComplete();
  };

  const bg = isDark ? '#0D1410' : '#fff';
  const cardBg = isDark ? '#111714' : '#F8FAF9';
  const borderCol = isDark ? 'rgba(0,200,83,0.18)' : '#D1E8D8';
  const textCol = isDark ? '#fff' : '#0A1A10';
  const subCol = isDark ? 'rgba(255,255,255,0.55)' : '#5A7A65';
  const mutedCol = isDark ? 'rgba(255,255,255,0.28)' : '#9AB0A2';
  const primary = '#00C853';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Country picker sheet */}
        {showPicker && (
          <View style={[styles.pickerSheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: borderCol }]}>
              <Text style={[styles.pickerTitle, { color: textCol }]}>اختر دولتك</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F2' }]}>
                <X size={18} color={textCol} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.nameEn}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, { borderBottomColor: borderCol }, selectedCountry?.nameEn === item.nameEn && { backgroundColor: isDark ? 'rgba(0,200,83,0.08)' : '#ECFDF5' }]}
                  onPress={() => { setSelectedCountry(item); setShowPicker(false); setError(null); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.codeBadge, { backgroundColor: isDark ? 'rgba(0,200,83,0.10)' : '#E6F9EE', borderColor: isDark ? 'rgba(0,200,83,0.20)' : '#A7F3D0' }]}>
                    <Text style={[styles.codeText, { color: primary }]}>{item.code}</Text>
                  </View>
                  <Text style={[styles.countryName, { color: textCol }, selectedCountry?.nameEn === item.nameEn && { color: primary, fontWeight: '700' }]}>
                    {item.nameAr}
                  </Text>
                  {selectedCountry?.nameEn === item.nameEn && (
                    <Check size={16} color={primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Main card */}
        {!showPicker && (
          <View style={[styles.card, { backgroundColor: bg, paddingBottom: insets.bottom + 24 }]}>
            {/* Header */}
            <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(0,200,83,0.10)' : '#ECFDF5' }]}>
              <Globe size={32} color={primary} />
            </View>
            <Text style={[styles.title, { color: textCol }]}>أكمل بياناتك</Text>
            <Text style={[styles.subtitle, { color: subCol }]}>
              يرجى إكمال بيانات الدولة ورقم الجوال قبل نشر الإعلان.
            </Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: isDark ? 'rgba(255,68,68,0.10)' : '#FFF5F5', borderColor: isDark ? 'rgba(255,68,68,0.3)' : '#FECACA' }]}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Country */}
            <Text style={[styles.label, { color: subCol }]}>الدولة</Text>
            <TouchableOpacity
              style={[styles.selectRow, { backgroundColor: cardBg, borderColor: selectedCountry ? primary + '60' : borderCol }]}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.8}
            >
              <ChevronDown size={16} color={selectedCountry ? primary : mutedCol} />
              <Text style={[styles.selectText, { color: selectedCountry ? textCol : mutedCol }]}>
                {selectedCountry ? selectedCountry.nameAr : 'اختر دولتك'}
              </Text>
              <Globe size={16} color={selectedCountry ? primary : mutedCol} />
            </TouchableOpacity>

            {/* Phone */}
            <Text style={[styles.label, { color: subCol }]}>رقم الجوال</Text>
            <View style={[styles.phoneRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <TextInput
                style={[styles.phoneInput, { color: textCol }]}
                placeholder="اكتب رقم جوالك"
                placeholderTextColor={mutedCol}
                value={phoneNumber}
                onChangeText={(t) => { setPhoneNumber(t.replace(/[^0-9]/g, '')); setError(null); }}
                keyboardType="phone-pad"
                textAlign="right"
              />
              <View style={[styles.codeBox, { backgroundColor: isDark ? 'rgba(0,200,83,0.08)' : '#E6F9EE', borderColor: isDark ? 'rgba(0,200,83,0.20)' : '#A7F3D0' }]}>
                <Phone size={13} color={primary} />
                <Text style={[styles.codeBox_text, { color: primary }]}>
                  {selectedCountry ? selectedCountry.code : '+---'}
                </Text>
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: primary, opacity: saving ? 0.75 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.saveBtnText}>حفظ والمتابعة</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 28,
    gap: 12,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    alignSelf: 'center', justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  errorBox: {
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'right', fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  selectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, minHeight: 52,
  },
  selectText: { flex: 1, fontSize: 15, textAlign: 'right' },

  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 10, minHeight: 52,
  },
  phoneInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
  },
  codeBox_text: { fontSize: 14, fontWeight: '700' },

  saveBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#00C853', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 5,
  },
  saveBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },

  // Picker sheet
  pickerSheet: {
    flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: 80,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  pickerTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  codeBadge: {
    minWidth: 56, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, alignItems: 'center',
  },
  codeText: { fontSize: 13, fontWeight: '700' },
  countryName: { flex: 1, fontSize: 15, textAlign: 'right' },
});
