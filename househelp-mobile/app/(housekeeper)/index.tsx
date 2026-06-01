import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';
import { housekeeperService, type Housekeeper, type HousekeeperEarnings } from '../../lib/housekeepers';
import { useLanguage } from '../../lib/language';
import type { AppLanguage } from '../../lib/storage';
import { verificationService } from '../../lib/verification';

type FilterKey = 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'rejected';

const filters: FilterKey[] = ['all', 'pending', 'confirmed', 'in_progress', 'completed', 'rejected'];

const serviceOptions = [
  { en: 'Home cleaning', vi: 'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda', value: 'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda' },
  { en: 'Laundry', vi: 'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o', value: 'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o' },
  { en: 'Cooking', vi: 'N\u1ea5u \u0103n', value: 'N\u1ea5u \u0103n' },
  { en: 'Child care', vi: 'Ch\u0103m s\u00f3c tr\u1ebb em', value: 'Ch\u0103m s\u00f3c tr\u1ebb em' },
  { en: 'Elder care', vi: 'Ch\u0103m s\u00f3c ng\u01b0\u1eddi gi\u00e0', value: 'Ch\u0103m s\u00f3c ng\u01b0\u1eddi gi\u00e0' },
  { en: 'Industrial cleaning', vi: 'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p', value: 'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p' },
  { en: 'Gardening', vi: 'L\u00e0m v\u01b0\u1eddn', value: 'L\u00e0m v\u01b0\u1eddn' },
];

const copy = {
  en: {
    account: 'Account',
    all: 'All',
    availabilityUpdating: 'Updating',
    bookingLoadError: 'Could not load bookings.',
    cancel: 'Cancel',
    cannotComplete: 'Could not complete this booking',
    cannotConfirm: 'Could not confirm this booking',
    cannotReject: 'Could not reject this booking',
    cannotUpdate: 'Could not update',
    cashCollected: 'Cash collected',
    chat: 'Chat',
    customer: 'Customer',
    date: 'Date',
    detailVisible: 'Hide reconciliation details',
    detailHidden: 'Tap to view details',
    emptyText: 'Customer bookings will appear here.',
    emptyTitle: 'No bookings yet',
    filters: {
      all: 'All',
      completed: 'Completed',
      confirmed: 'Accepted',
      in_progress: 'In progress',
      pending: 'Pending',
      rejected: 'Rejected',
    },
    logout: 'Log out',
    notes: 'Notes',
    notifications: 'Notifications',
    platformFeeDue: 'Platform fee due',
    platformPayout: 'Platform payout',
    ready: 'Available',
    retry: 'Please try again.',
    service: 'Service',
    status: {
      cancelled: 'Cancelled',
      completed: 'Completed',
      confirmed: 'Confirmed',
      in_progress: 'In progress',
      pending: 'Pending',
      rejected: 'Rejected',
    },
    time: 'Time',
    totalBookings: 'Total bookings',
    pendingBookings: 'Pending',
    unavailable: 'Paused',
    verifyingNeeded: 'Verification required',
    verifyingNeededText: 'You need admin verification and approval before turning on availability.',
    verify: 'Verify',
    reject: 'Reject',
    rejectTitle: 'Reject booking',
    rejectMessage: 'Are you sure you want to reject this booking?',
    confirm: 'Confirm',
    complete: 'Complete job',
    completeTitle: 'Complete job',
    completeMessage: 'Confirm this booking is finished?',
    earnings: 'Earnings & reconciliation',
    earningsDetail: 'Earnings details',
    momoHolding: 'MoMo held by platform',
    paidOut: 'Paid out',
    address: 'Address',
    noValue: 'Not available',
    saveServices: 'Save services',
    servicesSaved: 'Services updated.',
    servicesTitle: 'Your services',
    updateServices: 'Update services',
  },
  vi: {
    account: 'Tài khoản',
    all: 'Tất cả',
    availabilityUpdating: 'Đang cập nhật',
    bookingLoadError: 'Không thể tải booking.',
    cancel: 'Hủy',
    cannotComplete: 'Không thể hoàn thành',
    cannotConfirm: 'Không thể xác nhận',
    cannotReject: 'Không thể từ chối',
    cannotUpdate: 'Không cập nhật được',
    cashCollected: 'Tiền mặt đã thu',
    chat: 'Chat',
    customer: 'Khách hàng',
    date: 'Ngày',
    detailVisible: 'Ẩn thông tin đối soát',
    detailHidden: 'Bấm để xem thông tin chi tiết',
    emptyText: 'Khi khách hàng đặt lịch, booking sẽ hiện ở đây.',
    emptyTitle: 'Chưa có booking',
    filters: {
      all: 'Tất cả',
      completed: 'Hoàn thành',
      confirmed: 'Đã nhận',
      in_progress: 'Đang làm',
      pending: 'Chờ xử lý',
      rejected: 'Từ chối',
    },
    logout: 'Đăng xuất',
    notes: 'Ghi chú',
    notifications: 'Thông báo',
    platformFeeDue: 'Phí platform cần đối soát',
    platformPayout: 'Platform payout',
    ready: 'Đang nhận việc',
    retry: 'Vui lòng thử lại.',
    service: 'Dịch vụ',
    status: {
      cancelled: 'Đã hủy',
      completed: 'Hoàn thành',
      confirmed: 'Đã xác nhận',
      in_progress: 'Đang làm',
      pending: 'Chờ xử lý',
      rejected: 'Đã từ chối',
    },
    time: 'Giờ',
    totalBookings: 'Tổng booking',
    pendingBookings: 'Chờ xử lý',
    unavailable: 'Đang tạm nghỉ',
    verifyingNeeded: 'Cần xác minh',
    verifyingNeededText: 'Bạn cần được admin xác minh và phê duyệt trước khi bật sẵn sàng nhận việc.',
    verify: 'Xác minh',
    reject: 'Từ chối',
    rejectTitle: 'Từ chối booking',
    rejectMessage: 'Bạn có chắc muốn từ chối booking này?',
    confirm: 'Xác nhận',
    complete: 'Hoàn thành công việc',
    completeTitle: 'Hoàn thành công việc',
    completeMessage: 'Bạn xác nhận đã hoàn thành booking này?',
    earnings: 'Thu nhập & đối soát',
    earningsDetail: 'Chi tiết thu nhập',
    momoHolding: 'MoMo đang tạm giữ',
    paidOut: 'Đã chi trả',
    address: 'Địa chỉ',
    noValue: 'Chưa có',
  },
} as const;

function statusLabel(status: string, language: AppLanguage) {
  return copy[language].status[status as keyof (typeof copy)[AppLanguage]['status']] || status;
}

function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatDate(booking: Booking, language: AppLanguage) {
  return booking.startDate || booking.date || (language === 'vi' ? 'Chưa có ngày' : 'No date');
}

function parseBookingStart(booking: Booking) {
  if (booking.startDate) {
    const parsed = new Date(booking.startDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!booking.date || !booking.time) {
    return null;
  }

  const rawTime = booking.time.split('-')[0].trim();
  const dateTime = new Date(`${booking.date}T${rawTime}:00`);
  if (!Number.isNaN(dateTime.getTime())) {
    return dateTime;
  }

  return null;
}

function bookingRecencyValue(booking: Booking) {
  const start = parseBookingStart(booking);
  if (start) {
    return start.getTime();
  }

  if (booking.createdAt) {
    const created = new Date(booking.createdAt);
    if (!Number.isNaN(created.getTime())) {
      return created.getTime();
    }
  }

  return 0;
}

function minutesUntil(date: Date) {
  return Math.round((date.getTime() - Date.now()) / 60000);
}

function truthy(value: unknown) {
  return value === true || value === 1 || value === '1';
}

function servicesFromProfile(value?: string) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function JobCard({
  item,
  isUpdating,
  onChat,
  onComplete,
  onConfirm,
  onOpen,
  onReject,
  text,
  language,
}: {
  item: Booking;
  isUpdating: boolean;
  onChat: () => void;
  onComplete: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  onReject: () => void;
  text: (typeof copy)[AppLanguage];
  language: AppLanguage;
}) {
  const isPending = item.status === 'pending';
  const canComplete = item.status === 'confirmed' || item.status === 'in_progress';

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.86} onPress={onOpen}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.service}>
            {item.service || text.service}
          </Text>
          <Text style={[styles.status, styles[`status_${item.status}` as keyof typeof styles] || styles.statusDefault]}>
            {statusLabel(item.status, language)}
          </Text>
        </View>

        <Text style={styles.meta}>{text.customer}: {item.customerName || `#${item.customerId}`}</Text>
        <Text style={styles.meta}>{text.date}: {formatDate(item, language)}</Text>
        <Text style={styles.meta}>
          {text.time}: {item.time || text.noValue} - {item.duration || 0} {language === 'vi' ? 'gi?' : 'hours'}
        </Text>
        <Text style={styles.meta}>{text.address}: {item.location || text.noValue}</Text>
        {item.notes ? <Text style={styles.notes}>{text.notes}: {item.notes}</Text> : null}
        <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onChat} style={styles.chatButton}>
        <Text style={styles.chatText}>{text.chat}</Text>
      </TouchableOpacity>

      {isPending ? (
        <View style={styles.actions}>
          <TouchableOpacity disabled={isUpdating} onPress={onReject} style={[styles.actionButton, styles.rejectButton]}>
            <Text style={styles.rejectText}>{isUpdating ? text.availabilityUpdating : text.reject}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={isUpdating} onPress={onConfirm} style={[styles.actionButton, styles.confirmButton]}>
            <Text style={styles.confirmText}>{isUpdating ? text.availabilityUpdating : text.confirm}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canComplete ? (
        <TouchableOpacity disabled={isUpdating} onPress={onComplete} style={styles.completeButton}>
          <Text style={styles.completeText}>{isUpdating ? text.availabilityUpdating : text.complete}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function HousekeeperDashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<HousekeeperEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [profile, setProfile] = useState<Housekeeper | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{ isApproved?: boolean; isVerified?: boolean } | null>(null);
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = copy[language];
  const alertedBookingIdsRef = useRef(new Set<number>());

  const loadBookings = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      const storedUser = await authService.checkAuthStatus();

      if (!storedUser) {
        router.replace('/(auth)/login');
        return;
      }

      setUser(storedUser);
      const [data, housekeeperProfile, housekeeperEarnings, nextVerificationStatus] = await Promise.all([
        bookingService.getForUser(storedUser.id),
        housekeeperService.getProfileByUserId(storedUser.id),
        housekeeperService.getEarnings(storedUser.id).catch(() => null),
        verificationService.getStatus(storedUser.id).catch(() => null),
      ]);
      setBookings(data);
      setProfile(housekeeperProfile);
      setSelectedServices(servicesFromProfile(housekeeperProfile.services));
      setEarnings(housekeeperEarnings);
      setVerificationStatus(nextVerificationStatus);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || text.bookingLoadError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router, text.bookingLoadError]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    const sortedBookings = [...bookings].sort((left, right) => bookingRecencyValue(right) - bookingRecencyValue(left));

    if (activeFilter === 'all') {
      return sortedBookings;
    }

    return sortedBookings.filter((booking) => booking.status === activeFilter);
  }, [activeFilter, bookings]);

  const checkUpcomingBookingReminder = useCallback(() => {
    const upcomingBooking = bookings
      .filter((booking) => booking.status === 'confirmed')
      .map((booking) => ({ booking, start: parseBookingStart(booking) }))
      .filter((value) => value.start !== null)
      .filter((value) => {
        const minutes = minutesUntil(value.start!);
        return minutes >= 0 && minutes <= 30 && !alertedBookingIdsRef.current.has(value.booking.id);
      })
      .sort((left, right) => (left.start!.getTime() - right.start!.getTime()))[0];

    if (!upcomingBooking) {
      return;
    }

    alertedBookingIdsRef.current.add(upcomingBooking.booking.id);
    const timeText = upcomingBooking.start!.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    Alert.alert(
      'Nhắc giờ hẹn',
      `Booking với ${upcomingBooking.booking.customerName || `khách #${upcomingBooking.booking.customerId}`} sẽ bắt đầu lúc ${timeText}. Hãy chuẩn bị.`,
    );
  }, [bookings]);

  useEffect(() => {
    checkUpcomingBookingReminder();
    const intervalId = setInterval(checkUpcomingBookingReminder, 60000);
    return () => clearInterval(intervalId);
  }, [checkUpcomingBookingReminder]);

  const pendingCount = useMemo(() => bookings.filter((booking) => booking.status === 'pending').length, [bookings]);
  const isVerifiedHousekeeper = (
    truthy(profile?.isVerified) && truthy(profile?.isApproved)
  ) || (
    truthy(verificationStatus?.isVerified) && truthy(verificationStatus?.isApproved)
  );

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  const handleToggleAvailability = async () => {
    if (!user) return;

    if (!isVerifiedHousekeeper) {
      Alert.alert(text.verifyingNeeded, text.verifyingNeededText);
      return;
    }

    try {
      setIsTogglingAvailability(true);
      const nextAvailable = !profile?.available;
      const targetUserId = profile?.userId || user.id;
      const updatedProfile = await housekeeperService.updateAvailability(targetUserId, nextAvailable);
      setProfile((current) => ({ ...(current || updatedProfile), ...updatedProfile, available: nextAvailable }));
    } catch (toggleError: any) {
      Alert.alert(
        text.cannotUpdate,
        toggleError.response?.data?.message || toggleError.response?.data?.error || text.retry,
      );
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const toggleService = (service: string) => {
    setSelectedServices((current) => (
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    ));
  };

  const handleSaveServices = async () => {
    if (!user || selectedServices.length === 0) return;

    try {
      setIsSavingServices(true);
      const targetUserId = profile?.userId || user.id;
      const updatedProfile = await housekeeperService.updateProfile(targetUserId, {
        services: selectedServices.join(', '),
      });
      setProfile((current) => ({ ...(current || updatedProfile), ...updatedProfile }));
      Alert.alert('Updated', 'Services updated.');
    } catch (saveError: any) {
      Alert.alert(
        text.cannotUpdate,
        saveError.response?.data?.message || saveError.response?.data?.error || text.retry,
      );
    } finally {
      setIsSavingServices(false);
    }
  };

  const handleConfirm = async (booking: Booking) => {
    try {
      setUpdatingId(booking.id);
      await bookingService.confirm(booking.id, booking.housekeeperId);
      await loadBookings(true);
    } catch (confirmError: any) {
      Alert.alert(
        text.cannotConfirm,
        confirmError.response?.data?.message || confirmError.response?.data?.error || text.retry,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (booking: Booking) => {
    Alert.alert(text.rejectTitle, text.rejectMessage, [
      { text: text.cancel, style: 'cancel' },
      {
        text: text.reject,
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdatingId(booking.id);
            await bookingService.reject(booking.id);
            await loadBookings(true);
          } catch (rejectError: any) {
            Alert.alert(
              text.cannotReject,
              rejectError.response?.data?.message || rejectError.response?.data?.error || text.retry,
            );
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  const handleComplete = async (booking: Booking) => {
    Alert.alert(text.completeTitle, text.completeMessage, [
      { text: text.cancel, style: 'cancel' },
      {
        text: text.complete,
        onPress: async () => {
          try {
            setUpdatingId(booking.id);
            await bookingService.complete(booking.id, booking.housekeeperId);
            await loadBookings(true);
          } catch (completeError: any) {
            Alert.alert(
              text.cannotComplete,
              completeError.response?.data?.message || completeError.response?.data?.error || text.retry,
            );
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
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
      <View style={styles.screen}>
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        data={filteredBookings}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View>
                  <Text style={styles.title}>Dashboard</Text>
                  <Text style={styles.subtitle}>{user?.fullName || 'Housekeeper'}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.84} onPress={() => router.push('/chat')} style={styles.chatIconButton}>
                  <Ionicons color="#ff8128" name="chatbubbles-outline" size={25} />
                </TouchableOpacity>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  disabled={isTogglingAvailability}
                  onPress={handleToggleAvailability}
                  style={[styles.availabilityButton, profile?.available ? styles.availableButton : styles.pausedButton]}
                >
                  <Text numberOfLines={1} style={[styles.availabilityText, profile?.available ? styles.availableText : styles.pausedText]}>
                    {isTogglingAvailability ? text.availabilityUpdating : profile?.available ? text.ready : text.unavailable}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.headerActionGrid}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/notifications', params: { returnTo: 'housekeeper' } })}
                  style={styles.notificationButton}
                >
                  <Ionicons color="#ff8128" name="notifications-outline" size={25} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/profile', params: { returnTo: 'housekeeper' } })}
                  style={styles.profileHeaderButton}
                >
                  <Ionicons color="#ff8128" name="person-outline" size={25} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (isVerifiedHousekeeper) {
                      Alert.alert('Verified', 'Your identity has already been verified.');
                      return;
                    }
                    router.push('/(housekeeper)/verification');
                  }}
                  style={[styles.verifyHeaderButton, isVerifiedHousekeeper && styles.verifyHeaderButtonActive]}
                >
                  <Ionicons color={isVerifiedHousekeeper ? '#fff' : '#ff8128'} name="shield-checkmark-outline" size={25} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                  <Ionicons color="#ff8128" name="log-out-outline" size={25} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowServices((current) => !current)}
                style={styles.servicesToggle}
              >
                <View style={styles.servicesToggleCopy}>
                  <Text style={styles.servicesToggleTitle}>
                    {'Update services'}
                  </Text>
                  <Text numberOfLines={1} style={styles.servicesToggleSubtitle}>
                    {selectedServices.length > 0 ? selectedServices.join(', ') : text.noValue}
                  </Text>
                </View>
                <Ionicons color="#ff8128" name={showServices ? 'chevron-up' : 'chevron-down'} size={20} />
              </TouchableOpacity>

              {showServices ? (
                <View style={styles.servicesPanel}>
                  <View style={styles.serviceGrid}>
                    {serviceOptions.map((service) => {
                      const isSelected = selectedServices.includes(service.value);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.84}
                          key={service.value}
                          onPress={() => toggleService(service.value)}
                          style={[styles.serviceChip, isSelected && styles.serviceChipActive]}
                        >
                          <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextActive]}>
                            {language === 'vi' ? service.vi : service.en}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    disabled={isSavingServices || selectedServices.length === 0}
                    onPress={handleSaveServices}
                    style={[styles.saveServicesButton, (isSavingServices || selectedServices.length === 0) && styles.saveServicesButtonDisabled]}
                  >
                    {isSavingServices ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveServicesText}>Save services</Text>}
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{bookings.length}</Text>
                  <Text style={styles.summaryLabel}>{text.totalBookings}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{pendingCount}</Text>
                  <Text style={styles.summaryLabel}>{text.pendingBookings}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setShowEarnings((current) => !current)}
                style={styles.earningsToggle}
              >
                <View>
                  <Text style={styles.earningsToggleTitle}>{text.earnings}</Text>
                  <Text style={styles.earningsToggleSubtitle}>
                    {showEarnings ? text.detailVisible : text.detailHidden}
                  </Text>
                </View>
                <Ionicons color="#ff8128" name={showEarnings ? 'chevron-up' : 'chevron-down'} size={22} />
              </TouchableOpacity>

              {showEarnings ? (
                <View style={styles.earningsCard}>
                  <View style={styles.earningsHeader}>
                    <Text style={styles.earningsTitle}>{text.earningsDetail}</Text>
                    <Text style={styles.earningsBadge}>{text.platformPayout}</Text>
                  </View>
                  <View style={styles.earningsGrid}>
                    <View style={styles.earningsItem}>
                      <Text style={styles.earningsValue}>{formatPrice(earnings?.pendingPayout)}</Text>
                      <Text style={styles.earningsLabel}>{text.momoHolding}</Text>
                    </View>
                    <View style={styles.earningsItem}>
                      <Text style={styles.earningsValue}>{formatPrice(earnings?.paidOut)}</Text>
                      <Text style={styles.earningsLabel}>{text.paidOut}</Text>
                    </View>
                    <View style={styles.earningsItem}>
                      <Text style={styles.earningsValue}>{formatPrice(earnings?.cashCollected)}</Text>
                      <Text style={styles.earningsLabel}>{text.cashCollected}</Text>
                    </View>
                    <View style={styles.earningsItem}>
                      <Text style={styles.earningsValue}>{formatPrice(earnings?.cashPlatformFeeDue)}</Text>
                      <Text style={styles.earningsLabel}>{text.platformFeeDue}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[styles.filterButton, activeFilter === filter && styles.filterButtonActive]}
                >
                  <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{text.filters[filter]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <JobCard
            isUpdating={updatingId === item.id}
            item={item}
            onChat={() => router.push(`/chat/${item.id}`)}
            onComplete={() => handleComplete(item)}
            onConfirm={() => handleConfirm(item)}
            onOpen={() => router.push(`/(housekeeper)/job/${item.id}`)}
            onReject={() => handleReject(item)}
            text={text}
            language={language}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
            <Text style={styles.emptyText}>{text.emptyText}</Text>
          </View>
        }
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 14,
  },
  availabilityButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexBasis: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '800',
  },
  availableButton: {
    backgroundColor: '#fff1e8',
    borderColor: '#ff8128',
    borderWidth: 1,
  },
  availableText: {
    color: '#ff8128',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  chatIconButton: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderColor: '#fed7aa',
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 8,
    padding: 11,
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmButton: {
    backgroundColor: '#15803d',
  },
  confirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  completeButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  completeText: {
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
  earningsBadge: {
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    color: '#ff8128',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
  },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  earningsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsItem: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    flexBasis: '48%',
    flexGrow: 1,
    padding: 12,
  },
  earningsLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 4,
  },
  earningsTitle: {
    color: '#172033',
    fontSize: 17,
    fontWeight: '900',
  },
  earningsToggle: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 14,
  },
  earningsToggleSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  earningsToggleTitle: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
  earningsValue: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
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
  filterButton: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 4,
  },
  filterText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  headerActionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  list: {
    gap: 12,
    padding: 16,
    paddingTop: 12,
  },
  listHeader: {
    gap: 12,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ff8128',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: 'center',
    padding: 10,
  },
  meta: {
    color: '#4b5563',
    fontSize: 14,
  },
  notes: {
    color: '#374151',
    fontSize: 14,
    fontStyle: 'italic',
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ff8128',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: 'center',
    padding: 10,
  },
  price: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  profileHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ff8128',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: 'center',
    padding: 10,
  },
  verifyHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ff8128',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: 'center',
    padding: 10,
  },
  verifyHeaderButtonActive: {
    backgroundColor: '#ff8128',
  },
  profileWideButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#15803d',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '100%',
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  profileWideText: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: '800',
  },
  pausedButton: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  pausedText: {
    color: '#4b5563',
  },
  rejectButton: {
    backgroundColor: '#fee2e2',
  },
  rejectText: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '800',
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  saveServicesButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  saveServicesButtonDisabled: {
    opacity: 0.55,
  },
  saveServicesText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  service: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  serviceChip: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  serviceChipActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  serviceChipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  serviceChipTextActive: {
    color: '#fff',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  servicesPanel: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  servicesToggle: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 12,
  },
  servicesToggleCopy: {
    flex: 1,
  },
  servicesToggleSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  servicesToggleTitle: {
    color: '#172033',
    fontSize: 14,
    fontWeight: '900',
  },
  status: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  status_confirmed: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  status_completed: {
    backgroundColor: '#e0f2fe',
    color: '#075985',
  },
  status_pending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  status_rejected: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  statusDefault: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 3,
  },
  summaryBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  summaryLabel: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  summaryValue: {
    color: '#ff8128',
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
  },
});
