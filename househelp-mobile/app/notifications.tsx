import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { authService } from '../lib/auth';
import { notificationService, type AppNotification } from '../lib/notifications';

function formatTime(notification: AppNotification) {
  const value = notification.createdAt || notification.timestamp;

  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

function isUnread(notification: AppNotification) {
  return notification.read === false || notification.read_status === 0;
}

function NotificationCard({
  item,
  onDelete,
  onOpen,
}: {
  item: AppNotification;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const unread = isUnread(item);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={[styles.card, unread && styles.unreadCard]}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
        {unread ? <Text style={styles.unreadBadge}>Moi</Text> : null}
      </View>

      <Text style={styles.message}>{item.message}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.type}>{item.type}</Text>
        <Text style={styles.time}>{formatTime(item)}</Text>
      </View>

      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Text style={styles.deleteText}>Xoa</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const router = useRouter();

  const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications]);

  const loadNotifications = useCallback(async (refreshing = false) => {
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

      const data = await notificationService.getForUser(user.id);
      setNotifications(data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || 'Khong the tai thong bao.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleOpen = async (notification: AppNotification) => {
    try {
      if (isUnread(notification)) {
        await notificationService.markRead(notification.id);
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, read: true, read_status: 1 } : item)),
        );
      }

      if (notification.bookingId) {
        router.push(`/chat/${notification.bookingId}`);
      }
    } catch (markError: any) {
      Alert.alert('Khong the cap nhat', markError.response?.data?.message || markError.response?.data?.error || 'Thu lai sau.');
    }
  };

  const handleDelete = (notification: AppNotification) => {
    Alert.alert('Xoa thong bao', 'Ban co chac muon xoa thong bao nay?', [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Xoa',
        style: 'destructive',
        onPress: async () => {
          try {
            await notificationService.delete(notification.id);
            setNotifications((current) => current.filter((item) => item.id !== notification.id));
          } catch (deleteError: any) {
            Alert.alert(
              'Khong the xoa',
              deleteError.response?.data?.message || deleteError.response?.data?.error || 'Thu lai sau.',
            );
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Quay lai</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Thong bao</Text>
        <Text style={styles.subtitle}>{unreadCount} thong bao moi</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadNotifications(true)} />}
        renderItem={({ item }) => (
          <NotificationCard item={item} onDelete={() => handleDelete(item)} onOpen={() => handleOpen(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chua co thong bao</Text>
            <Text style={styles.emptyText}>Thong bao booking, chat va he thong se hien thi tai day.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '800',
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
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 8,
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
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  list: {
    gap: 12,
    padding: 16,
  },
  message: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 3,
  },
  time: {
    color: '#6b7280',
    fontSize: 12,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  type: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  unreadBadge: {
    backgroundColor: '#0f766e',
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unreadCard: {
    borderColor: '#0f766e',
  },
});
