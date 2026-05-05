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
    if (!room) { setError('غرفة الدردشة غير موجودة'); setLoading(false); return; }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('يجب تسجيل الدخول أولاً'); setLoading(false); return; }
      setMyId(user.id);

      const { data: roomData, error: roomErr } = await supabase
        .from('chat_rooms').select('id, listing_id, owner_id, other_user_id').eq('id', room).maybeSingle();
      if (roomErr || !roomData) { setError('لا يمكن الوصول إلى هذه المحادثة'); setLoading(false); return; }

      const { data: listing } = await supabase.from('listings').select('title').eq('id', roomData.listing_id).maybeSingle();
      setChatRoom({ ...roomData, listing_title: listing?.title ?? '' });
      await fetchMessages(room);
      setLoading(false);

      channelRef.current = supabase
        .channel(`chat_room_${room}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        })
        .subscribe();
    };

    init();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [room, fetchMessages]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !room || !myId || sending) return;
    setSending(true);
    setNewMessage('');
    const { error: sendErr } = await supabase.from('chat_messages').insert({ room_id: room, sender_id: myId, content: text });
    if (sendErr) { setError('فشل إرسال الرسالة'); setNewMessage(text); }
    setSending(false);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === myId;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        <View style={[
          styles.bubble,
          isMine
            ? { backgroundColor: isDark ? `${C.primary}22` : C.primary, borderColor: isDark ? C.primary : 'transparent', borderWidth: isDark ? 1 : 0 }
            : { backgroundColor: C.card, borderColor: isDark ? C.cardBorder : '#E8EDF2', borderWidth: 1 },
          isMine ? styles.bubbleMine : styles.bubbleOther,
        ]}>
          <Text style={[styles.bubbleText, { color: isMine ? (isDark ? C.primary : '#fff') : C.text }]}>{item.content}</Text>
          <Text style={[styles.msgTime, { color: isMine ? (isDark ? `${C.primary}88` : 'rgba(255,255,255,0.7)') : C.textMuted }]}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: C.background }]}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  if (error || !chatRoom) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
            <ArrowRight size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.text }]}>المحادثة</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={[styles.centered, { backgroundColor: C.background }]}>
          <Text style={{ color: C.error, fontSize: FontSizes.md, textAlign: 'center' }}>{error || 'حدث خطأ'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: C.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: C.navBar, borderBottomColor: isDark ? C.border : '#E8EDF2' }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? C.card : '#F4F7FA' }]}>
          <ArrowRight size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>{chatRoom.listing_title || 'محادثة'}</Text>
          <Text style={[styles.headerSub, { color: C.textSecondary }]}>محادثة خاصة</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={[styles.inputRow, { backgroundColor: C.navBar, borderTopColor: isDark ? C.border : '#E8EDF2' }]}>
          <TouchableOpacity
            style={[styles.sendBtn, {
              backgroundColor: (!newMessage.trim() || sending) ? C.border : (isDark ? `${C.primary}20` : C.primary),
              borderColor: C.primary, borderWidth: isDark ? 1 : 0,
            }]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={isDark ? C.primary : '#fff'} />
              : <Send size={18} color={(!newMessage.trim() || sending) ? C.textMuted : (isDark ? C.primary : '#fff')} />
            }
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { backgroundColor: C.input, borderColor: C.inputBorder, color: C.text }]}
            placeholder="اكتب رسالة..."
            placeholderTextColor={C.textMuted}
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

  msgList: { padding: Spacing.md, gap: Spacing.sm, flexGrow: 1, paddingBottom: Spacing.lg },
  msgRow: { flexDirection: 'row', marginVertical: 3 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: FontSizes.md, lineHeight: 22 },
  msgTime: { fontSize: FontSizes.xs, marginTop: 3 },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: FontSizes.md },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1, gap: Spacing.sm,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: FontSizes.md, maxHeight: 100, minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
