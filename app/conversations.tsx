import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { ChevronLeft, MessageSquare, User } from 'lucide-react-native';

interface ConversationRow {
  id: string;
  listing_id: string;
  owner_id: string;
  other_user_id: string;
  listing_title: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return `منذ ${Math.floor(diff / 86400)} ي`;
}

export default function ConversationsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    if (!profile) return;

    const { data: rawRooms } = await supabase
      .from('chat_rooms')
      .select('id, listing_id, owner_id, other_user_id, created_at')
      .or(`owner_id.eq.${profile.id},other_user_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (!rawRooms || rawRooms.length === 0) {
      setRooms([]);
      setLoading(false);
      return;
    }

    // Parallel fetch: listing titles, other user profiles, last messages
    const enriched: ConversationRow[] = await Promise.all(
      rawRooms.map(async (room) => {
        const otherId = room.owner_id === profile.id ? room.other_user_id : room.owner_id;

        const [listingRes, profileRes, msgRes] = await Promise.all([
          supabase.from('listings').select('title').eq('id', room.listing_id).maybeSingle(),
          supabase.from('profiles').select('full_name, avatar_url').eq('id', otherId).maybeSingle(),
          supabase
            .from('chat_messages')
            .select('content, created_at')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        return {
          id: room.id,
          listing_id: room.listing_id,
          owner_id: room.owner_id,
          other_user_id: room.other_user_id,
          listing_title: listingRes.data?.title ?? '',
          other_name: profileRes.data?.full_name ?? 'مستخدم',
          other_avatar: profileRes.data?.avatar_url ?? null,
          last_message: msgRes.data?.content ?? null,
          last_message_at: msgRes.data?.created_at ?? null,
        };
      })
    );

    // Sort by last message time descending
    enriched.sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return 0;
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setRooms(enriched);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const renderItem = ({ item }: { item: ConversationRow }) => (
    <TouchableOpacity
      style={styles.roomRow}
      onPress={() => router.push(`/chat?room=${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.avatarWrap}>
        {item.other_avatar ? (
          <Image source={{ uri: item.other_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={22} color={Colors.neutral[400]} />
          </View>
        )}
      </View>

      <View style={styles.roomBody}>
        <View style={styles.roomTop}>
          <Text style={styles.roomTime} numberOfLines={1}>
            {item.last_message_at ? timeAgo(item.last_message_at) : ''}
          </Text>
          <Text style={styles.roomName} numberOfLines={1}>{item.other_name}</Text>
        </View>
        <View style={styles.roomBottom}>
          <Text style={styles.roomListing} numberOfLines={1}>{item.listing_title}</Text>
        </View>
        {item.last_message ? (
          <Text style={styles.lastMsg} numberOfLines={1}>{item.last_message}</Text>
        ) : (
          <Text style={styles.noMsg}>ابدأ المحادثة</Text>
        )}
      </View>

      <ChevronLeft size={18} color={Colors.neutral[300]} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>محادثاتي</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={rooms.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MessageSquare size={52} color={Colors.neutral[200]} />
              <Text style={styles.emptyTitle}>لا توجد محادثات بعد</Text>
              <Text style={styles.emptySub}>ستظهر محادثاتك هنا بعد القبول على عرض أو حجز</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: { paddingBottom: 100 },
  emptyContainer: { flexGrow: 1 },

  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, gap: Spacing.md,
  },
  avatarWrap: { flexShrink: 0 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },

  roomBody: { flex: 1, gap: 3 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, flex: 1, textAlign: 'right' },
  roomTime: { fontSize: FontSizes.xs, color: Colors.neutral[400], flexShrink: 0 },
  roomBottom: {},
  roomListing: {
    fontSize: FontSizes.xs, color: Colors.primary[600],
    fontWeight: '600', textAlign: 'right',
  },
  lastMsg: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'right' },
  noMsg: { fontSize: FontSizes.sm, color: Colors.neutral[300], textAlign: 'right', fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 82 },

  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingTop: 80,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
