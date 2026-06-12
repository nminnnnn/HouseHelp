import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../../components/customer-bottom-nav';
import { authService, type AuthUser } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
import { messageService, type Conversation } from '../../lib/messages';
import type { AppLanguage } from '../../lib/storage';

function formatTime(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function initials(name?: string) {
  const parts = String(name || 'H')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const copy = {
  en: {
    conversationFallback: 'Conversation',
    customer: 'Customer',
    emptyCustomer: 'Open a housekeeper profile and tap Message to start chatting.',
    emptyHousekeeper: 'Conversations with customers will appear here after messages or bookings.',
    emptyTitle: 'No conversations yet',
    loadError: 'Could not load conversations.',
    newMessages: 'new messages',
    startServiceChat: 'Start discussing the service',
  },
  vi: {
    conversationFallback: 'Cuộc trò chuyện',
    customer: 'Khách hàng',
    emptyCustomer: 'Vào hồ sơ housekeeper và bấm Nhắn tin để bắt đầu trao đổi.',
    emptyHousekeeper: 'Hội thoại với khách hàng sẽ hiện ở đây sau khi có tin nhắn hoặc booking.',
    emptyTitle: 'Chưa có hội thoại',
    loadError: 'Không thể tải hội thoại.',
    newMessages: 'tin nhắn mới',
    startServiceChat: 'Bắt đầu trao đổi dịch vụ',
  },
} as const;
function ConversationCard({ item, language, onOpen }: { item: Conversation; language: AppLanguage; onOpen: () => void }) {
  const unreadCount = Number(item.unreadCount || 0);
  const text = copy[language];

  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onOpen} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(item.otherUserName)}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.name}>
            {item.otherUserName || text.conversationFallback}
          </Text>
          <Text style={styles.time}>{formatTime(item.lastMessageTime || item.bookingCreatedAt)}</Text>
        </View>

        <Text numberOfLines={1} style={styles.message}>
          {item.lastMessage || item.service || text.startServiceChat}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.role}>{item.otherUserRole === 'housekeeper' ? 'Housekeeper' : text.customer}</Text>
          {unreadCount > 0 ? (
            <Text style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function conversationTime(conversation: Conversation) {
  return new Date(conversation.lastMessageTime || conversation.bookingCreatedAt || 0).getTime();
}

function groupConversationsByUser(items: Conversation[]) {
  const byUser = new Map<number, Conversation>();

  items.forEach((item) => {
    const existing = byUser.get(item.otherUserId);

    if (!existing) {
      byUser.set(item.otherUserId, item);
      return;
    }

    const latest = conversationTime(item) >= conversationTime(existing) ? item : existing;
    byUser.set(item.otherUserId, {
      ...latest,
      unreadCount: Number(existing.unreadCount || 0) + Number(item.unreadCount || 0),
    });
  });

  return Array.from(byUser.values()).sort((a, b) => conversationTime(b) - conversationTime(a));
}

export default function ChatListScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const text = copy[language];

  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0),
    [conversations],
  );

  const loadConversations = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      const user = await authService.checkAuthStatus();

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      setCurrentUser(user);
      const data = await messageService.getConversations(user.id);
      setConversations(groupConversationsByUser(data));
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || text.loadError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router, text.loadError]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  const openConversation = (conversation: Conversation) => {
    router.push({
      pathname: '/chat/[bookingId]',
      params: {
        bookingId: 'direct',
        receiverId: String(conversation.otherUserId),
        receiverName: conversation.otherUserName || 'Chat',
      },
    });
  };
  const isHousekeeper = currentUser?.role === 'housekeeper';

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#ff8128" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          {isHousekeeper ? (
            <TouchableOpacity onPress={() => router.replace('/(housekeeper)')} style={styles.backButton}>
              <Ionicons color="#ff8128" name="chevron-back" size={22} />
              <Text style={styles.backText}>Dashboard</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Chat</Text>
              <Text style={styles.subtitle}>{unreadTotal} {text.newMessages}</Text>
            </View>
            {isHousekeeper ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>Housekeeper</Text>
              </View>
            ) : null}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          contentContainerStyle={[
            styles.list,
            { paddingBottom: isHousekeeper ? Math.max(insets.bottom + 16, 32) : Math.max(insets.bottom + 112, 128) },
          ]}
          data={conversations}
          keyExtractor={(item) => `${item.bookingId || 'direct'}-${item.otherUserId}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadConversations(true)} tintColor="#ff8128" />}
          renderItem={({ item }) => <ConversationCard item={item} language={language} onOpen={() => openConversation(item)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons color="#ff8128" name="chatbubbles-outline" size={64} />
              <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
              <Text style={styles.emptyText}>
                {isHousekeeper
                  ? text.emptyHousekeeper
                  : text.emptyCustomer}
              </Text>
            </View>
          }
        />

        {isHousekeeper ? null : <CustomerBottomNav />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 27,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: '#ff8128',
    fontSize: 17,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: '#ff8128',
    borderRadius: 999,
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 3,
    marginBottom: 10,
  },
  backText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 14,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 90,
  },
  emptyText: {
    color: '#687386',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 20,
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 14,
    borderWidth: 1,
    margin: 16,
    padding: 14,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#edf0f4',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  list: {
    gap: 12,
    padding: 16,
    paddingBottom: 112,
  },
  message: {
    color: '#687386',
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: '#172033',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  role: {
    color: '#ff8128',
    fontSize: 12,
    fontWeight: '900',
  },
  rolePill: {
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rolePillText: {
    color: '#ff8128',
    fontSize: 12,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  screen: {
    backgroundColor: '#f8f8fc',
    flex: 1,
  },
  subtitle: {
    color: '#687386',
    fontSize: 15,
    marginTop: 5,
  },
  time: {
    color: '#8a94a3',
    fontSize: 12,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '900',
  },
});
