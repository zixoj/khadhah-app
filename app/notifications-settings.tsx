import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Bell, MessageCircle, Truck, Megaphone, Check } from 'lucide-react-native';

interface Settings {
  notify_messages: boolean;
  notify_delivery: boolean;
  notify_listings: boolean;
  messages_in_app_only: boolean;
}

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [settings, setSettings] = useState<Settings>({
    notify_messages: true,
    notify_delivery: true,
    notify_listings: true,
    messages_in_app_only: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', profile!.id).maybeSingle();
    if (data) {
      setSettings({
        notify_messages: data.notify_messages,
        notify_delivery: data.notify_delivery,
        notify_listings: data.notify_listings,
        messages_in_app_only: data.messages_in_app_only,
      });
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from('user_settings').select('id').eq('user_id', profile!.id).maybeSingle();
    if (existing) {
      await supabase.from('user_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('user_id', profile!.id);
    } else {
      await supabase.from('user_settings').insert({ user_id: profile!.id, ...settings });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggle = (key: keyof Settings) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>إعدادات الإشعارات</Text>
        <TouchableOpacity
          onPress={saveSettings}
          disabled={saving}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          {saving
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Check size={20} color={C.primary} />
          }
        </TouchableOpacity>
      </View>

      {saved && (
        <View style={[styles.savedBanner, { backgroundColor: isDark ? 'rgba(0,200,83,0.12)' : '#F0FDF4', borderColor: isDark ? 'rgba(0,200,83,0.25)' : '#86EFAC' }]}>
          <Text style={[styles.savedBannerText, { color: isDark ? '#00C853' : '#166534' }]}>تم حفظ الإعدادات</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: isDark ? '#161616' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF2' }]}>
          <ToggleRow
            icon={<MessageCircle size={20} color={C.primary} />}
            label="إشعارات الرسائل"
            desc="عند وصول رسالة جديدة"
            value={settings.notify_messages}
            onToggle={() => toggle('notify_messages')}
            colors={C} isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8' }]} />
          <ToggleRow
            icon={<Truck size={20} color={C.primary} />}
            label="إشعارات المندوب"
            desc="عند طلب مندوب توصيل"
            value={settings.notify_delivery}
            onToggle={() => toggle('notify_delivery')}
            colors={C} isDark={isDark}
          />
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F0F4F8' }]} />
          <ToggleRow
            icon={<Megaphone size={20} color={C.primary} />}
            label="إشعارات الإعلانات"
            desc="عند نشر إعلان أو تحديثه"
            value={settings.notify_listings}
            onToggle={() => toggle('notify_listings')}
            colors={C} isDark={isDark}
          />
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? '#161616' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF2' }]}>
          <ToggleRow
            icon={<Bell size={20} color={C.primary} />}
            label="الرسائل داخل التطبيق فقط"
            desc="لا تستقبل رسائل خارج التطبيق"
            value={settings.messages_in_app_only}
            onToggle={() => toggle('messages_in_app_only')}
            colors={C} isDark={isDark}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: C.primary, shadowColor: C.primary }]}
          onPress={saveSettings}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  icon, label, desc, value, onToggle, colors: C, isDark,
}: {
  icon: React.ReactNode; label: string; desc: string;
  value: boolean; onToggle: () => void; colors: any; isDark: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: isDark ? '#333' : '#E0E0E0', true: `${C.primary}88` }}
        thumbColor={value ? C.primary : (isDark ? '#666' : '#AAA')}
      />
      <View style={styles.toggleText}>
        <Text style={[styles.toggleLabel, { color: C.text }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: C.textSecondary }]}>{desc}</Text>
      </View>
      <View style={[styles.toggleIcon, { backgroundColor: isDark ? 'rgba(0,200,83,0.10)' : '#F0FDF4' }]}>{icon}</View>
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
  savedBanner: {
    borderWidth: 1, borderRadius: BorderRadius.md, margin: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  savedBannerText: { fontSize: FontSizes.sm, fontWeight: '600', textAlign: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: {
    borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden',
  },
  divider: { height: 1 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
  },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, textAlign: 'right', marginTop: 2 },
  toggleIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: {
    borderRadius: 14, paddingVertical: Spacing.md + 2, alignItems: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 4,
  },
  saveBtnText: { color: '#000', fontSize: FontSizes.lg, fontWeight: '700' },
});
