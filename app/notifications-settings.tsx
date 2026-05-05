import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
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
  const [settings, setSettings] = useState<Settings>({
    notify_messages: true,
    notify_delivery: true,
    notify_listings: true,
    messages_in_app_only: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    Alert.alert('تم', 'تم حفظ إعدادات الإشعارات');
  };

  const toggle = (key: keyof Settings) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>إعدادات الإشعارات</Text>
        <TouchableOpacity onPress={saveSettings} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={Colors.primary[600]} /> : <Check size={24} color={Colors.primary[600]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <ToggleRow
            icon={<MessageCircle size={20} color={Colors.primary[600]} />}
            label="إشعارات الرسائل"
            desc="عند وصول رسالة جديدة"
            value={settings.notify_messages}
            onToggle={() => toggle('notify_messages')}
          />
          <Divider />
          <ToggleRow
            icon={<Truck size={20} color={Colors.primary[600]} />}
            label="إشعارات المندوب"
            desc="عند طلب مندوب توصيل"
            value={settings.notify_delivery}
            onToggle={() => toggle('notify_delivery')}
          />
          <Divider />
          <ToggleRow
            icon={<Megaphone size={20} color={Colors.primary[600]} />}
            label="إشعارات الإعلانات"
            desc="عند نشر إعلان أو تحديثه"
            value={settings.notify_listings}
            onToggle={() => toggle('notify_listings')}
          />
        </View>

        <View style={styles.card}>
          <ToggleRow
            icon={<Bell size={20} color={Colors.primary[600]} />}
            label="الرسائل داخل التطبيق فقط"
            desc="لا تستقبل رسائل خارج التطبيق"
            value={settings.messages_in_app_only}
            onToggle={() => toggle('messages_in_app_only')}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ToggleRow({ icon, label, desc, value, onToggle }: { icon: React.ReactNode; label: string; desc: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.neutral[200], true: Colors.primary[400] }}
        thumbColor={value ? Colors.primary[600] : Colors.neutral[400]}
      />
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <View style={styles.toggleIcon}>{icon}</View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.border }} />;
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
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
  },
  toggleText: { flex: 1, alignItems: 'flex-end' },
  toggleLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '600' },
  toggleDesc: { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  toggleIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primary[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, alignItems: 'center',
    shadowColor: Colors.primary[600], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSizes.lg, fontWeight: '700' },
});
