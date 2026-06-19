import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { formatVietnamDate } from '../../lib/date';
import { useLanguage } from '../../lib/language';
import type { AppLanguage } from '../../lib/storage';

function errorMessage(error: any, fallback: string) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : fallback;
}

const tabs = ['upcoming', 'history'] as const;
const paymentMethods = [
  { key: 'cash', label: { en: 'Cash', vi: 'Ti\u1ec1n m\u1eb7t' } },
  { key: 'momo', label: 'MoMo' },
] as const;
const copy = {
  en: {
    activity: 'Activity',
    cancel: 'Cancel',
    confirm: 'Confirm',
    date: 'Date',
    emptyCta: 'Post your task now',
    emptyText: 'Enjoy life in a crystal clean house.',
    errorFallback: 'Could not load bookings.',
    history: 'History',
    housekeeper: 'Housekeeper',
    later: 'Later',
    location: 'Address',
    noDate: 'No date',
    noValue: 'Not available',
    paymentSuccessTitle: 'Paid',
    paymentMomoSuccess: (code: string) => `HouseHelp Platform recorded the MoMo payment. Transaction code: ${code}.`,
    paymentCashSuccess: 'Thank you for confirming cash payment and reviewing this service.',
    paymentError: 'Could not complete payment',
    paymentMethod: 'Payment method',
    paymentReview: 'Payment & review',
    rating: 'Review',
    reviewPlaceholder: 'Review this service...',
    scanQr: 'Scan QR',
    service: 'Service',
    cancelBooking: 'Cancel booking',
    cancelMessage: 'Are you sure you want to cancel this booking?',
    cancelSuccessTitle: 'Cancelled',
    cancelSuccessText: 'Booking has been cancelled.',
    cancelError: 'Could not cancel',
    tabs: { history: 'History', upcoming: 'Upcoming' },
    unpaid: 'Pay',
    paid: 'Paid',
    completionProof: 'Completion photo',
    confirmCompletion: 'Confirm completed work',
    confirmCompletionTitle: 'Confirm completion?',
    confirmCompletionMessage: 'Please check the photo carefully. Payment and review will be enabled after confirmation.',
    completionConfirmedTitle: 'Work confirmed',
    completionConfirmedMessage: 'You can now pay and review this service.',
    waitingForProof: 'Waiting for customer confirmation',
  },
  vi: {
    activity: 'Ho\u1ea1t \u0111\u1ed9ng',
    cancel: 'H\u1ee7y',
    confirm: 'X\u00e1c nh\u1eadn',
    date: 'Ng\u00e0y',
    emptyCta: '\u0110\u1eb7t d\u1ecbch v\u1ee5 ngay',
    emptyText: 'T\u1eadn h\u01b0\u1edfng cu\u1ed9c s\u1ed1ng trong ng\u00f4i nh\u00e0 s\u1ea1ch tinh t\u01b0\u01a1m.',
    errorFallback: 'Kh\u00f4ng th\u1ec3 t\u1ea3i booking.',
    history: 'L\u1ecbch s\u1eed',
    housekeeper: 'Ng\u01b0\u1eddi gi\u00fap vi\u1ec7c',
    later: '\u0110\u1ec3 sau',
    location: '\u0110\u1ecba ch\u1ec9',
    noDate: 'Ch\u01b0a c\u00f3 ng\u00e0y',
    noValue: 'Ch\u01b0a c\u00f3',
    paymentSuccessTitle: '\u0110\u00e3 thanh to\u00e1n',
    paymentMomoSuccess: (code: string) => `HouseHelp Platform \u0111\u00e3 ghi nh\u1eadn thanh to\u00e1n MoMo. M\u00e3 giao d\u1ecbch: ${code}.`,
    paymentCashSuccess: 'C\u1ea3m \u01a1n b\u1ea1n \u0111\u00e3 x\u00e1c nh\u1eadn thanh to\u00e1n ti\u1ec1n m\u1eb7t v\u00e0 \u0111\u00e1nh gi\u00e1 d\u1ecbch v\u1ee5.',
    paymentError: 'Kh\u00f4ng thanh to\u00e1n \u0111\u01b0\u1ee3c',
    paymentMethod: 'Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n',
    paymentReview: 'Thanh to\u00e1n & \u0111\u00e1nh gi\u00e1',
    rating: '\u0110\u00e1nh gi\u00e1',
    reviewPlaceholder: 'Nh\u1eadn x\u00e9t v\u1ec1 d\u1ecbch v\u1ee5...',
    scanQr: 'Qu\u00e9t QR',
    service: 'D\u1ecbch v\u1ee5',
    cancelBooking: 'H\u1ee7y booking',
    cancelMessage: 'B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n h\u1ee7y booking n\u00e0y?',
    cancelSuccessTitle: '\u0110\u00e3 h\u1ee7y',
    cancelSuccessText: 'Booking \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y.',
    cancelError: 'Kh\u00f4ng h\u1ee7y \u0111\u01b0\u1ee3c',
    tabs: { history: 'L\u1ecbch s\u1eed', upcoming: 'S\u1eafp t\u1edbi' },
    unpaid: 'Thanh to\u00e1n',
    paid: '\u0110\u00e3 thanh to\u00e1n',
    completionProof: '\u1ea2nh ho\u00e0n th\u00e0nh',
    confirmCompletion: 'X\u00e1c nh\u1eadn c\u00f4ng vi\u1ec7c ho\u00e0n th\u00e0nh',
    confirmCompletionTitle: 'X\u00e1c nh\u1eadn ho\u00e0n th\u00e0nh?',
    confirmCompletionMessage: 'Vui l\u00f2ng ki\u1ec3m tra k\u1ef9 \u1ea3nh. Sau khi x\u00e1c nh\u1eadn, b\u1ea1n c\u00f3 th\u1ec3 thanh to\u00e1n v\u00e0 \u0111\u00e1nh gi\u00e1.',
    completionConfirmedTitle: '\u0110\u00e3 x\u00e1c nh\u1eadn c\u00f4ng vi\u1ec7c',
    completionConfirmedMessage: 'B\u1ea1n c\u00f3 th\u1ec3 thanh to\u00e1n v\u00e0 \u0111\u00e1nh gi\u00e1 d\u1ecbch v\u1ee5 ngay b\u00e2y gi\u1edd.',
    waitingForProof: '\u0110ang ch\u1edd b\u1ea1n x\u00e1c nh\u1eadn',
  },
} as const;
function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatDate(booking: Booking, language: AppLanguage) {
  return formatVietnamDate(
    booking.startDate || booking.date,
    language === 'vi' ? 'Chưa có ngày' : 'No date',
  );
}

function bookingTimeValue(booking: Booking) {
  const rawDate = booking.startDate || booking.date || booking.createdAt;
  const rawTime = booking.time || '00:00';
  const dateTime = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(`${rawDate}T${rawTime}:00+07:00`)
    : new Date(rawDate || 0);

  const time = dateTime.getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortChronological(items: Booking[]) {
  return [...items].sort((a, b) => bookingTimeValue(b) - bookingTimeValue(a));
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

function BookingCard({
  item,
  onCancel,
  onChat,
  onScanQr,
  onReviewPayment,
  onConfirmCompletion,
  isConfirmingCompletion,
  text,
  language,
}: {
  item: Booking;
  onCancel: () => void;
  onChat: () => void;
  onScanQr: () => void;
  onReviewPayment: () => void;
  onConfirmCompletion: () => void;
  isConfirmingCompletion: boolean;
  text: (typeof copy)[AppLanguage];
  language: AppLanguage;
}) {
  const isCompleted = item.status === 'completed';
  const isPaid = item.paymentStatus === 'success';
  const canCancel = item.status === 'pending';
  const canScanQr = item.status === 'confirmed';
  const needsCompletionConfirmation = item.status === 'in_progress' && !!item.completionRequestedAt && !!item.completionProofUrl;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.service}>{item.service || text.service}</Text>
        <Text style={styles.status}>{statusLabel(item.status, language)}</Text>
      </View>
      <Text style={styles.meta}>{text.housekeeper}: {item.housekeeperName || `#${item.housekeeperId}`}</Text>
      <Text style={styles.meta}>{text.date}: {formatDate(item, language)} - {item.time || text.noValue}</Text>
      <Text style={styles.meta}>{text.location}: {item.location || text.noValue}</Text>
      {needsCompletionConfirmation ? (
        <View style={styles.completionProofSection}>
          <View style={styles.completionProofHeader}>
            <Ionicons color="#b45309" name="camera-outline" size={17} />
            <Text style={styles.completionProofTitle}>{text.completionProof}</Text>
            <Text style={styles.completionPendingBadge}>{text.waitingForProof}</Text>
          </View>
          <Image source={{ uri: item.completionProofUrl }} style={styles.completionProofImage} />
          <TouchableOpacity disabled={isConfirmingCompletion} onPress={onConfirmCompletion} style={styles.confirmCompletionButton}>
            {isConfirmingCompletion ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons color="#fff" name="checkmark-circle-outline" size={18} />
                <Text style={styles.confirmCompletionText}>{text.confirmCompletion}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onChat} style={styles.chatButton}>
            <Ionicons color="#fff" name="chatbubble-outline" size={16} />
            <Text style={styles.chatText}>Chat</Text>
          </TouchableOpacity>
          {canCancel ? (
            <TouchableOpacity onPress={onCancel} style={styles.cancelBookingButton}>
              <Text style={styles.cancelBookingText}>{text.cancel}</Text>
            </TouchableOpacity>
          ) : null}
          {canScanQr ? (
            <TouchableOpacity onPress={onScanQr} style={styles.scanQrButton}>
              <Ionicons color="#ff8128" name="qr-code-outline" size={16} />
              <Text style={styles.scanQrText}>{text.scanQr}</Text>
            </TouchableOpacity>
          ) : null}
          {isCompleted ? (
            <TouchableOpacity disabled={isPaid} onPress={onReviewPayment} style={[styles.payButton, isPaid && styles.paidButton]}>
              <Text style={[styles.payText, isPaid && styles.paidText]}>{isPaid ? text.paid : text.unpaid}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CustomerBookingsScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [confirmingCompletionId, setConfirmingCompletionId] = useState<number | null>(null);
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      setBookings(data);
    } catch (loadError: any) {
      setError(errorMessage(loadError, text.errorFallback));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router, text.errorFallback]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, refresh]);

  const visibleBookings = useMemo(() => {
    if (activeTab === 'history') {
      return sortChronological(bookings.filter((item) => ['completed', 'cancelled', 'rejected'].includes(item.status)));
    }

    return sortChronological(bookings.filter((item) => !['completed', 'cancelled', 'rejected'].includes(item.status)));
  }, [activeTab, bookings]);

  const openPaymentReview = (booking: Booking) => {
    setSelectedBooking(booking);
    setPaymentMethod(booking.paymentMethod === 'momo' ? 'momo' : 'cash');
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
      const result = await bookingService.confirmPayment(selectedBooking.id, {
        customerId: selectedBooking.customerId,
        paymentMethod,
        rating,
        review: review.trim() || undefined,
      });
      setSelectedBooking(null);
      Alert.alert(
        text.paymentSuccessTitle,
        paymentMethod === 'momo'
          ? text.paymentMomoSuccess(result.payment?.transactionCode || (language === 'vi' ? 'đang cập nhật' : 'updating'))
          : text.paymentCashSuccess,
      );
      await loadBookings(true);
    } catch (paymentError: any) {
      Alert.alert(text.paymentError, errorMessage(paymentError, text.errorFallback));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCancelBooking = (booking: Booking) => {
    Alert.alert(text.cancelBooking, text.cancelMessage, [
      { text: text.later, style: 'cancel' },
      {
        text: text.cancelBooking,
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingService.cancel(booking.id);
            Alert.alert(text.cancelSuccessTitle, text.cancelSuccessText);
            await loadBookings(true);
          } catch (cancelError: any) {
            Alert.alert(text.cancelError, errorMessage(cancelError, text.errorFallback));
          }
        },
      },
    ]);
  };

  const handleConfirmCompletion = (booking: Booking) => {
    Alert.alert(text.confirmCompletionTitle, text.confirmCompletionMessage, [
      { text: text.later, style: 'cancel' },
      {
        text: text.confirmCompletion,
        onPress: async () => {
          try {
            setConfirmingCompletionId(booking.id);
            await bookingService.confirmCompletion(booking.id);
            Alert.alert(text.completionConfirmedTitle, text.completionConfirmedMessage);
            await loadBookings(true);
          } catch (confirmError: any) {
            Alert.alert(text.errorFallback, errorMessage(confirmError, text.errorFallback));
          } finally {
            setConfirmingCompletionId(null);
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
            <Text style={styles.title}>{text.activity}</Text>
          </View>

          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tab}>
                <Text
                  numberOfLines={1}
                  style={[styles.tabText, activeTab === tab && styles.activeTabText]}
                >
                  {text.tabs[tab]}
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
              <Text style={styles.emptyText}>{text.emptyText}</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)')} style={styles.ctaButton}>
                <Text style={styles.ctaText}>{text.emptyCta}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {visibleBookings.map((item) => (
                <BookingCard
                  item={item}
                  key={String(item.id)}
                  language={language}
                  onCancel={() => handleCancelBooking(item)}
                  onChat={() => router.push(`/chat/${item.id}`)}
                  onScanQr={() => router.push(`/(customer)/scan-qr/${item.id}`)}
                  onReviewPayment={() => openPaymentReview(item)}
                  onConfirmCompletion={() => handleConfirmCompletion(item)}
                  isConfirmingCompletion={confirmingCompletionId === item.id}
                  text={text}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <Modal animationType="slide" onRequestClose={closePaymentReview} transparent visible={!!selectedBooking}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 12, 22) }]}>
                <ScrollView
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>{text.paymentReview}</Text>
                  <Text style={styles.modalMeta}>{selectedBooking?.housekeeperName || 'Housekeeper'}</Text>
                  <Text style={styles.modalPrice}>{formatPrice(selectedBooking?.totalPrice)}</Text>
                  <Text style={styles.modalLabel}>{text.paymentMethod}</Text>
                  <View style={styles.methodRow}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.key}
                        onPress={() => setPaymentMethod(method.key)}
                        style={[styles.methodButton, paymentMethod === method.key && styles.methodButtonActive]}
                      >
                        <Text style={[styles.methodText, paymentMethod === method.key && styles.methodTextActive]}>{typeof method.label === 'string' ? method.label : method.label[language]}</Text>
                        {/* <Text style={[styles.methodHint, paymentMethod === method.key && styles.methodHintActive]}>{method.description}</Text> */}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.modalLabel}>{text.rating}</Text>
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
                    placeholder={text.reviewPlaceholder}
                    scrollEnabled
                    style={styles.reviewInput}
                    value={review}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity disabled={isSubmittingPayment} onPress={closePaymentReview} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>{text.later}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={isSubmittingPayment} onPress={submitPaymentReview} style={styles.confirmButton}>
                      {isSubmittingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{text.confirm}</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  completionPendingBadge: {
    color: '#b45309',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  completionProofHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  completionProofImage: {
    borderRadius: 8,
    height: 190,
    width: '100%',
  },
  completionProofSection: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  completionProofTitle: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '900',
  },
  confirmCompletionButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  confirmCompletionText: {
    color: '#fff',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
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
    height: 36,
    justifyContent: 'center',
    minWidth: 82,
    paddingHorizontal: 13,
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
  methodHint: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  methodHintActive: {
    color: '#9a4a10',
  },
  methodText: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '900',
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
    maxHeight: '88%',
    padding: 18,
    paddingBottom: 28,
  },
  modalKeyboard: {
    flex: 1,
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
  modalScrollContent: {
    paddingBottom: 4,
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
    height: 36,
    justifyContent: 'center',
    minWidth: 82,
    paddingHorizontal: 13,
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
  scanQrButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: 36,
    justifyContent: 'center',
    minWidth: 86,
    paddingHorizontal: 12,
  },
  scanQrText: {
    color: '#ff8128',
    fontSize: 13,
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
    fontSize: 26,
    fontWeight: '900',
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
});
