import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../../lib/auth';
import { bookingService, type Booking } from '../../../lib/bookings';
import { formatVietnamDate } from '../../../lib/date';
import { useLanguage } from '../../../lib/language';
import { serviceListLabel } from '../../../lib/service-labels';
import type { AppLanguage } from '../../../lib/storage';

const copy = {
  en: {
    address: 'Address',
    bookAgain: 'Book again',
    dateTime: 'Date & time',
    duration: 'Duration',
    empty: 'This booking could not be found.',
    error: 'Could not load booking detail.',
    housekeeper: 'Housekeeper',
    notes: 'Customer notes',
    payment: 'Payment',
    price: 'Total price',
    service: 'Service',
    status: 'Status',
    title: 'Booking detail',
  },
  vi: {
    address: 'Địa chỉ',
    bookAgain: 'Đặt lại',
    dateTime: 'Ngày và giờ',
    duration: 'Thời lượng',
    empty: 'Không tìm thấy booking này.',
    error: 'Không thể tải chi tiết booking.',
    housekeeper: 'Người giúp việc',
    notes: 'Ghi chú khách hàng',
    payment: 'Thanh toán',
    price: 'Tổng tiền',
    service: 'Dịch vụ',
    status: 'Trạng thái',
    title: 'Chi tiết booking',
  },
} as const;

function errorMessage(error: any, fallback: string) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : fallback;
}

function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatDateTime(booking: Booking, language: AppLanguage) {
  const date = formatVietnamDate(booking.startDate || booking.date, language === 'vi' ? 'Chưa có ngày' : 'No date');
  return `${date}${booking.time ? ` - ${booking.time}` : ''}`;
}

function paymentLabel(value?: string) {
  if (!value) return 'Not selected';
  return value.toLowerCase() === 'momo' ? 'MoMo' : 'Cash';
}

function statusLabel(status: string, language: AppLanguage) {
  const labels: Record<string, string> = {
    cancelled: language === 'vi' ? 'Đã hủy' : 'Cancelled',
    completed: language === 'vi' ? 'Hoàn thành' : 'Completed',
    confirmed: language === 'vi' ? 'Đã xác nhận' : 'Confirmed',
    in_progress: language === 'vi' ? 'Đang làm' : 'In progress',
    pending: language === 'vi' ? 'Chờ xác nhận' : 'Pending',
    rejected: language === 'vi' ? 'Bị từ chối' : 'Rejected',
  };

  return labels[status] || status;
}

export default function BookAgainDetailScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const text = copy[language];

  const loadBooking = useCallback(async (refreshing = false) => {
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
      setBooking(data.find((item) => String(item.id) === String(bookingId)) || null);
    } catch (loadError: any) {
      setError(errorMessage(loadError, text.error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bookingId, router, text.error]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const rebook = () => {
    if (!booking?.housekeeperId) return;

    router.push({
      pathname: '/(customer)/booking/[housekeeperId]',
      params: {
        duration: booking.duration ? String(booking.duration) : '',
        housekeeperId: String(booking.housekeeperId),
        latitude: booking.latitude ? String(booking.latitude) : '',
        location: booking.location || '',
        longitude: booking.longitude ? String(booking.longitude) : '',
        notes: booking.notes || '',
        paymentMethod: booking.paymentMethod || '',
        service: booking.service || '',
      },
    });
  };

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
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBooking(true)} tintColor="#ff8128" />}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!booking ? (
          <View style={styles.emptyCard}>
            <Ionicons color="#ff8128" name="document-text-outline" size={36} />
            <Text style={styles.emptyText}>{text.empty}</Text>
          </View>
        ) : (
          <View style={styles.detailCard}>
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(booking.housekeeperName || 'H').slice(0, 1)}</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text numberOfLines={2} style={styles.housekeeperName}>{booking.housekeeperName || `#${booking.housekeeperId}`}</Text>
                <Text style={styles.serviceName}>{serviceListLabel(booking.service, language, text.service)}</Text>
              </View>
            </View>

            <InfoRow label={text.housekeeper} value={booking.housekeeperName || `#${booking.housekeeperId}`} />
            <InfoRow label={text.service} value={serviceListLabel(booking.service, language, text.service)} />
            <InfoRow label={text.dateTime} value={formatDateTime(booking, language)} />
            <InfoRow label={text.duration} value={booking.duration ? `${booking.duration} hours` : 'Not available'} />
            <InfoRow label={text.address} value={booking.location || 'Not available'} />
            <InfoRow label={text.notes} value={booking.notes || 'No notes'} />
            <InfoRow label={text.payment} value={paymentLabel(booking.paymentMethod)} />
            <InfoRow label={text.price} value={formatPrice(booking.totalPrice)} />
            <InfoRow label={text.status} value={statusLabel(booking.status, language)} />

            <TouchableOpacity activeOpacity={0.86} onPress={rebook} style={styles.rebookButton}>
              <Text style={styles.rebookText}>{text.bookAgain}</Text>
              <Ionicons color="#fff" name="arrow-forward" size={20} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    color: '#ff8128',
    fontSize: 22,
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
    marginBottom: 12,
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
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  housekeeperName: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
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
  serviceName: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: '#0f172a',
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
});
