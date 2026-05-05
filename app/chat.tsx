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
import { Colors, Spacing, BorderRadius, FontSizes } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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

  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (!err && data) {
      setMessages(data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  useEffect(() => {
    if (!room) {
      setError('غرفة الدردشة غير موجودة');
      setLoading(false);
      return;
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('يجب تسجيل الدخول أولاً');
        setLoading(false);
        return;
      }
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

      // Fetch listing title
      const { data: listing } = await supabase
        .from('listings')
        .select('title')
        .eq('id', roomData.listing_id)
        .maybeSingle();

      setChatRoom({ ...roomData, listing_title: listing?.title ?? '' });
      await fetchMessages(room);
      setLoading(false);

      // Subscribe to new messages
      channelRef.current = supabase
        .channel(`chat_room_${room}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` },
          (payload) => {
            const msg = payload.new as Message;
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        )
        .subscribe();
    };

    init();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [room, fetchMessages]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !room || !myId || sending) return;

    setSending(true);
    setNewMessage('');

    const { error: sendErr } = await supabase
      .from('chat_messages')
      .insert({ room_id: room, sender_id: myId, content: text });

    if (sendErr) {
      setError('فشل إرسال الرسالة');
      setNewMessage(text);
    }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
            {item.content}
          </Text>
          <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : styles.msgTimeOther]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  if (error || !chatRoom) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowRight size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المحادثة</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'حدث خطأ'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowRight size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chatRoom.listing_title || 'محادثة'}
          </Text>
          <Text style={styles.headerSub}>محادثة خاصة</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>ابدأ المحادثة الآن</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.sendBtn, (!newMessage.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Send size={18} color={Colors.white} />
            }
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="اكتب رسالة..."
            placeholderTextColor={Colors.neutral[400]}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            textAlign="right"
            onSubmitEditing={sendMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FontSizes.md, color: Colors.error[500], textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  msgList: {
    padding: Spacing.md,
    gap: Spacing.sm,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  bubbleMine: {
    backgroundColor: Colors.primary[600],
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: FontSizes.md, lineHeight: 22 },
  bubbleTextMine: { color: Colors.white },
  bubbleTextOther: { color: Colors.text },
  msgTime: { fontSize: FontSizes.xs, marginTop: 3 },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)', textAlign: 'left' },
  msgTimeOther: { color: Colors.neutral[400], textAlign: 'right' },

  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyChatText: { fontSize: FontSizes.md, color: Colors.neutral[400] },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.text,
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.neutral[300] },
});
