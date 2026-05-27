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
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../../components/customer-bottom-nav';
import { authService, type AuthUser } from '../../lib/auth';
import { housekeeperService, type Housekeeper } from '../../lib/housekeepers';

const services = [
  { title: 'Cleaning', subtitle: 'on-demand', icon: 'sparkles-outline', filter: 'Cleaning' },
  { title: 'Cleaning', subtitle: 'monthly', icon: 'calendar-outline', filter: 'Cleaning' },
  { title: 'Deep', subtitle: 'Cleaning', icon: 'home-outline', filter: 'Deep Cleaning' },
  { title: 'A/C Cleaning', subtitle: '', icon: 'snow-outline', filter: 'A/C Cleaning' },
  { title: 'Cooking', subtitle: '', icon: 'restaurant-outline', filter: 'Cooking' },
  { title: 'Laundry', subtitle: '', icon: 'shirt-outline', filter: 'Laundry' },
  { title: 'Elderly Care', subtitle: '', icon: 'heart-outline', filter: 'Elder Care' },
  { title: 'More', subtitle: 'services', icon: 'add-circle-outline', filter: '' },
];

const featured = [
  { title: 'Wellness Office', icon: 'leaf-outline' },
  { title: 'Pet Care', icon: 'heart-circle-outline' },
  { title: 'Patient Care', icon: 'medkit-outline' },
  { title: 'Home Moving', icon: 'cube-outline' },
];

function formatPrice(price?: number) {
  if (typeof price !== 'number') return 'Lien he';
  return `${price.toLocaleString('vi-VN')} VND`;
}

function compactName(name?: string) {
  return name?.split(' ')[0] || 'ban';
}

function TaskerCard({ item, onPress }: { item: Housekeeper; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={styles.taskerCard}>
      <View style={styles.taskerAvatar}>
        <Text style={styles.taskerAvatarText}>{item.initials || item.fullName?.slice(0, 1) || 'H'}</Text>
      </View>
      <View style={styles.taskerInfo}>
        <Text numberOfLines={1} style={styles.taskerName}>{item.fullName}</Text>
        <Text numberOfLines={1} style={styles.taskerMeta}>{item.services || 'House cleaning'}</Text>
        <View style={styles.taskerFooter}>
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

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
      setHousekeepers(data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || loadError.response?.data?.error || 'Khong the tai danh sach.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#ff8128" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.greeting}>Hi {compactName(user?.fullName)}</Text>
                <Text style={styles.heroCopy}>Dat dich vu cham soc nha cua nhanh va ro gia.</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.messageButton}>
                <Ionicons color="#fff" name="chatbubble-ellipses-outline" size={26} />
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
                  <Text style={styles.bookAgain}>Book again</Text>
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
            <Text style={styles.sectionTitle}>Service</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
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
              <TouchableOpacity activeOpacity={0.8} key={`${item.title}-${item.subtitle}`} style={styles.serviceItem}>
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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Taskers near you</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadData()} style={styles.retryButton}>
                <Text style={styles.retryText}>Thu lai</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.taskerList}>
            {housekeepers.slice(0, 6).map((item) => (
              <TaskerCard key={String(item.id)} item={item} onPress={() => router.push(`/(customer)/housekeeper/${item.id}`)} />
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
    color: '#18bf62',
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
    color: '#18bf62',
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
    color: '#18bf62',
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
  taskerAvatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  taskerAvatarText: {
    color: '#ff8128',
    fontSize: 17,
    fontWeight: '900',
  },
  taskerCard: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  taskerFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskerInfo: {
    flex: 1,
    gap: 5,
  },
  taskerList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  taskerMeta: {
    color: '#687386',
    fontSize: 13,
    fontWeight: '600',
  },
  taskerName: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
});
