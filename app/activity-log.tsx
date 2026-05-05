import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Activity, Plus, Trash2, Zap, Wallet, User, Edit3 } from 'lucide-react-native';

interface LogItem {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  listing_deleted: <Trash2 size={18} color={Colors.error[500]} />,
  listing_boosted: <Zap size={18} color={Colors.accent[500]} />,
  wallet_topup: <Wallet size={18} color={Colors.primary[600]} />,
  profile_updated: <Edit3 size={18} color={Colors.primary[600]} />,
};

const ACTION_COLORS: Record<string, string> = {
  listing_deleted: Colors.error[50],
  listing_boosted: Colors.accent[50],
  wallet_topup: Colors.primary[50],
  profile_updated: Colors.primary[50],
};

export default function ActivityLogScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setLogs(data);
    setLoading(false);
  };

  const renderItem = ({ item }: { item: LogItem }) => {
    const icon = ACTION_ICONS[item.action] || <Activity size={18} color={Colors.primary[600]} />;
    const bgColor = ACTION_COLORS[item.action] || Colors.primary[50];
    return (
      <View style={styles.logItem}>
        <View style={[styles.logIcon, { backgroundColor: bgColor }]}>{icon}</View>
        <View style={styles.logBody}>
          <Text style={styles.logDesc}>{item.description}</Text>
          <Text style={styles.logDate}>
            {new Date(item.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>سجل النشاط</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary[600]} /></View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Activity size={52} color={Colors.neutral[300]} />
              <Text style={styles.emptyText}>لا يوجد نشاط بعد</Text>
            </View>
          }
        />
      )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: FontSizes.md, color: Colors.textSecondary },
  listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  logItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  logIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logBody: { flex: 1 },
  logDesc: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500', textAlign: 'right' },
  logDate: { fontSize: FontSizes.xs, color: Colors.neutral[400], textAlign: 'right', marginTop: 2 },
});
