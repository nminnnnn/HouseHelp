import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../../components/customer-bottom-nav';
import { authService } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';

const tabs = ['Upcoming', 'Schedule', 'Monthly'] as const;

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
        <Text numberOfLines={1} style={styles.service}>{item.service || 'Dich vu'}</Text>
        <Text style={styles.status}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.meta}>Tasker: {item.housekeeperName || `#${item.housekeeperId}`}</Text>
      <Text style={styles.meta}>Ngay: {formatDate(item)} - {item.time || 'Chua co'}</Text>
      <Text style={styles.meta}>Dia chi: {item.location || 'Chua co'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
        <TouchableOpacity onPress={onChat} style={styles.chatButton}>
          <Ionicons color="#fff" name="chatbubble-outline" size={16} />
          <Text style={styles.chatText}>Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CustomerBookingsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Upcoming');
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

  const visibleBookings = useMemo(() => {
    if (activeTab === 'Monthly') {
      return bookings.filter((item) => String(item.service || '').toLowerCase().includes('monthly'));
    }

    if (activeTab === 'Schedule') {
      return bookings.filter((item) => ['confirmed', 'in_progress'].includes(item.status));
    }

    return bookings.filter((item) => !['completed', 'cancelled', 'rejected'].includes(item.status));
  }, [activeTab, bookings]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ff8128" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} tintColor="#ff8128" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Activity</Text>
            <TouchableOpacity>
              <Text style={styles.history}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tab}>
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                {activeTab === tab ? <View style={styles.activeLine} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {visibleBookings.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIllustration}>
                <Ionicons color="#ff9a28" name="book-outline" size={78} />
                <Ionicons color="#ff8128" name="home-outline" size={38} style={styles.emptyMiniIcon} />
              </View>
              <Text style={styles.emptyText}>Enjoy life in a crystal clean house.</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)')} style={styles.ctaButton}>
                <Text style={styles.ctaText}>Post your task now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {visibleBookings.map((item) => (
                <BookingCard key={String(item.id)} item={item} onChat={() => router.push(`/chat/${item.id}`)} />
              ))}
            </View>
          )}
        </ScrollView>
        <CustomerBottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeLine: {
    backgroundColor: '#ff8128',
    borderRadius: 999,
    bottom: 0,
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  activeTabText: {
    color: '#ff8128',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 15,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f8f8fc',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#18bf62',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chatText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  content: {
    paddingBottom: 112,
  },
  ctaButton: {
    backgroundColor: '#18bf62',
    borderRadius: 14,
    marginTop: 4,
    minWidth: 238,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  ctaText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: 22,
    minHeight: 520,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 90,
    height: 180,
    justifyContent: 'center',
    position: 'relative',
    width: 180,
  },
  emptyMiniIcon: {
    bottom: 42,
    position: 'absolute',
    right: 42,
  },
  emptyText: {
    color: '#687386',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
    alignItems: 'center',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  history: {
    color: '#18bf62',
    fontSize: 19,
    fontWeight: '900',
  },
  list: {
    gap: 12,
    padding: 16,
  },
  meta: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    color: '#ff8128',
    fontSize: 15,
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
  service: {
    color: '#172033',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  status: {
    backgroundColor: '#eefbf4',
    borderRadius: 999,
    color: '#18a957',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    paddingBottom: 16,
    paddingTop: 17,
    position: 'relative',
  },
  tabText: {
    color: '#737b8c',
    fontSize: 18,
    fontWeight: '800',
  },
  tabs: {
    backgroundColor: '#fff',
    borderBottomColor: '#e9edf3',
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  title: {
    color: '#172033',
    fontSize: 34,
    fontWeight: '900',
  },
});
