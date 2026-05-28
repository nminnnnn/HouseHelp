import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../../components/customer-bottom-nav';
import { authService } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';

function errorMessage(error: any) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : 'Khong the tai booking.';
}

const tabs = ['Upcoming', 'Schedule', 'Monthly', 'History'] as const;

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

function BookingCard({
  item,
  onCancel,
  onChat,
  onReviewPayment,
}: {
  item: Booking;
  onCancel: () => void;
  onChat: () => void;
  onReviewPayment: () => void;
}) {
  const isCompleted = item.status === 'completed';
  const isPaid = item.paymentStatus === 'success';
  const canCancel = item.status === 'pending';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.service}>{item.service || 'Dich vu'}</Text>
        <Text style={styles.status}>{statusLabel(item.status)}</Text>
      </View>
      <Text style={styles.meta}>Housekeeper: {item.housekeeperName || `#${item.housekeeperId}`}</Text>
      <Text style={styles.meta}>Ngay: {formatDate(item)} - {item.time || 'Chua co'}</Text>
      <Text style={styles.meta}>Dia chi: {item.location || 'Chua co'}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onChat} style={styles.chatButton}>
            <Ionicons color="#fff" name="chatbubble-outline" size={16} />
            <Text style={styles.chatText}>Chat</Text>
          </TouchableOpacity>
          {canCancel ? (
            <TouchableOpacity onPress={onCancel} style={styles.cancelBookingButton}>
              <Text style={styles.cancelBookingText}>Huy</Text>
            </TouchableOpacity>
          ) : null}
          {isCompleted ? (
            <TouchableOpacity disabled={isPaid} onPress={onReviewPayment} style={[styles.payButton, isPaid && styles.paidButton]}>
              <Text style={[styles.payText, isPaid && styles.paidText]}>{isPaid ? 'Da thanh toan' : 'Thanh toan'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, refresh]);

  const visibleBookings = useMemo(() => {
    if (activeTab === 'Monthly') {
      return bookings.filter((item) => String(item.service || '').toLowerCase().includes('monthly'));
    }

    if (activeTab === 'History') {
      return bookings.filter((item) => ['completed', 'cancelled', 'rejected'].includes(item.status));
    }

    if (activeTab === 'Schedule') {
      return bookings.filter((item) => ['confirmed', 'in_progress'].includes(item.status));
    }

    return bookings.filter((item) => !['completed', 'cancelled', 'rejected'].includes(item.status));
  }, [activeTab, bookings]);

  const openPaymentReview = (booking: Booking) => {
    setSelectedBooking(booking);
    setPaymentMethod('cash');
    setRating(5);
    setReview('');
  };

  const closePaymentReview = () => {
    if (!isSubmittingPayment) {
      setSelectedBooking(null);
    }
  };

  const submitPaymentReview = async () => {
    if (!selectedBooking) return;

    try {
      setIsSubmittingPayment(true);
      await bookingService.confirmPayment(selectedBooking.id, {
        customerId: selectedBooking.customerId,
        paymentMethod,
        rating,
        review: review.trim() || undefined,
      });
      setSelectedBooking(null);
      Alert.alert('Da thanh toan', 'Cam on ban da xac nhan thanh toan va danh gia dich vu.');
      await loadBookings(true);
    } catch (paymentError: any) {
      Alert.alert('Khong thanh toan duoc', errorMessage(paymentError));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCancelBooking = (booking: Booking) => {
    Alert.alert('Huy booking', 'Ban co chac muon huy booking nay?', [
      { text: 'De sau', style: 'cancel' },
      {
        text: 'Huy booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingService.cancel(booking.id);
            Alert.alert('Da huy', 'Booking da duoc huy.');
            await loadBookings(true);
          } catch (cancelError: any) {
            Alert.alert('Khong huy duoc', errorMessage(cancelError));
          }
        },
      },
    ]);
  };

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
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 112, 128) }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} tintColor="#ff8128" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Activity</Text>
            <TouchableOpacity onPress={() => setActiveTab('History')}>
              <Text style={styles.history}>History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tab}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={1}
                  style={[styles.tabText, activeTab === tab && styles.activeTabText]}
                >
                  {tab}
                </Text>
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
                <BookingCard
                  item={item}
                  key={String(item.id)}
                  onCancel={() => handleCancelBooking(item)}
                  onChat={() => router.push(`/chat/${item.id}`)}
                  onReviewPayment={() => openPaymentReview(item)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <Modal animationType="slide" onRequestClose={closePaymentReview} transparent visible={!!selectedBooking}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
              <Text style={styles.modalTitle}>Thanh toan & danh gia</Text>
              <Text style={styles.modalMeta}>{selectedBooking?.housekeeperName || 'Housekeeper'}</Text>
              <Text style={styles.modalPrice}>{formatPrice(selectedBooking?.totalPrice)}</Text>

              <Text style={styles.modalLabel}>Phuong thuc thanh toan</Text>
              <View style={styles.methodRow}>
                {['cash', 'bank', 'wallet'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[styles.methodButton, paymentMethod === method && styles.methodButtonActive]}
                  >
                    <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                      {method === 'cash' ? 'Tien mat' : method === 'bank' ? 'Chuyen khoan' : 'Vi dien tu'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Danh gia</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons color={star <= rating ? '#ff8128' : '#d1d5db'} name="star" size={31} />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                multiline
                onChangeText={setReview}
                placeholder="Nhan xet ve dich vu..."
                style={styles.reviewInput}
                value={review}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity disabled={isSubmittingPayment} onPress={closePaymentReview} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>De sau</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isSubmittingPayment} onPress={submitPaymentReview} style={styles.confirmButton}>
                  {isSubmittingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Xac nhan</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
    gap: 12,
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
    backgroundColor: '#ff8128',
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
    backgroundColor: '#ff8128',
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
    color: '#ff8128',
    fontSize: 19,
    fontWeight: '900',
  },
  list: {
    gap: 12,
    padding: 16,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  cancelBookingButton: {
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  cancelBookingText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '900',
  },
  cancelText: {
    color: '#667085',
    fontSize: 15,
    fontWeight: '900',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 13,
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  methodButton: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  methodButtonActive: {
    backgroundColor: '#fff1e8',
    borderColor: '#ff8128',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
  },
  methodText: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  methodTextActive: {
    color: '#ff8128',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 28,
  },
  modalLabel: {
    color: '#172033',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 9,
    marginTop: 14,
  },
  modalMeta: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  modalPrice: {
    color: '#ff8128',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  modalTitle: {
    color: '#172033',
    fontSize: 22,
    fontWeight: '900',
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
  paidButton: {
    backgroundColor: '#f3f4f6',
  },
  paidText: {
    color: '#6b7280',
  },
  payButton: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  payText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewInput: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#172033',
    minHeight: 92,
    padding: 12,
    textAlignVertical: 'top',
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
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    color: '#ff8128',
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
    paddingHorizontal: 2,
    paddingTop: 17,
    position: 'relative',
  },
  tabText: {
    color: '#737b8c',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
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
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
});
