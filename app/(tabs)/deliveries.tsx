import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { Package, MapPin, Check, Clock, Truck } from 'lucide-react-native';
import type { DeliveryRequest } from '@/types/database';

export default function DeliveriesScreen() {
  const { profile } = useAuth();
  const { colors: C, isDark } = useTheme();
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'available' | 'my_deliveries'>('available');

  useEffect(() => {
    fetchRequests();
  }, [activeFilter]);

  const fetchRequests = async () => {
    if (!profile) return;
    setLoading(true);

    if (activeFilter === 'available') {
      const { data } = await supabase
        .from('delivery_requests')
        .select('*, posts(title, type, city, post_images(image_url)), profiles(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (data) setRequests(data as any);
    } else {
      const { data } = await supabase
        .from('delivery_requests')
        .select('*, posts(title, type, city, post_images(image_url)), profiles(full_name, phone)')
        .eq('agent_id', profile.id)
        .in('status', ['accepted', 'in_progress'])
        .order('created_at', { ascending: false });
      if (data) setRequests(data as any);
    }
    setLoading(false);
  };

  const acceptRequest = async (requestId: string) => {
    if (!profile) return;
    const { error } = await supabase
      .from('delivery_requests')
      .update({ agent_id: profile.id, status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (!error) fetchRequests();
  };

  const updateStatus = async (requestId: string, status: string) => {
    const { error } = await supabase
      .from('delivery_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (!error) fetchRequests();
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'accepted': return 'مقبول';
      case 'in_progress': return 'قيد التوصيل';
      case 'delivered': return 'تم التسليم';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return isDark ? '#F59E0B' : '#D97706';
      case 'accepted': return C.primary;
      case 'in_progress': return C.primaryBright ?? C.primary;
      case 'delivered': return isDark ? '#00A844' : '#166534';
      case 'cancelled': return C.error;
      default: return C.textSecondary;
    }
  };

  const cardBg = isDark ? '#111714' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E5E7EB';
  const filterInactiveBg = isDark ? '#1A2020' : '#FFFFFF';
  const filterInactiveBorder = isDark ? 'rgba(255,255,255,0.18)' : '#D1D5DB';

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.requestCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
        <Text style={[styles.postTitle, { color: C.text }]} numberOfLines={1}>{item.posts?.title}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.addressRow}>
          <MapPin size={14} color={C.primary} />
          <Text style={[styles.addressLabel, { color: C.textSecondary }]}>من:</Text>
          <Text style={[styles.addressValue, { color: C.text }]}>{item.pickup_address || item.posts?.city || 'غير محدد'}</Text>
        </View>
        <View style={styles.addressRow}>
          <MapPin size={14} color={C.error} />
          <Text style={[styles.addressLabel, { color: C.textSecondary }]}>إلى:</Text>
          <Text style={[styles.addressValue, { color: C.text }]}>{item.dropoff_address || 'غير محدد'}</Text>
        </View>
      </View>

      <View style={[styles.cardFooter, { borderTopColor: cardBorder }]}>
        <Text style={[styles.requesterName, { color: C.textSecondary }]}>العميل: {item.profiles?.full_name}</Text>
        {item.status === 'pending' && activeFilter === 'available' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: C.primary }]}
            onPress={() => acceptRequest(item.id)}
            activeOpacity={0.7}
          >
            <Check size={16} color="#000" />
            <Text style={styles.actionBtnText}>قبول</Text>
          </TouchableOpacity>
        )}
        {item.status === 'accepted' && activeFilter === 'my_deliveries' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: C.primary }]}
            onPress={() => updateStatus(item.id, 'in_progress')}
            activeOpacity={0.7}
          >
            <Truck size={14} color="#000" />
            <Text style={styles.actionBtnText}>بدء التوصيل</Text>
          </TouchableOpacity>
        )}
        {item.status === 'in_progress' && activeFilter === 'my_deliveries' && (
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: isDark ? '#00A844' : '#166534' }]}
            onPress={() => updateStatus(item.id, 'delivered')}
            activeOpacity={0.7}
          >
            <Check size={16} color="#FFF" />
            <Text style={[styles.actionBtnText, { color: '#FFF' }]}>تم التسليم</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.background, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
        <View style={styles.headerContent}>
          <Truck size={24} color={C.primary} />
          <Text style={[styles.headerTitle, { color: C.text }]}>التوصيلات</Text>
        </View>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>إدارة طلبات التوصيل</Text>
      </View>

      <View style={[styles.filterRow, { backgroundColor: C.background }]}>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilter === 'available'
              ? { backgroundColor: C.primary, borderColor: C.primary }
              : { backgroundColor: filterInactiveBg, borderColor: filterInactiveBorder },
          ]}
          onPress={() => setActiveFilter('available')}
          activeOpacity={0.7}
        >
          <Clock size={16} color={activeFilter === 'available' ? '#000' : C.text} />
          <Text style={[styles.filterText, { color: activeFilter === 'available' ? '#000' : C.text }]}>متاح</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilter === 'my_deliveries'
              ? { backgroundColor: C.primary, borderColor: C.primary }
              : { backgroundColor: filterInactiveBg, borderColor: filterInactiveBorder },
          ]}
          onPress={() => setActiveFilter('my_deliveries')}
          activeOpacity={0.7}
        >
          <Package size={16} color={activeFilter === 'my_deliveries' ? '#000' : C.text} />
          <Text style={[styles.filterText, { color: activeFilter === 'my_deliveries' ? '#000' : C.text }]}>توصيلاتي</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContent}>
          <Package size={48} color={C.textMuted} />
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>لا توجد طلبات توصيل</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: '700' },
  headerSub: { fontSize: FontSizes.sm, textAlign: 'right', marginTop: Spacing.xs },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  filterText: { fontSize: FontSizes.md, fontWeight: '600' },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: { fontSize: FontSizes.md },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: '700' },
  cardBody: { gap: Spacing.xs, paddingRight: Spacing.sm },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addressLabel: { fontSize: FontSizes.sm, fontWeight: '600' },
  addressValue: { fontSize: FontSizes.sm, flex: 1, textAlign: 'right' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  requesterName: { fontSize: FontSizes.sm },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: {
    color: '#000',
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
});
