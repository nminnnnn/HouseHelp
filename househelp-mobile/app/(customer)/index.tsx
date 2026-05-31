import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { CustomerBottomNav } from '../../components/customer-bottom-nav';
import { authService, type AuthUser } from '../../lib/auth';
import { bookingService } from '../../lib/bookings';
import { housekeeperPreferenceService } from '../../lib/housekeeper-preferences';
import { housekeeperService, type Housekeeper } from '../../lib/housekeepers';
import { useLanguage } from '../../lib/language';

function errorMessage(error: any) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : 'Khong the tai danh sach.';
}

const services = [
  { title: 'Cleaning', subtitle: 'on-demand', icon: 'sparkles-outline', key: 'cleaning', filter: 'Dọn dẹp nhà cửa' },
  { title: 'Cleaning', subtitle: 'monthly', icon: 'calendar-outline', key: 'cleaning-monthly', filter: 'Dọn dẹp nhà cửa' },
  { title: 'Deep', subtitle: 'Cleaning', icon: 'home-outline', key: 'deep-cleaning', filter: 'Dọn dẹp nhà cửa' },
  { title: 'A/C Cleaning', subtitle: '', icon: 'snow-outline', key: 'industrial-cleaning', filter: 'Vệ sinh công nghiệp' },
  { title: 'Cooking', subtitle: '', icon: 'restaurant-outline', key: 'cooking', filter: 'Nấu ăn' },
  { title: 'Laundry', subtitle: '', icon: 'shirt-outline', key: 'laundry', filter: 'Giặt ủi quần áo' },
  { title: 'Elderly Care', subtitle: '', icon: 'heart-outline', key: 'elder-care', filter: 'Chăm sóc người già' },
  { title: 'More', subtitle: 'services', icon: 'add-circle-outline', key: 'all', filter: '' },
];

const featured = [
  { title: 'Wellness Office', icon: 'leaf-outline' },
  { title: 'Pet Care', icon: 'heart-circle-outline' },
  { title: 'Patient Care', icon: 'medkit-outline' },
  { title: 'Home Moving', icon: 'cube-outline' },
];

const copy = {
  en: {
    bookAgain: 'Book again',
    greeting: 'Hi',
    heroCopy: 'Book home care services quickly with clear pricing.',
    housekeepersNearYou: 'Housekeepers near you',
    previousHousekeepers: 'People who worked for you',
    retry: 'Try again',
    service: 'Service',
    seeAll: 'See all',
  },
  vi: {
    bookAgain: 'Đặt lại',
    greeting: 'Xin chào',
    heroCopy: 'Đặt dịch vụ chăm sóc nhà cửa nhanh và rõ giá.',
    housekeepersNearYou: 'Người giúp việc gần bạn',
    previousHousekeepers: 'Người từng làm cho bạn',
    retry: 'Thử lại',
    service: 'Dịch vụ',
    seeAll: 'Xem tất cả',
  },
} as const;

function formatPrice(price?: number | string) {
  const value = Number(price);
  if (!Number.isFinite(value)) return 'Lien he';
  return `${value.toLocaleString('vi-VN')} VND`;
}

function compactName(name?: string) {
  return name?.split(' ')[0] || 'ban';
}

function HousekeeperCard({ item, onPress }: { item: Housekeeper; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={styles.housekeeperCard}>
      <View style={styles.housekeeperAvatar}>
        <Text style={styles.housekeeperAvatarText}>{item.initials || item.fullName?.slice(0, 1) || 'H'}</Text>
      </View>
      <View style={styles.housekeeperInfo}>
        <Text numberOfLines={1} style={styles.housekeeperName}>{item.fullName}</Text>
        <Text numberOfLines={1} style={styles.housekeeperMeta}>{item.services || 'House cleaning'}</Text>
        <View style={styles.housekeeperFooter}>
          <Text style={styles.rating}>★ {item.rating ?? item.avgRating ?? '0.0'}</Text>
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
  const [previousHousekeepers, setPreviousHousekeepers] = useState<Housekeeper[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const text = copy[language];

  const loadData = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const [storedUser, data] = await Promise.all([
        authService.checkAuthStatus(),
        housekeeperService.getAll(),
      ]);
      setUser(storedUser);

      if (!storedUser) {
        setHousekeepers(data);
        setPreviousHousekeepers([]);
        return;
      }

      const [blockedIds, bookings] = await Promise.all([
        housekeeperPreferenceService.getBlockedIds(storedUser.id),
        bookingService.getForUser(storedUser.id).catch(() => []),
      ]);
      const visibleHousekeepers = housekeeperPreferenceService.filterBlocked(data, blockedIds);
      const visibleMap = new Map(visibleHousekeepers.map((housekeeper) => [String(housekeeper.id), housekeeper]));
      const previousIds = Array.from(
        new Set(bookings.map((booking) => String(booking.housekeeperId)).filter((housekeeperId) => visibleMap.has(housekeeperId))),
      );
      setHousekeepers(visibleHousekeepers);
      setPreviousHousekeepers(previousIds.map((housekeeperId) => visibleMap.get(housekeeperId)!).slice(0, 4));
    } catch (loadError: any) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refresh]);

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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#ff8128" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.greeting}>{text.greeting} {compactName(user?.fullName)}</Text>
                <Text style={styles.heroCopy}>{text.heroCopy}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.messageButton}>
                <Ionicons color="#fff" name="notifications-outline" size={26} />
                <View style={styles.messageDot} />
              </TouchableOpacity>
            </View>

            <View style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <View>
                  <Text style={styles.recentTitle}>Cleaning</Text>
                  <Text numberOfLines={1} style={styles.recentAddress}>
                    {String(user?.address || 'Them dia chi de dat lich nhanh hon')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(customer)/bookings')}>
                  <Text style={styles.bookAgain}>{text.bookAgain}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.rewardRow}>
                <View style={styles.rewardCell}>
                  <Ionicons color="#ff8128" name="logo-bitcoin" size={24} />
                  <Text style={styles.rewardText}>0 d</Text>
                </View>
                <View style={[styles.rewardCell, styles.rewardBorder]}>
                  <Ionicons color="#ff8128" name="ribbon-outline" size={24} />
                  <Text style={styles.rewardText}>0 points</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{text.service}</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>{text.seeAll}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.featuredRow}>
            {featured.map((item) => (
              <TouchableOpacity activeOpacity={0.8} key={item.title} style={styles.featuredItem}>
                <Text style={styles.newBadge}>NEW</Text>
                <Ionicons color="#ff8128" name={item.icon as any} size={42} />
                <Text numberOfLines={2} style={styles.featuredText}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.serviceGrid}>
            {services.map((item) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={`${item.title}-${item.subtitle}`}
                onPress={() => {
                  if (!item.filter) {
                    router.push({
                      pathname: '/(customer)/service/[service]',
                      params: { service: 'all', title: 'All services' },
                    });
                    return;
                  }

                  const title = item.subtitle ? `${item.title} ${item.subtitle}` : item.title;
                  router.push({
                    pathname: '/(customer)/service/[service]',
                    params: {
                      dbService: item.filter,
                      recurring: item.subtitle === 'monthly' ? 'monthly' : '',
                      service: item.key,
                      title,
                    },
                  });
                }}
                style={styles.serviceItem}
              >
                <Ionicons color="#ff8a35" name={item.icon as any} size={38} />
                <Text style={styles.serviceTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.serviceSubtitle}>{item.subtitle}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.banner}>
            <View>
              <Text style={styles.bannerKicker}>SPECIAL OFFER</Text>
              <Text style={styles.bannerTitle}>Lam sach nha cua, nhe dau viec nha</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(customer)/bookings')} style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Dat ngay</Text>
            </TouchableOpacity>
          </View>

          {previousHousekeepers.length ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{text.previousHousekeepers}</Text>
              </View>
              <View style={styles.housekeeperList}>
                {previousHousekeepers.map((item) => (
                  <HousekeeperCard
                    key={`previous-${String(item.id)}`}
                    item={item}
                    onPress={() => router.push(`/(customer)/housekeeper/${item.id}`)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadData()} style={styles.retryButton}>
                <Text style={styles.retryText}>{text.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{text.housekeepersNearYou}</Text>
          </View>

          <View style={styles.housekeeperList}>
            {housekeepers.slice(0, 6).map((item) => (
              <HousekeeperCard key={String(item.id)} item={item} onPress={() => router.push(`/(customer)/housekeeper/${item.id}`)} />
            ))}
          </View>
        </ScrollView>
        <CustomerBottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: '#fff3e9',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
  },
  bannerButton: {
    backgroundColor: '#ff8128',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  bannerKicker: {
    color: '#ff8128',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 5,
  },
  bannerTitle: {
    color: '#1d2636',
    fontSize: 16,
    fontWeight: '900',
    maxWidth: 210,
  },
  bookAgain: {
    color: '#ff8128',
    fontSize: 17,
    fontWeight: '900',
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
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    padding: 14,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  featuredItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
    minWidth: 78,
  },
  featuredRow: {
    backgroundColor: '#fff4ec',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  featuredText: {
    color: '#20283a',
    fontSize: 13,
    fontWeight: '800',
    minHeight: 34,
    textAlign: 'center',
  },
  greeting: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
  },
  hero: {
    backgroundColor: '#ff8128',
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    maxWidth: 250,
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  messageButton: {
    alignItems: 'center',
    borderColor: '#fff',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  messageDot: {
    backgroundColor: '#ef4444',
    borderColor: '#ff8128',
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: 2,
    top: 2,
    width: 12,
  },
  newBadge: {
    backgroundColor: '#f04452',
    borderRadius: 999,
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  price: {
    color: '#ff8128',
    fontSize: 12,
    fontWeight: '900',
  },
  rating: {
    color: '#1d2636',
    fontSize: 12,
    fontWeight: '800',
  },
  recentAddress: {
    color: '#7d8796',
    fontSize: 15,
    marginTop: 5,
    maxWidth: 210,
  },
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    elevation: 7,
    padding: 18,
    shadowColor: '#85400d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  recentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recentTitle: {
    color: '#ff8128',
    fontSize: 25,
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
  rewardBorder: {
    borderLeftColor: '#edf0f4',
    borderLeftWidth: 1,
  },
  rewardCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  rewardRow: {
    borderTopColor: '#edf0f4',
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
  },
  rewardText: {
    color: '#4a5568',
    fontSize: 17,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#ff8128',
    flex: 1,
  },
  screen: {
    backgroundColor: '#fff',
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 14,
  },
  sectionTitle: {
    color: '#172033',
    fontSize: 28,
    fontWeight: '900',
  },
  seeAll: {
    color: '#ff8128',
    fontSize: 18,
    fontWeight: '900',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    rowGap: 24,
  },
  serviceItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    width: '25%',
  },
  serviceSubtitle: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  serviceTitle: {
    color: '#20283a',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  housekeeperAvatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  housekeeperAvatarText: {
    color: '#ff8128',
    fontSize: 17,
    fontWeight: '900',
  },
  housekeeperCard: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  housekeeperFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  housekeeperInfo: {
    flex: 1,
    gap: 5,
  },
  housekeeperList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  housekeeperMeta: {
    color: '#687386',
    fontSize: 13,
    fontWeight: '600',
  },
  housekeeperName: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
});
