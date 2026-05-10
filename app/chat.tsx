import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Send } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  pending?: boolean; // optimistic flag
}

interface ChatRoom {
  id: string;
  listing_id: string;
  owner_id: string;
  other_user_id: string;
  listing_title?: string;
}

export default function ChatScreen() {
  const { room } = useLocalSearchParams<{ room: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const C = colors;

  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Track temp IDs that we've already inserted optimistically
  const pendingIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 50);
  }, []);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (!err && data) {
      setMessages(data);
      scrollToBottom(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (!room) { setError('غرفة الدردشة غير موجودة'); setLoading(false); return; }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('يجب تسجيل الدخول أولاً'); setLoading(false); return; }
      setMyId(user.id);

      const { data: roomData, error: roomErr } = await supabase
        .from('chat_rooms')
        .select('id, listing_id, owner_id, other_user_id')
        .eq('id', room)
        .maybeSingle();
      if (roomErr || !roomData) {
        setError('لا يمكن الوصول إلى هذه المحادثة');
        setLoading(false);
        return;
      }

      const { data: listing } = await supabase
        .from('listings')
        .select('title')
        .eq('id', roomData.listing_id)
        .maybeSingle();
      setChatRoom({ ...roomData, listing_title: listing?.title ?? '' });

      await fetchMessages(room);
      setLoading(false);

      // Subscribe to new messages from the OTHER user (our own arrive via optimistic update)
      channelRef.current = supabase
        .channel(`chat_room_${room}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${room}`,
          },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) => {
              // If this is our own confirmed message, replace the pending optimistic one
              if (pendingIds.current.has(msg.id)) {
                pendingIds.current.delete(msg.id);
                return prev.map((m) =>
                  m.id === msg.id ? { ...msg, pending: false } : m
                );
              }
              // Skip if already present (duplicate safety)
              if (prev.find((m) => m.id === msg.id)) return prev;
              // Message from the other participant — append it
              return [...prev, msg];
            });
            scrollToBottom(true);
          }
        )
        .subscribe();
    };

    init();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [room, fetchMessages, scrollToBottom]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !room || !myId || sending) return;

    // 1. Clear input immediately
    setNewMessage('');
    setSending(true);

    // 2. Add optimistic message with a temp ID
    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      room_id: room,
      sender_id: myId,
      content: text,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);

    // 3. Persist to Supabase
    const { data: inserted, error: sendErr } = await supabase
      .from('chat_messages')
      .insert({ room_id: room, sender_id: myId, content: text })
      .select()
      .maybeSingle();

    setSending(false);

    if (sendErr || !inserted) {
      // Revert optimistic message and restore input
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(text);
      setError('فشل إرسال الرسالة، حاول مرة أخرى');
      return;
    }

    // 4. Replace temp message with confirmed one
    // Register the real ID so the realtime event doesn't add it again
    pendingIds.current.add(inserted.id);
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...inserted, pending: false } : m))
    );
    scrollToBottom(true);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        <View
          style={[
            styles.bubble,
            isMine
              ? {
                  backgroundColor: isDark ? `${C.primary}22` : C.primary,
                  borderColor: isDark ? C.primary : 'transparent',
                  borderWidth: isDark ? 1 : 0,
                  opacity: item.pending ? 0.6 : 1,
                }
              : {
                  backgroundColor: C.card,
                  borderColor: isDark ? C.cardBorder : '#E8EDF2',
                  borderWidth: 1,
                },
            isMine ? styles.bubbleMine : styles.bubbleOther,
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMine ? (isDark ? C.primary : '#fff') : C.text }]}>
            {item.content}
          </Text>
          <View style={styles.msgMeta}>
            {item.pending && (
              <ActivityIndicator size={10} color={isDark ? C.primary : 'rgba(255,255,255,0.7)'} style={{ marginLeft: 4 }} />
            )}
            <Text style={[styles.msgTime, { color: isMine ? (isDark ? `${C.primary}88` : 'rgba(255,255,255,0.7)') : C.textMuted }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (error && !chatRoom) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
          >
            <ArrowRight size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.text }]}>المحادثة</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={[styles.centered, { backgroundColor: C.background }]}>
          <Text style={{ color: C.error, fontSize: FontSizes.md, textAlign: 'center' }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = newMessage.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}
        >
          <ArrowRight size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
            {chatRoom?.listing_title || 'محادثة'}
          </Text>
          <Text style={[styles.headerSub, { color: C.textSecondary }]}>محادثة خاصة</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Error banner (non-blocking) */}
        {!!error && (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FFF5F5', borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Text style={{ color: '#EF4444', fontSize: FontSizes.sm, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.msgList, { backgroundColor: C.background }]}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: C.textMuted }]}>ابدأ المحادثة الآن</Text>
            </View>
          }
          // Scroll to bottom whenever new content is added
          onContentSizeChange={() => scrollToBottom(false)}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        />

        {/* Input row */}
        <View style={[styles.inputRow, { backgroundColor: C.navBar, borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend ? (isDark ? `${C.primary}20` : C.primary) : (isDark ? C.card : '#F0F4F0'),
                borderColor: canSend ? C.primary : 'transparent',
                borderWidth: canSend ? 1 : 0,
              },
            ]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.75}
          >
            {sending
              ? <ActivityIndicator size="small" color={isDark ? C.primary : '#fff'} />
              : <Send size={18} color={canSend ? (isDark ? C.primary : '#fff') : C.textMuted} />
            }
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? C.card : '#F7FAF8', borderColor: isDark ? C.cardBorder : '#DCE8DC', color: C.text },
            ]}
            placeholder="اكتب رسالة..."
            placeholderTextColor={C.textMuted}
            value={newMessage}
            onChangeText={(t) => { setNewMessage(t); if (error) setError(''); }}
            multiline
            textAlign="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  headerSub: { fontSize: FontSizes.xs, marginTop: 1 },

  errorBanner: {
    borderWidth: 1, marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderRadius: 10, padding: 8,
  },

  msgList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    flexGrow: 1,
  },
  msgRow: { flexDirection: 'row', marginVertical: 3 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: FontSizes.md, lineHeight: 22 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 4 },
  msgTime: { fontSize: FontSizes.xs },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: FontSizes.md },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSizes.md,
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
});
