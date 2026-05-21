import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { authService } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';

function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatDate(booking: Booking) {
  return booking.startDate || booking.date || 'Chua co ngay';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Da huy',
    completed: 'Hoan thanh',
    confirmed: 'Da xac nhan',
    in_progress: 'Dang lam',
    pending: 'Cho xac nhan',
    rejected: 'Bi tu choi',
  };

  return labels[status] || status;
}

function BookingCard({ item, onChat }: { item: Booking; onChat: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.service}>
          {item.service || 'Dich vu'}
        </Text>
        <Text style={styles.status}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.meta}>Nguoi giup viec: {item.housekeeperName || `#${item.housekeeperId}`}</Text>
      <Text style={styles.meta}>Ngay: {formatDate(item)}</Text>
      <Text style={styles.meta}>Gio: {item.time || 'Chua co'} - {item.duration || 0} gio</Text>
      <Text style={styles.meta}>Dia chi: {item.location || 'Chua co'}</Text>
      <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
      <TouchableOpacity onPress={onChat} style={styles.chatButton}>
        <Text style={styles.chatText}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CustomerBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const loadBookings = useCallback(async (refreshing = false) => {
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

      const data = await bookingService.getForUser(user.id);
      setBookings(data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || 'Khong the tai booking.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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
        <Text style={styles.title}>Booking cua toi</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} />}
        renderItem={({ item }) => <BookingCard item={item} onChat={() => router.push(`/chat/${item.id}`)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chua co booking</Text>
            <Text style={styles.emptyText}>Hay chon mot housekeeper va tao lich dau tien.</Text>
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
    gap: 7,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    marginTop: 8,
    padding: 11,
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
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
  meta: {
    color: '#4b5563',
    fontSize: 14,
  },
  price: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  service: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  status: {
    backgroundColor: '#e6f4f1',
    borderRadius: 999,
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
});
