import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, Trash2, Ban, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AdminHeader } from '@/components/AdminHeader';

const C = {
  bg: '#050B08', surface: '#0D1410', card: '#111714',
  primary: '#00C853', text: '#FFFFFF', sub: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.28)', border: 'rgba(0,200,83,0.14)',
  red: '#FF3B30', orange: '#FF9F0A', blue: '#0A84FF',
};

interface ReportedRoom {
  id: string;
  listing_id: string;
  owner_id: string;
  other_user_id: string;
  created_at: string;
  report_count: number;
  owner: { full_name: string } | null;
  other_user: { full_name: string } | null;
  listing: { title: string } | null;
}

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: { full_name: string } | null;
}

export default function AdminConversations() {
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<ReportedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ReportedRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRooms = useCallback(async () => {
    // Only fetch chat rooms that are linked to at least one report
    const { data: reportRoomIds } = await supabase
      .from('listing_reports')
      .select('chat_room_id')
      .not('chat_room_id', 'is', null);

    if (!reportRoomIds || reportRoomIds.length === 0) {
      setRooms([]);
      return;
    }

    const ids = [...new Set(reportRoomIds.map(r => r.chat_room_id).filter(Boolean))];

    const { data } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        owner:profiles!chat_rooms_owner_id_fkey(full_name),
        other_user:profiles!chat_rooms_other_user_id_fkey(full_name),
        listing:listings(title)
      `)
      .in('id', ids)
      .order('created_at', { ascending: false });

    // Attach report counts
    const roomsWithCounts = await Promise.all(
      ((data as ReportedRoom[]) ?? []).map(async (room) => {
        const { count } = await supabase
          .from('listing_reports')
          .select('*', { count: 'exact', head: true })
          .eq('chat_room_id', room.id);
        return { ...room, report_count: count ?? 0 };
      })
    );

    setRooms(roomsWithCounts);
  }, []);

  useEffect(() => {
    fetchRooms().finally(() => setLoading(false));
  }, [fetchRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, [fetchRooms]);

  const openRoom = async (room: ReportedRoom) => {
    setSelectedRoom(room);
    setMessagesLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(full_name)')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) ?? []);
    setMessagesLoading(false);
  };

  const handleDeleteMessage = async (msgId: string) => {
    Alert.alert('حذف الرسالة', 'هل تريد حذف هذه الرسالة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive', onPress: async () => {
          await supabase.from('chat_messages').delete().eq('id', msgId);
          setMessages(prev => prev.filter(m => m.id !== msgId));
        },
      },
    ]);
  };

  const handleBanUser = async (userId: string, name: string) => {
    Alert.alert('حظر المستخدم', `هل تريد حظر ${name}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حظر', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          const { data, error } = await supabase.rpc('admin_ban_user', { p_user_id: userId, p_reason: 'انتهاك في المحادثة' });
          setActionLoading(false);
          if (error || !data?.success) Alert.alert('خطأ', 'فشل الحظر');
          else Alert.alert('تم', 'تم حظر المستخدم');
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AdminHeader title="مراقبة المحادثات" subtitle="المحادثات المُبلَّغ عنها فقط" />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {rooms.length === 0 && (
            <View style={styles.empty}>
              <MessageSquare size={40} color={C.muted} />
              <Text style={styles.emptyText}>لا توجد محادثات مُبلَّغ عنها</Text>
            </View>
          )}
          {rooms.map(room => (
            <TouchableOpacity key={room.id} style={styles.card} onPress={() => openRoom(room)} activeOpacity={0.82}>
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}><MessageSquare size={18} color={C.orange} /></View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{room.listing?.title ?? 'إعلان محذوف'}</Text>
                  <Text style={styles.cardSub}>{room.owner?.full_name ?? '—'} ↔ {room.other_user?.full_name ?? '—'}</Text>
                </View>
                <View style={styles.reportBadge}>
                  <Text style={styles.reportBadgeText}>{room.report_count} بلاغ</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Messages modal */}
      <Modal visible={!!selectedRoom} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedRoom(null)}>
        {selectedRoom && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedRoom.listing?.title ?? 'محادثة'}</Text>
                <Text style={styles.modalSub}>{selectedRoom.owner?.full_name} ↔ {selectedRoom.other_user?.full_name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.modalClose}>
                <X size={20} color={C.sub} />
              </TouchableOpacity>
            </View>

            {/* Ban user quick actions */}
            <View style={styles.quickBans}>
              <TouchableOpacity
                style={styles.banBtn}
                onPress={() => handleBanUser(selectedRoom.owner_id, selectedRoom.owner?.full_name ?? '')}
                disabled={actionLoading}
              >
                <Ban size={14} color={C.red} />
                <Text style={styles.banBtnText}>حظر {selectedRoom.owner?.full_name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.banBtn}
                onPress={() => handleBanUser(selectedRoom.other_user_id, selectedRoom.other_user?.full_name ?? '')}
                disabled={actionLoading}
              >
                <Ban size={14} color={C.red} />
                <Text style={styles.banBtnText}>حظر {selectedRoom.other_user?.full_name}</Text>
              </TouchableOpacity>
            </View>

            {messagesLoading ? (
              <View style={styles.center}><ActivityIndicator color={C.primary} /></View>
            ) : (
              <ScrollView
                style={styles.messagesList}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 && <Text style={styles.emptyText}>لا توجد رسائل</Text>}
                {messages.map(msg => (
                  <View key={msg.id} style={styles.msgRow}>
                    <View style={styles.msgBubble}>
                      <Text style={styles.msgSender}>{msg.sender?.full_name ?? '—'}</Text>
                      <Text style={styles.msgContent}>{msg.content}</Text>
                      <Text style={styles.msgTime}>{new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <TouchableOpacity style={styles.deleteMsg} onPress={() => handleDeleteMessage(msg.id)}>
                      <Trash2 size={14} color={C.red} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: C.muted, fontSize: 16, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.orange + '18', justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  cardSub: { color: C.sub, fontSize: 12 },
  reportBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: C.red + '20', borderWidth: 1, borderColor: C.red + '40' },
  reportBadgeText: { color: C.red, fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  modalSub: { color: C.sub, fontSize: 12, marginTop: 2 },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  quickBans: { flexDirection: 'row', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  banBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.red + '12', borderWidth: 1, borderColor: C.red + '30' },
  banBtnText: { color: C.red, fontSize: 12, fontWeight: '600', flex: 1 },
  messagesList: { flex: 1 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgBubble: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, gap: 4 },
  msgSender: { color: C.primary, fontSize: 12, fontWeight: '700' },
  msgContent: { color: C.text, fontSize: 14, lineHeight: 20 },
  msgTime: { color: C.muted, fontSize: 11, textAlign: 'right' },
  deleteMsg: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.red + '15', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
});
