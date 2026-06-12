import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';
import { housekeeperService } from '../../lib/housekeepers';
import { useLanguage } from '../../lib/language';
import { messageService, type ChatMessage } from '../../lib/messages';
import { getSocket } from '../../lib/socket';

function messageTime(message: ChatMessage) {
  const value = message.createdAt || message.timestamp;

  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function MessageBubble({ item, currentUserId }: { item: ChatMessage; currentUserId: number }) {
  const isMine = item.senderId === currentUserId;

  return (
    <View style={[styles.messageRow, isMine ? styles.mineRow : styles.theirRow]}>
      <View style={[styles.bubble, isMine ? styles.mineBubble : styles.theirBubble]}>
        <Text style={[styles.messageText, isMine ? styles.mineText : styles.theirText]}>{item.message}</Text>
        <Text style={[styles.timeText, isMine ? styles.mineTime : styles.theirTime]}>{messageTime(item)}</Text>
      </View>
    </View>
  );
}

function normalizeSocketMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    bookingId: Number(message.bookingId),
    receiverId: Number(message.receiverId),
    senderId: Number(message.senderId),
  };
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<number, ChatMessage>();

  [...current, ...incoming].forEach((message) => {
    byId.set(message.id, message);
  });

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
    const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
    return aTime - bTime || a.id - b.id;
  });
}

function callRoomId(bookingId: string, userId?: number, receiverId?: number | null) {
  if (bookingId !== 'direct') {
    return `househelp-booking-${bookingId}`;
  }

  const ids = [userId, receiverId].filter((value): value is number => Number.isFinite(Number(value))).sort((a, b) => a - b);
  return `househelp-direct-${ids.join('-')}`;
}

function emitCallInvite(payload: {
  bookingId: string;
  callerName: string;
  callType: 'audio' | 'video';
  roomName: string;
  targetUserId: number;
}, user: AuthUser) {
  const socket = getSocket();
  const joinPayload = {
    role: user.role,
    userId: user.id,
    userName: user.fullName || user.email,
  };

  const sendInvite = () => {
    socket.emit('join', joinPayload);
    socket.emit('call_invite', payload);
  };

  if (socket.connected) {
    sendInvite();
    return;
  }

  socket.once('connect', sendInvite);
  socket.connect();
}

const copy = {
  en: {
    back: 'Back',
    cannotCall: 'Cannot call yet',
    cannotCallText: 'Please wait for the chat information to load before starting a call.',
    cannotOpenChat: 'Could not open chat',
    directSubtitle: 'Direct conversation',
    emptyText: 'Send the first message in this conversation.',
    emptyTitle: 'No messages yet',
    housekeeper: 'Housekeeper',
    customer: 'Customer',
    loadError: 'Could not load chat',
    missingReceiver: 'Missing recipient information.',
    newAudioCall: 'Started an audio call.',
    newVideoCall: 'Started a video call.',
    noAccess: 'This account does not have permission to view this chat.',
    noBooking: 'Booking not found',
    placeholder: 'Type a message...',
    retry: 'Please try again later.',
    send: 'Send',
    sendError: 'Could not send message',
    syncError: 'Could not sync new messages.',
  },
  vi: {
    back: 'Quay lại',
    cannotCall: 'Chưa thể gọi',
    cannotCallText: 'Cần tải thông tin cuộc chat trước khi bắt đầu cuộc gọi.',
    cannotOpenChat: 'Không mở được chat',
    directSubtitle: 'Trao đổi trực tiếp',
    emptyText: 'Hãy gửi lời chào đầu tiên trong cuộc trò chuyện này.',
    emptyTitle: 'Chưa có tin nhắn',
    housekeeper: 'Người giúp việc',
    customer: 'Khách hàng',
    loadError: 'Không tải được chat',
    missingReceiver: 'Thiếu thông tin người nhận.',
    newAudioCall: 'Đã bắt đầu cuộc gọi âm thanh.',
    newVideoCall: 'Đã bắt đầu video call.',
    noAccess: 'Tài khoản này không có quyền xem cuộc chat này.',
    noBooking: 'Không tìm thấy booking',
    placeholder: 'Nhập tin nhắn...',
    retry: 'Thử lại sau.',
    send: 'Gửi',
    sendError: 'Không gửi được tin nhắn',
    syncError: 'Không đồng bộ được tin mới.',
  },
} as const;

export default function ChatScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { bookingId, receiverId: directReceiverId, receiverName } = useLocalSearchParams<{
    bookingId: string;
    receiverId?: string;
    receiverName?: string;
  }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const text = copy[language];

  const title = useMemo(() => {
    if (bookingId === 'direct') {
      return receiverName || 'Chat';
    }

    if (!booking || !user) {
      return 'Chat';
    }

    return user.id === booking.customerId
      ? booking.housekeeperName || text.housekeeper
      : booking.customerName || text.customer;
  }, [booking, bookingId, receiverName, text.customer, text.housekeeper, user]);

  const resolveReceiverId = useCallback(async (currentUser: AuthUser, currentBooking: Booking) => {
    if (currentUser.id === currentBooking.customerId) {
      const housekeeper = await housekeeperService.getById(currentBooking.housekeeperId);
      if (!housekeeper.userId) {
        throw new Error('Missing housekeeper userId.');
      }

      return housekeeper.userId;
    }

    return currentBooking.customerId;
  }, []);

  const loadChat = useCallback(async (refreshing = false) => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }

    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const currentUser = await authService.checkAuthStatus();

      if (!currentUser) {
        router.replace('/(auth)/login');
        return;
      }

      if (bookingId === 'direct') {
        const nextReceiverId = Number(directReceiverId);

        if (!Number.isFinite(nextReceiverId) || nextReceiverId <= 0) {
          Alert.alert(text.cannotOpenChat, text.missingReceiver);
          router.back();
          return;
        }

        const directMessages = await messageService.getBetweenUsers(currentUser.id, nextReceiverId);

        setBooking(null);
        setMessages(directMessages);
        setReceiverId(nextReceiverId);
        setUser(currentUser);
        setBackgroundError(null);
        return;
      }

      const [allBookings, bookingMessages] = await Promise.all([
        bookingService.getForUser(currentUser.id),
        messageService.getForBooking(bookingId),
      ]);
      const currentBooking = allBookings.find((item) => String(item.id) === String(bookingId));

      if (!currentBooking) {
        Alert.alert(text.noBooking, text.noAccess);
        router.back();
        return;
      }

      const nextReceiverId = await resolveReceiverId(currentUser, currentBooking);
      const directMessages = await messageService.getBetweenUsers(currentUser.id, nextReceiverId);

      setBooking(currentBooking);
      setMessages(mergeMessages(bookingMessages, directMessages));
      setReceiverId(nextReceiverId);
      setUser(currentUser);
      setBackgroundError(null);
    } catch (error: any) {
      Alert.alert(text.loadError, error.response?.data?.message || error.response?.data?.error || text.retry);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bookingId, directReceiverId, resolveReceiverId, router, text.cannotOpenChat, text.loadError, text.missingReceiver, text.noAccess, text.noBooking, text.retry]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useFocusEffect(
    useCallback(() => {
      loadChat(true);
    }, [loadChat]),
  );

  useEffect(() => {
    if (!bookingId || !user) {
      return;
    }

    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join', {
      role: user.role,
      userId: user.id,
      userName: user.fullName || user.email,
    });

    const handleNewMessage = (incoming: ChatMessage) => {
      const nextMessage = normalizeSocketMessage(incoming);

    const isSameBooking = bookingId !== 'direct' && String(nextMessage.bookingId) === String(bookingId);
      const isSameDirectUser =
        receiverId !== null &&
        ((nextMessage.senderId === user.id && nextMessage.receiverId === receiverId) ||
          (nextMessage.senderId === receiverId && nextMessage.receiverId === user.id));

      if (!isSameBooking && !isSameDirectUser) {
        return;
      }

      setMessages((current) => {
        if (current.some((message) => message.id === nextMessage.id)) {
          return current;
        }

        return [...current, nextMessage];
      });
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [bookingId, receiverId, user]);

  useEffect(() => {
    if (!bookingId || !user) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const [latestBookingMessages, latestDirectMessages] = await Promise.all([
          bookingId === 'direct' ? Promise.resolve([]) : messageService.getForBooking(bookingId),
          receiverId ? messageService.getBetweenUsers(user.id, receiverId) : Promise.resolve([]),
        ]);
        setMessages((current) => mergeMessages(current, mergeMessages(latestBookingMessages, latestDirectMessages)));
        setBackgroundError(null);
      } catch (error: any) {
        setBackgroundError(error.response?.data?.message || error.response?.data?.error || text.syncError);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [bookingId, receiverId, text.syncError, user]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = input.trim();

    if (!bookingId || !user || !receiverId || !trimmed) {
      return;
    }
// send message
    try { 
      setIsSending(true);
      setInput('');
      const newMessage =
        bookingId === 'direct'
          ? await messageService.sendBetweenUsers(user.id, receiverId, {
              message: trimmed,
              messageType: 'text',
            })
          : await messageService.send(bookingId, {
              message: trimmed,
              messageType: 'text',
              receiverId,
              senderId: user.id,
            });
      setMessages((current) => {
        if (current.some((message) => message.id === newMessage.id)) {
          return current;
        }

        return [...current, newMessage];
      });
    } catch (error: any) {
      setInput(trimmed);
      Alert.alert(text.sendError, error.response?.data?.message || error.response?.data?.error || text.retry);
    } finally {
      setIsSending(false);
    }
  };
// start call
  const startCall = async (type: 'audio' | 'video') => {
    if (!bookingId || !user || !receiverId) {
      Alert.alert(text.cannotCall, text.cannotCallText);
      return;
    }

    const roomId = callRoomId(bookingId, user.id, receiverId);
    const callText = type === 'audio' ? text.newAudioCall : text.newVideoCall;

    emitCallInvite({
      bookingId,
      callerName: user.fullName || user.email || text.customer,
      callType: type,
      roomName: roomId,
      targetUserId: receiverId,
    }, user);

    try {
      if (bookingId === 'direct') {
        await messageService.sendBetweenUsers(user.id, receiverId, {
          message: callText,
          messageType: 'text',
        });
      } else {
        await messageService.send(bookingId, {
          message: callText,
          messageType: 'text',
          receiverId,
          senderId: user.id,
        });
      }
    } catch {
      // The call can still start even if the status message fails to send.
    }

    router.push({
      pathname: '/call/[roomId]',
      params: {
        bookingId,
        roomId,
        targetUserId: String(receiverId),
        title,
        type,
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? Math.max(insets.top, 16) : 0}
        style={styles.screen}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{text.back}</Text>
          </TouchableOpacity>
          <View style={styles.headerMain}>
            <View style={styles.headerTitleBlock}>
              <Text numberOfLines={1} style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{bookingId === 'direct' ? text.directSubtitle : `Booking #${bookingId}`}</Text>
            </View>
            <View style={styles.callActions}>
              <TouchableOpacity activeOpacity={0.84} onPress={() => startCall('audio')} style={styles.callButton}>
                <Ionicons color="#ff8128" name="call-outline" size={20} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.84} onPress={() => startCall('video')} style={styles.callButton}>
                <Ionicons color="#ff8128" name="videocam-outline" size={21} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <FlatList
          contentContainerStyle={styles.messages}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          ref={listRef}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadChat(true)} />}
          renderItem={({ item }) => <MessageBubble currentUserId={user?.id || 0} item={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
              <Text style={styles.emptyText}>{text.emptyText}</Text>
            </View>
          }
        />

        {backgroundError ? (
          <View style={styles.syncError}>
            <Text style={styles.syncErrorText}>{backgroundError}</Text>
          </View>
        ) : null}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            multiline
            onChangeText={setInput}
            placeholder={text.placeholder}
            style={styles.input}
            value={input}
          />
          <TouchableOpacity disabled={isSending || !input.trim()} onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendText}>{isSending ? '...' : text.send}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '700',
  },
  bubble: {
    borderRadius: 8,
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  headerTitleBlock: {
    flex: 1,
  },
  callActions: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderColor: '#fed7aa',
    borderRadius: 18,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  messages: {
    flexGrow: 1,
    gap: 10,
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  mineBubble: {
    backgroundColor: '#ff8128',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  mineText: {
    color: '#fff',
  },
  mineTime: {
    color: '#d1fae5',
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 3,
  },
  syncError: {
    backgroundColor: '#fef2f2',
    borderTopColor: '#fecaca',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncErrorText: {
    color: '#991b1b',
    fontSize: 12,
    textAlign: 'center',
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  theirText: {
    color: '#111827',
  },
  theirTime: {
    color: '#6b7280',
  },
  timeText: {
    fontSize: 11,
    marginTop: 5,
    textAlign: 'right',
  },
  title: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
});
