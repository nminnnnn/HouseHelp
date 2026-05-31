import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { bookingService, type Booking } from '../../lib/bookings';
import { housekeeperService, type Housekeeper, type HousekeeperEarnings } from '../../lib/housekeepers';

type FilterKey = 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'rejected';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tat ca' },
  { key: 'pending', label: 'Cho xu ly' },
  { key: 'confirmed', label: 'Da nhan' },
  { key: 'in_progress', label: 'Dang lam' },
  { key: 'completed', label: 'Hoan thanh' },
  { key: 'rejected', label: 'Tu choi' },
];

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Da huy',
    completed: 'Hoan thanh',
    confirmed: 'Da xac nhan',
    in_progress: 'Dang lam',
    pending: 'Cho xu ly',
    rejected: 'Da tu choi',
  };

  return labels[status] || status;
}

function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatDate(booking: Booking) {
  return booking.startDate || booking.date || 'Chua co ngay';
}

function JobCard({
  item,
  isUpdating,
  onChat,
  onComplete,
  onConfirm,
  onReject,
}: {
  item: Booking;
  isUpdating: boolean;
  onChat: () => void;
  onComplete: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const isPending = item.status === 'pending';
  const canComplete = item.status === 'confirmed' || item.status === 'in_progress';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text numberOfLines={1} style={styles.service}>
          {item.service || 'Dich vu'}
        </Text>
        <Text style={[styles.status, styles[`status_${item.status}` as keyof typeof styles] || styles.statusDefault]}>
          {statusLabel(item.status)}
        </Text>
      </View>

      <Text style={styles.meta}>Khach hang: {item.customerName || `#${item.customerId}`}</Text>
      <Text style={styles.meta}>Ngay: {formatDate(item)}</Text>
      <Text style={styles.meta}>
        Gio: {item.time || 'Chua co'} - {item.duration || 0} gio
      </Text>
      <Text style={styles.meta}>Dia chi: {item.location || 'Chua co'}</Text>
      {item.notes ? <Text style={styles.notes}>Ghi chu: {item.notes}</Text> : null}
      <Text style={styles.price}>{formatPrice(item.totalPrice)}</Text>

      <TouchableOpacity onPress={onChat} style={styles.chatButton}>
        <Text style={styles.chatText}>Chat</Text>
      </TouchableOpacity>

      {isPending ? (
        <View style={styles.actions}>
          <TouchableOpacity disabled={isUpdating} onPress={onReject} style={[styles.actionButton, styles.rejectButton]}>
            <Text style={styles.rejectText}>{isUpdating ? 'Dang xu ly' : 'Tu choi'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={isUpdating} onPress={onConfirm} style={[styles.actionButton, styles.confirmButton]}>
            <Text style={styles.confirmText}>{isUpdating ? 'Dang xu ly' : 'Xac nhan'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canComplete ? (
        <TouchableOpacity disabled={isUpdating} onPress={onComplete} style={styles.completeButton}>
          <Text style={styles.completeText}>{isUpdating ? 'Dang xu ly' : 'Hoan thanh cong viec'}</Text>
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
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
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
      const storedUser = await authService.checkAuthStatus();

      if (!storedUser) {
        router.replace('/(auth)/login');
        return;
      }

      setUser(storedUser);
      const [data, housekeeperProfile, housekeeperEarnings] = await Promise.all([
        bookingService.getForUser(storedUser.id),
        housekeeperService.getProfileByUserId(storedUser.id),
        housekeeperService.getEarnings(storedUser.id).catch(() => null),
      ]);
      setBookings(data);
      setProfile(housekeeperProfile);
      setEarnings(housekeeperEarnings);
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

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'all') {
      return bookings;
    }

    return bookings.filter((booking) => booking.status === activeFilter);
  }, [activeFilter, bookings]);

  const pendingCount = useMemo(() => bookings.filter((booking) => booking.status === 'pending').length, [bookings]);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  const handleToggleAvailability = async () => {
    if (!user) return;

    try {
      setIsTogglingAvailability(true);
      const nextAvailable = !profile?.available;
      const targetUserId = profile?.userId || user.id;
      const updatedProfile = await housekeeperService.updateAvailability(targetUserId, nextAvailable);
      setProfile((current) => ({ ...(current || updatedProfile), ...updatedProfile, available: nextAvailable }));
    } catch (toggleError: any) {
      Alert.alert(
        'Khong cap nhat duoc',
        toggleError.response?.data?.message || toggleError.response?.data?.error || 'Vui long thu lai.',
      );
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleConfirm = async (booking: Booking) => {
    try {
      setUpdatingId(booking.id);
      await bookingService.confirm(booking.id, booking.housekeeperId);
      await loadBookings(true);
    } catch (confirmError: any) {
      Alert.alert(
        'Khong the xac nhan',
        confirmError.response?.data?.message || confirmError.response?.data?.error || 'Vui long thu lai.',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (booking: Booking) => {
    Alert.alert('Tu choi booking', 'Ban co chac muon tu choi booking nay?', [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Tu choi',
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdatingId(booking.id);
            await bookingService.reject(booking.id);
            await loadBookings(true);
          } catch (rejectError: any) {
            Alert.alert(
              'Khong the tu choi',
              rejectError.response?.data?.message || rejectError.response?.data?.error || 'Vui long thu lai.',
            );
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  const handleComplete = async (booking: Booking) => {
    Alert.alert('Hoan thanh cong viec', 'Ban xac nhan da hoan thanh booking nay?', [
      { text: 'Huy', style: 'cancel' },
      {
        text: 'Hoan thanh',
        onPress: async () => {
          try {
            setUpdatingId(booking.id);
            await bookingService.complete(booking.id, booking.housekeeperId);
            await loadBookings(true);
          } catch (completeError: any) {
            Alert.alert(
              'Khong the hoan thanh',
              completeError.response?.data?.message || completeError.response?.data?.error || 'Vui long thu lai.',
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
            <Text style={[styles.availabilityText, profile?.available ? styles.availableText : styles.pausedText]}>
              {isTogglingAvailability ? 'Dang cap nhat' : profile?.available ? 'Dang nhan viec' : 'Dang tam nghi'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.notificationButton}>
            <Text style={styles.notificationText}>Thong bao</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileHeaderButton}>
            <Text style={styles.profileHeaderText}>Tai khoan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(housekeeper)/verification')} style={styles.verifyHeaderButton}>
            <Text style={styles.verifyHeaderText}>Xac minh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Dang xuat</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{bookings.length}</Text>
            <Text style={styles.summaryLabel}>Tong booking</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{pendingCount}</Text>
            <Text style={styles.summaryLabel}>Cho xu ly</Text>
          </View>
        </View>

        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsTitle}>Thu nhap & doi soat</Text>
            <Text style={styles.earningsBadge}>Platform payout</Text>
          </View>
          <View style={styles.earningsGrid}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{formatPrice(earnings?.pendingPayout)}</Text>
              <Text style={styles.earningsLabel}>MoMo dang tam giu</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{formatPrice(earnings?.paidOut)}</Text>
              <Text style={styles.earningsLabel}>Da chi tra</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{formatPrice(earnings?.cashCollected)}</Text>
              <Text style={styles.earningsLabel}>Tien mat da thu</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsValue}>{formatPrice(earnings?.cashPlatformFeeDue)}</Text>
              <Text style={styles.earningsLabel}>Phi platform can doi soat</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            onPress={() => setActiveFilter(filter.key)}
            style={[styles.filterButton, activeFilter === filter.key && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        data={filteredBookings}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadBookings(true)} />}
        renderItem={({ item }) => (
          <JobCard
            isUpdating={updatingId === item.id}
            item={item}
            onChat={() => router.push(`/chat/${item.id}`)}
            onComplete={() => handleComplete(item)}
            onConfirm={() => handleConfirm(item)}
            onReject={() => handleReject(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chua co booking</Text>
            <Text style={styles.emptyText}>Khi khach hang dat lich, booking se hien o day.</Text>
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
    backgroundColor: '#14532d',
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
    backgroundColor: '#f8f8fc',
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
  earningsValue: {
    color: '#15803d',
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
    borderColor: '#d8dde3',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  list: {
    gap: 12,
    padding: 16,
    paddingTop: 12,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#15803d',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  logoutText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#15803d',
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  notificationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  price: {
    color: '#15803d',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  profileHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#15803d',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  profileHeaderText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '800',
  },
  verifyHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  verifyHeaderText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
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
  service: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
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
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
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
    color: '#15803d',
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '800',
  },
});
