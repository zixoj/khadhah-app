import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, Activity, Trash2, User, Edit3 } from 'lucide-react-native';

interface LogItem {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

export default function ActivityLogScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors: C, isDark } = useTheme();
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'listing_deleted': return <Trash2 size={18} color={C.error} />;
      case 'profile_updated': return <Edit3 size={18} color={C.primary} />;
      default: return <Activity size={18} color={C.primary} />;
    }
  };

  const getActionBg = (action: string): string => {
    switch (action) {
      case 'listing_deleted': return isDark ? 'rgba(255,59,48,0.12)' : '#FFF5F5';
      case 'profile_updated': return isDark ? 'rgba(0,200,83,0.12)' : '#F0FDF4';
      default: return isDark ? 'rgba(0,200,83,0.08)' : '#F4F7FA';
    }
  };

  const renderItem = ({ item }: { item: LogItem }) => (
    <View style={[styles.logItem, { backgroundColor: isDark ? '#161616' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF2' }]}>
      <View style={[styles.logIcon, { backgroundColor: getActionBg(item.action) }]}>
        {getActionIcon(item.action)}
      </View>
      <View style={styles.logBody}>
        <Text style={[styles.logDesc, { color: C.text }]}>{item.description}</Text>
        <Text style={[styles.logDate, { color: C.textMuted }]}>
          {new Date(item.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.navBar, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          <ChevronLeft size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.text }]}>سجل النشاط</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
                <Activity size={40} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>لا يوجد نشاط بعد</Text>
            </View>
          }
        />
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
  navIconBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingTop: 80 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSizes.md },
  listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 },
  logItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md,
  },
  logIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logBody: { flex: 1 },
  logDesc: { fontSize: FontSizes.md, fontWeight: '500', textAlign: 'right' },
  logDate: { fontSize: FontSizes.xs, textAlign: 'right', marginTop: 2 },
});
