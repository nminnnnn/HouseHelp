import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';
import { formatVietnamDate } from '../../lib/date';
import { useLanguage } from '../../lib/language';
import { serviceListLabel } from '../../lib/service-labels';
import type { AppLanguage } from '../../lib/storage';

const copy = {
  en: {
    address: 'Address',
    back: 'Back',
    dateTime: 'Date & time',
    empty: 'You do not have previous bookings yet.',
    error: 'Could not load previous bookings.',
    housekeeper: 'Housekeeper',
    service: 'Service',
    title: 'Book again',
  },
  vi: {
    address: 'Địa chỉ',
    back: 'Quay lại',
    dateTime: 'Ngày và giờ',
    empty: 'Bạn chưa có booking cũ.',
    error: 'Không thể tải booking cũ.',
    housekeeper: 'Người giúp việc',
    service: 'Dịch vụ',
    title: 'Đặt lại',
  },
} as const;

function errorMessage(error: any, fallback: string) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : fallback;
}

function formatDateTime(booking: Booking, language: AppLanguage) {
  const date = formatVietnamDate(booking.startDate || booking.date, language === 'vi' ? 'Chưa có ngày' : 'No date');
  return `${date}${booking.time ? ` - ${booking.time}` : ''}`;
}

function uniqueLatestBookingsByHousekeeper(bookings: Booking[]) {
  const grouped = new Map<string, Booking>();

  bookings.forEach((booking) => {
    if (!booking.housekeeperId) return;

    const key = String(booking.housekeeperId);
    if (!grouped.has(key)) {
      grouped.set(key, booking);
    }
  });

  return Array.from(grouped.values());
}

export default function BookAgainScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const text = copy[language];

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
      const previousBookings = uniqueLatestBookingsByHousekeeper(data);
      setBookings(previousBookings);
    } catch (loadError: any) {
      setError(errorMessage(loadError, text.error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router, text.error]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#ff8128" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 14) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color="#ff8128" name="chevron-back" size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>{text.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 44) }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} tintColor="#ff8128" />}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons color="#ff8128" name="calendar-outline" size={36} />
            <Text style={styles.emptyText}>{text.empty}</Text>
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {bookings.map((booking) => {
                return (
                  <TouchableOpacity
                    activeOpacity={0.86}
                    key={booking.id}
                    onPress={() => {
                      router.push({
                        pathname: '/(customer)/book-again-detail/[bookingId]',
                        params: { bookingId: String(booking.id) },
                      });
                    }}
                    style={styles.personCard}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(booking.housekeeperName || 'H').slice(0, 1)}</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text numberOfLines={1} style={styles.personName}>{booking.housekeeperName || `${text.housekeeper} #${booking.housekeeperId}`}</Text>
                      <Text numberOfLines={1} style={styles.personMeta}>{serviceListLabel(booking.service, language, text.service)}</Text>
                      <Text numberOfLines={1} style={styles.personDate}>{formatDateTime(booking, language)}</Text>
                    </View>
                    <Ionicons color="#94a3b8" name="chevron-forward" size={22} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: '#ff8128',
    fontSize: 18,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    gap: 14,
    padding: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  detailTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 2,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    gap: 12,
    padding: 28,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    color: '#991b1b',
    fontSize: 14,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#eef0f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerSpacer: {
    width: 44,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  infoRow: {
    borderBottomColor: '#f1f5f9',
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  list: {
    gap: 10,
  },
  personCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  personCardActive: {
    borderColor: '#ff8128',
    shadowColor: '#ff8128',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  personDate: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  personInfo: {
    flex: 1,
    gap: 3,
  },
  personMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  personName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  rebookButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 15,
  },
  rebookText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
});
