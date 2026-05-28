import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { CustomerBottomNav } from '../../../components/customer-bottom-nav';
import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';

function errorMessage(error: any) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : 'Khong the tai danh sach.';
}

function formatPrice(price?: number | string) {
  const value = Number(price);
  if (!Number.isFinite(value)) return 'Lien he';
  return `${value.toLocaleString('vi-VN')} VND`;
}

function HousekeeperCard({
  item,
  onBook,
  onMessage,
  onOpen,
}: {
  item: Housekeeper;
  onBook: () => void;
  onMessage: () => void;
  onOpen: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.initials || item.fullName?.slice(0, 1) || 'H'}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={1} style={styles.name}>{item.fullName}</Text>
          <Text style={[styles.status, item.available ? styles.available : styles.unavailable]}>
            {item.available ? 'Nhan viec' : 'Tam nghi'}
          </Text>
        </View>

        <Text numberOfLines={2} style={styles.services}>{item.services || 'House cleaning'}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.rating}>★ {item.rating ?? item.avgRating ?? '0.0'}</Text>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={onMessage} style={styles.messageButton}>
            <Ionicons color="#ff8128" name="chatbubble-ellipses-outline" size={18} />
            <Text style={styles.messageText}>Nhan tin</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={onBook} style={styles.bookButton}>
            <Text style={styles.bookText}>Dat lich</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ServiceHousekeepersScreen() {
  const [error, setError] = useState<string | null>(null);
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    dbService?: string;
    recurring?: string;
    service?: string;
    title?: string;
  }>();

  const selectedService = String(params.service || 'all');
  const dbService = String(params.dbService || '');
  const title = String(params.title || (selectedService === 'all' ? 'All services' : selectedService));
  const recurring = String(params.recurring || '');

  const loadHousekeepers = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);
      const data = await housekeeperService.getAll(dbService || undefined);
      setHousekeepers(data);
    } catch (loadError: any) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dbService]);

  useEffect(() => {
    loadHousekeepers();
  }, [loadHousekeepers]);

  const filteredHousekeepers = useMemo(() => housekeepers, [housekeepers]);

  const openBooking = (housekeeper: Housekeeper) => {
    router.push({
      pathname: '/(customer)/booking/[housekeeperId]',
      params: {
        housekeeperId: String(housekeeper.id),
        recurring,
        service: title === 'All services' ? housekeeper.services?.split(',')[0]?.trim() || 'House cleaning' : title,
      },
    });
  };

  const openChat = (housekeeper: Housekeeper) => {
    router.push({
      pathname: '/chat/[bookingId]',
      params: {
        bookingId: 'direct',
        receiverId: String(housekeeper.userId),
        receiverName: housekeeper.fullName || 'Housekeeper',
      },
    });
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadHousekeepers(true)} tintColor="#ff8128" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: '/(customer)',
                  params: { refresh: String(Date.now()) },
                } as any)
              }
              style={styles.backButton}
            >
              <Ionicons color="#ff8128" name="chevron-back" size={22} />
              <Text style={styles.backText}>Home</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {filteredHousekeepers.length} housekeeper phu hop
              {recurring === 'monthly' ? ' cho lich hang thang' : ''}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadHousekeepers()} style={styles.retryButton}>
                <Text style={styles.retryText}>Thu lai</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {filteredHousekeepers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons color="#ff9a28" name="search-outline" size={70} />
              <Text style={styles.emptyTitle}>Chua co housekeeper phu hop</Text>
              <Text style={styles.emptyText}>Dich vu nay chua co housekeeper da duoc duyet, hoac ten dich vu trong backend chua khop.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {filteredHousekeepers.map((housekeeper) => (
                <HousekeeperCard
                  item={housekeeper}
                  key={String(housekeeper.id)}
                  onBook={() => openBooking(housekeeper)}
                  onMessage={() => openChat(housekeeper)}
                  onOpen={() => router.push(`/(customer)/housekeeper/${housekeeper.id}`)}
                />
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
  available: {
    backgroundColor: '#fff1e8',
    color: '#ff8128',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
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
    fontSize: 19,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
  },
  bookButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingVertical: 11,
  },
  bookText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13,
    padding: 15,
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 112,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 80,
  },
  emptyText: {
    color: '#687386',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 20,
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  list: {
    gap: 12,
    padding: 16,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  messageButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  name: {
    color: '#172033',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  price: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  rating: {
    color: '#172033',
    fontSize: 13,
    fontWeight: '900',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#991b1b',
    borderRadius: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  screen: {
    backgroundColor: '#f8f8fc',
    flex: 1,
  },
  services: {
    color: '#687386',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  status: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  subtitle: {
    color: '#687386',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  title: {
    color: '#172033',
    fontSize: 32,
    fontWeight: '900',
  },
  unavailable: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
});
