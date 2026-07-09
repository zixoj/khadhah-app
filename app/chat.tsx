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
import { ArrowRight, Send, RotateCcw, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

const MAX_MESSAGE_LENGTH = 1000;

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
  // When failed, preserve original text for retry
  _retryText?: string;
}

interface ChatRoom {
  id: string;
  listing_id: string;
  owner_id: string;
  other_user_id: string;
  listing_title?: string;
}

// Merges two message arrays: deduplicates by id, sorts by created_at ascending.
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map<string, Message>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) {
    // Prefer non-pending/non-failed version if IDs match
    const prev = map.get(m.id);
    if (!prev || (prev.pending && !m.pending) || (prev.failed && !m.failed)) {
      map.set(m.id, m);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
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
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Maps tempId → real confirmed id to prevent realtime duplicates
  const tempToRealId = useRef<Map<string, string>>(new Map());
  // Set of real IDs we've already confirmed so realtime doesn't re-add them
  const confirmedIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((animated = true) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
      scrollTimerRef.current = null;
    }, 50);
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(''), 4000);
  }, []);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (!err && data) {
      setMessages((prev) => mergeMessages(prev, data as Message[]));
      scrollToBottom(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (!room) { showError('غرفة الدردشة غير موجودة'); setLoading(false); return; }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { showError('يجب تسجيل الدخول أولاً'); setLoading(false); return; }
      setMyId(user.id);

      const { data: roomData, error: roomErr } = await supabase
        .from('chat_rooms')
        .select('id, listing_id, owner_id, other_user_id')
        .eq('id', room)
        .maybeSingle();
      if (roomErr || !roomData) {
        showError('لا يمكن الوصول إلى هذه المحادثة');
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
            // Skip if we already handled this confirmed ID
            if (confirmedIds.current.has(msg.id)) return;
            confirmedIds.current.add(msg.id);
            setMessages((prev) => mergeMessages(prev, [{ ...msg, pending: false }]));
            scrollToBottom(true);
          }
        )
        .subscribe();
    };

    init();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [room, fetchMessages, scrollToBottom, showError]);

  const doSend = useCallback(async (text: string, replaceTempId?: string) => {
    if (!text || !room || !myId) return;
    setSending(true);

    const tempId = replaceTempId ?? `temp_${Date.now()}_${Math.random()}`;

    if (!replaceTempId) {
      // New optimistic message
      const optimistic: Message = {
        id: tempId,
        room_id: room,
        sender_id: myId,
        content: text,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => mergeMessages(prev, [optimistic]));
      scrollToBottom(true);
    } else {
      // Retry: reset failed state back to pending
      setMessages((prev) =>
        prev.map((m) => m.id === replaceTempId ? { ...m, pending: true, failed: false } : m)
      );
    }

    const { data: inserted, error: sendErr } = await supabase
      .from('chat_messages')
      .insert({ room_id: room, sender_id: myId, content: text })
      .select()
      .maybeSingle();

    setSending(false);

    if (sendErr || !inserted) {
      // Mark the optimistic message as failed instead of removing it
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true, _retryText: text } : m
        )
      );
      showError('فشل إرسال الرسالة، اضغط على الرسالة للإعادة');
      return;
    }

    // Register real ID so realtime doesn't duplicate it
    confirmedIds.current.add(inserted.id);
    tempToRealId.current.set(tempId, inserted.id);

    // Replace temp message with confirmed one
    setMessages((prev) =>
      prev
        .map((m) => (m.id === tempId ? { ...inserted, pending: false, failed: false } : m))
        .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i) // safety dedup
    );
    scrollToBottom(true);
  }, [room, myId, scrollToBottom, showError]);

  const sendMessage = useCallback(async () => {
    const text = newMessage.trim();
    if (!text || sending) return;
    setNewMessage('');
    await doSend(text);
  }, [newMessage, sending, doSend]);

  const retryMessage = useCallback((msg: Message) => {
    if (!msg.failed || !msg._retryText) return;
    doSend(msg._retryText, msg.id);
  }, [doSend]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        <TouchableOpacity
          activeOpacity={item.failed ? 0.7 : 1}
          onPress={() => item.failed && retryMessage(item)}
          style={[
            styles.bubble,
            isMine
              ? {
                  backgroundColor: item.failed
                    ? (isDark ? 'rgba(239,68,68,0.15)' : '#FFF0F0')
                    : (isDark ? `${C.primary}22` : C.primary),
                  borderColor: item.failed
                    ? 'rgba(239,68,68,0.4)'
                    : (isDark ? C.primary : 'transparent'),
                  borderWidth: (isDark || item.failed) ? 1 : 0,
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
          <Text style={[
            styles.bubbleText,
            {
              color: isMine
                ? (item.failed ? '#EF4444' : (isDark ? C.primary : '#fff'))
                : C.text,
            },
          ]}>
            {item.content}
          </Text>
          <View style={styles.msgMeta}>
            {item.pending && (
              <ActivityIndicator size={10} color={isDark ? C.primary : 'rgba(255,255,255,0.7)'} />
            )}
            {item.failed && (
              <RotateCcw size={11} color="#EF4444" />
            )}
            <Text style={[
              styles.msgTime,
              {
                color: isMine
                  ? (item.failed ? 'rgba(239,68,68,0.6)' : (isDark ? `${C.primary}88` : 'rgba(255,255,255,0.7)'))
                  : C.textMuted,
              },
            ]}>
              {item.failed ? 'فشل — اضغط للإعادة' : formatTime(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
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
        {/* Error banner — auto-dismisses after 4 seconds */}
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
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
                <MessageCircle size={36} color={C.textMuted} />
              </View>
              <Text style={[styles.emptyChatTitle, { color: C.text }]}>بداية المحادثة</Text>
              <Text style={[styles.emptyChatText, { color: C.textMuted }]}>
                لا توجد رسائل بعد. أرسل أول رسالة لبدء التواصل مع الطرف الآخر.
              </Text>
            </View>
          }
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
            maxLength={MAX_MESSAGE_LENGTH}
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

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyChatTitle: { fontSize: FontSizes.lg, fontWeight: '700', textAlign: 'center' },
  emptyChatText: { fontSize: FontSizes.sm, textAlign: 'center', lineHeight: 22 },

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
