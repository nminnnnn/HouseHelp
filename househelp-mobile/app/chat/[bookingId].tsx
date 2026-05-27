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

import { authService, type AuthUser } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';
import { housekeeperService } from '../../lib/housekeepers';
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

  const title = useMemo(() => {
    if (bookingId === 'direct') {
      return receiverName || 'Chat';
    }

    if (!booking || !user) {
      return 'Chat';
    }

    return user.id === booking.customerId
      ? booking.housekeeperName || 'Nguoi giup viec'
      : booking.customerName || 'Khach hang';
  }, [booking, bookingId, receiverName, user]);

  const resolveReceiverId = useCallback(async (currentUser: AuthUser, currentBooking: Booking) => {
    if (currentUser.id === currentBooking.customerId) {
      const housekeeper = await housekeeperService.getById(currentBooking.housekeeperId);
      if (!housekeeper.userId) {
        throw new Error('Khong tim thay userId cua housekeeper.');
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
          Alert.alert('Khong mo duoc chat', 'Thieu thong tin nguoi nhan.');
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
        Alert.alert('Khong tim thay booking', 'Tai khoan nay khong co quyen xem cuoc chat nay.');
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
      Alert.alert('Khong tai duoc chat', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bookingId, directReceiverId, resolveReceiverId, router]);

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
        setBackgroundError(error.response?.data?.message || error.response?.data?.error || 'Khong dong bo duoc tin moi.');
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [bookingId, receiverId, user]);

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
      Alert.alert('Khong gui duoc tin nhan', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Quay lai</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{bookingId === 'direct' ? 'Trao doi truc tiep' : `Booking #${bookingId}`}</Text>
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
            <Text style={styles.emptyTitle}>Chua co tin nhan</Text>
            <Text style={styles.emptyText}>Hay gui loi chao dau tien cho booking nay.</Text>
          </View>
        }
      />

      {backgroundError ? (
        <View style={styles.syncError}>
          <Text style={styles.syncErrorText}>{backgroundError}</Text>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          multiline
          onChangeText={setInput}
          placeholder="Nhap tin nhan..."
          style={styles.input}
          value={input}
        />
        <TouchableOpacity disabled={isSending || !input.trim()} onPress={handleSend} style={styles.sendButton}>
          <Text style={styles.sendText}>{isSending ? '...' : 'Gui'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    marginTop: 8,
  },
});
