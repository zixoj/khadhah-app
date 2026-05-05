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
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { Package, MapPin, Check, Clock, Truck } from 'lucide-react-native';
import type { DeliveryRequest } from '@/types/database';

export default function DeliveriesScreen() {
  const { profile } = useAuth();
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
      case 'pending': return Colors.accent[500];
      case 'accepted': return Colors.primary[500];
      case 'in_progress': return Colors.primary[600];
      case 'delivered': return Colors.primary[700];
      case 'cancelled': return Colors.error[500];
      default: return Colors.neutral[500];
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '18' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
        <Text style={styles.postTitle} numberOfLines={1}>{item.posts?.title}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.addressRow}>
          <MapPin size={14} color={Colors.primary[500]} />
          <Text style={styles.addressLabel}>من:</Text>
          <Text style={styles.addressValue}>{item.pickup_address || item.posts?.city || 'غير محدد'}</Text>
        </View>
        <View style={styles.addressRow}>
          <MapPin size={14} color={Colors.error[400]} />
          <Text style={styles.addressLabel}>إلى:</Text>
          <Text style={styles.addressValue}>{item.dropoff_address || 'غير محدد'}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.requesterName}>العميل: {item.profiles?.full_name}</Text>
        {item.status === 'pending' && activeFilter === 'available' && (
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => acceptRequest(item.id)}
            activeOpacity={0.7}
          >
            <Check size={16} color={Colors.white} />
            <Text style={styles.acceptBtnText}>قبول</Text>
          </TouchableOpacity>
        )}
        {item.status === 'accepted' && activeFilter === 'my_deliveries' && (
          <TouchableOpacity
            style={styles.progressBtn}
            onPress={() => updateStatus(item.id, 'in_progress')}
            activeOpacity={0.7}
          >
            <Truck size={14} color={Colors.white} />
            <Text style={styles.progressBtnText}>بدء التوصيل</Text>
          </TouchableOpacity>
        )}
        {item.status === 'in_progress' && activeFilter === 'my_deliveries' && (
          <TouchableOpacity
            style={styles.deliveredBtn}
            onPress={() => updateStatus(item.id, 'delivered')}
            activeOpacity={0.7}
          >
            <Check size={16} color={Colors.white} />
            <Text style={styles.progressBtnText}>تم التسليم</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Truck size={24} color={Colors.white} />
          <Text style={styles.headerTitle}>التوصيلات</Text>
        </View>
        <Text style={styles.headerSub}>إدارة طلبات التوصيل</Text>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilter === 'available' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('available')}
          activeOpacity={0.7}
        >
          <Clock size={16} color={activeFilter === 'available' ? Colors.white : Colors.primary[600]} />
          <Text style={[styles.filterText, activeFilter === 'available' && styles.filterTextActive]}>متاح</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilter === 'my_deliveries' && styles.filterBtnActive]}
          onPress={() => setActiveFilter('my_deliveries')}
          activeOpacity={0.7}
        >
          <Package size={16} color={activeFilter === 'my_deliveries' ? Colors.white : Colors.primary[600]} />
          <Text style={[styles.filterText, activeFilter === 'my_deliveries' && styles.filterTextActive]}>توصيلاتي</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContent}>
          <Package size={48} color={Colors.neutral[300]} />
          <Text style={styles.emptyText}>لا توجد طلبات توصيل</Text>
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary[700],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSub: {
    fontSize: FontSizes.sm,
    color: Colors.primary[200],
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
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
    borderColor: Colors.primary[200],
    backgroundColor: Colors.white,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  filterText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  filterTextActive: {
    color: Colors.white,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  requestCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  cardBody: {
    gap: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  addressValue: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  requesterName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[600],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  acceptBtnText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  progressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[500],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  progressBtnText: {
    color: Colors.white,
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  deliveredBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[700],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});
