import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { authService } from '../../lib/auth';
import { housekeeperService, type Housekeeper } from '../../lib/housekeepers';

function formatPrice(price?: number) {
  if (typeof price !== 'number') {
    return 'Lien he';
  }

  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatServices(services?: string) {
  if (!services) {
    return 'Chua cap nhat dich vu';
  }

  return services.split(',').filter(Boolean).join(', ');
}

function HousekeeperCard({ item, onPress }: { item: Housekeeper; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.initials || item.fullName?.slice(0, 1) || 'H'}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.name}>
            {item.fullName}
          </Text>
          <Text style={[styles.status, item.available ? styles.available : styles.unavailable]}>
            {item.available ? 'San sang' : 'Ban'}
          </Text>
        </View>

        <Text numberOfLines={1} style={styles.services}>
          {formatServices(item.services)}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>Danh gia {item.rating ?? item.avgRating ?? '0.0'}</Text>
          <Text style={styles.meta}>{item.reviewCount ?? 0} nhan xet</Text>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CustomerHome() {
  const [error, setError] = useState<string | null>(null);
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const loadHousekeepers = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      const data = await housekeeperService.getAll();
      setHousekeepers(data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || 'Khong the tai danh sach.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHousekeepers();
  }, [loadHousekeepers]);

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
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
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Nguoi giup viec</Text>
          <Text style={styles.subtitle}>{housekeepers.length} ho so san sang de xem</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.notificationButton}>
            <Text style={styles.notificationText}>Thong bao</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileHeaderButton}>
            <Text style={styles.profileHeaderText}>Tai khoan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Dang xuat</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.push('/(customer)/bookings')} style={styles.bookingsButton}>
        <Text style={styles.bookingsText}>Xem booking cua toi</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadHousekeepers()} style={styles.retryButton}>
            <Text style={styles.retryText}>Thu lai</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={housekeepers}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadHousekeepers(true)} />}
        renderItem={({ item }) => (
          <HousekeeperCard item={item} onPress={() => router.push(`/(customer)/housekeeper/${item.id}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chua co ho so nao</Text>
            <Text style={styles.emptyText}>Kiem tra lai backend hoac trang thai verified/approved cua housekeeper.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  available: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  bookingsButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 13,
  },
  bookingsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 22,
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
    marginHorizontal: 16,
    marginTop: 12,
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
    paddingBottom: 14,
    paddingTop: 28,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  headerTitle: {
    gap: 3,
  },
  list: {
    gap: 12,
    padding: 16,
    paddingBottom: 28,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  logoutText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
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
  meta: {
    color: '#6b7280',
    fontSize: 12,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  name: {
    color: '#111827',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  price: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  profileHeaderButton: {
    alignItems: 'center',
    backgroundColor: '#ecfeff',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  profileHeaderText: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '800',
  },
  profileWideButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 13,
  },
  profileWideText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '800',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#991b1b',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  services: {
    color: '#374151',
    fontSize: 14,
  },
  status: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 3,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  unavailable: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
});
