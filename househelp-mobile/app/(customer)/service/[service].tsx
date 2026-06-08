import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../../../components/customer-bottom-nav';
import { authService } from '../../../lib/auth';
import { housekeeperPreferenceService } from '../../../lib/housekeeper-preferences';
import { housekeeperService, parseServices, type Housekeeper } from '../../../lib/housekeepers';
import { useLanguage } from '../../../lib/language';
import type { AppLanguage } from '../../../lib/storage';

const copy = {
  en: {
    available: 'Available',
    all: 'All',
    book: 'Book',
    contact: 'Contact',
    emptyText: 'This service has no approved housekeepers yet, or the backend service name does not match.',
    emptyTitle: 'No matching housekeepers',
    errorFallback: 'Could not load the list.',
    filters: 'Filters',
    filtersApplied: 'Filters on',
    maxPrice: 'Max price',
    minRating: 'Rating',
    locationFilter: 'City or address',
    locationPlaceholder: 'Da Nang, Hue...',
    home: 'Home',
    message: 'Message',
    monthlySuffix: ' for monthly schedule',
    reset: 'Reset',
    retry: 'Try again',
    subtitle: (count: number) => `${count} matching housekeeper${count === 1 ? '' : 's'}`,
    unavailable: 'Paused',
  },
  vi: {
    available: 'Nh\u1eadn vi\u1ec7c',
    all: 'T\u1ea5t c\u1ea3',
    book: '\u0110\u1eb7t l\u1ecbch',
    contact: 'Li\u00ean h\u1ec7',
    emptyText: 'D\u1ecbch v\u1ee5 n\u00e0y ch\u01b0a c\u00f3 housekeeper \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t, ho\u1eb7c t\u00ean d\u1ecbch v\u1ee5 trong backend ch\u01b0a kh\u1edbp.',
    emptyTitle: 'Ch\u01b0a c\u00f3 housekeeper ph\u00f9 h\u1ee3p',
    errorFallback: 'Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch.',
    filters: 'B\u1ed9 l\u1ecdc',
    filtersApplied: '\u0110ang l\u1ecdc',
    maxPrice: 'Gi\u00e1 t\u1ed1i \u0111a',
    minRating: 'S\u1ed1 sao',
    locationFilter: 'Th\u00e0nh ph\u1ed1 ho\u1eb7c \u0111\u1ecba ch\u1ec9',
    locationPlaceholder: '\u0110\u00e0 N\u1eb5ng, Hu\u1ebf...',
    home: 'Trang ch\u1ee7',
    message: 'Nh\u1eafn tin',
    monthlySuffix: ' cho l\u1ecbch h\u00e0ng th\u00e1ng',
    reset: 'X\u00f3a l\u1ecdc',
    retry: 'Th\u1eed l\u1ea1i',
    subtitle: (count: number) => `${count} housekeeper ph\u00f9 h\u1ee3p`,
    unavailable: 'T\u1ea1m ngh\u1ec9',
  },
} as const;
function errorMessage(error: any, fallback: string) {
  const value = error?.response?.data?.message || error?.response?.data?.error || error?.message;
  return typeof value === 'string' ? value : fallback;
}

function formatPrice(price: number | string | undefined, contactLabel: string) {
  const value = Number(price);
  if (!Number.isFinite(value)) return contactLabel;
  return `${value.toLocaleString('vi-VN')} VND`;
}

function normalizeText(value?: string | number | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function searchableLocation(housekeeper: Housekeeper) {
  return normalizeText([
    housekeeper.city,
    housekeeper.district,
    housekeeper.address,
    housekeeper.location,
    housekeeper.bio,
  ].filter(Boolean).join(' '));
}

function HousekeeperCard({
  item,
  onBook,
  onMessage,
  onOpen,
  text,
}: {
  item: Housekeeper;
  onBook: () => void;
  onMessage: () => void;
  onOpen: () => void;
  text: (typeof copy)[AppLanguage];
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
            {item.available ? text.available : text.unavailable}
          </Text>
        </View>

        <Text numberOfLines={2} style={styles.services}>{parseServices(item.services).join(', ') || 'House cleaning'}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.rating}>★ {item.rating ?? item.avgRating ?? '0.0'}</Text>
          <Text style={styles.price}>{formatPrice(item.price, text.contact)}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.85} onPress={onMessage} style={styles.messageButton}>
            <Ionicons color="#ff8128" name="chatbubble-ellipses-outline" size={18} />
            <Text style={styles.messageText}>{text.message}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={onBook} style={styles.bookButton}>
            <Text style={styles.bookText}>{text.book}</Text>
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState(0);
  const router = useRouter();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const text = copy[language];
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
      const [storedUser, data] = await Promise.all([
        authService.checkAuthStatus(),
        housekeeperService.getAll(dbService || undefined, { availableOnly: false }),
      ]);

      if (!storedUser) {
        setHousekeepers(data);
        return;
      }

      const blockedIds = await housekeeperPreferenceService.getBlockedIds(storedUser.id);
      setHousekeepers(housekeeperPreferenceService.filterBlocked(data, blockedIds));
    } catch (loadError: any) {
      setError(errorMessage(loadError, text.errorFallback));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dbService, text.errorFallback]);

  useEffect(() => {
    loadHousekeepers();
  }, [loadHousekeepers]);

  const filteredHousekeepers = useMemo(() => {
    const normalizedLocation = normalizeText(locationFilter);
    const maxPriceValue = Number(maxPrice.replace(/[^\d]/g, ''));

    return housekeepers.filter((housekeeper) => {
      const rating = Number(housekeeper.avgRating ?? housekeeper.rating ?? 0);
      if (minRating > 0 && (!Number.isFinite(rating) || rating < minRating)) return false;

      const price = Number(housekeeper.price);
      if (Number.isFinite(maxPriceValue) && maxPriceValue > 0 && (!Number.isFinite(price) || price > maxPriceValue)) return false;

      if (normalizedLocation && !searchableLocation(housekeeper).includes(normalizedLocation)) return false;

      return true;
    });
  }, [housekeepers, locationFilter, maxPrice, minRating]);

  const resetFilters = () => {
    setLocationFilter('');
    setMaxPrice('');
    setMinRating(0);
  };
  const hasActiveFilters = minRating > 0 || maxPrice.trim().length > 0 || locationFilter.trim().length > 0;

  const openBooking = (housekeeper: Housekeeper) => {
    router.push({
      pathname: '/(customer)/booking/[housekeeperId]',
      params: {
        housekeeperId: String(housekeeper.id),
        recurring,
        service: title === 'All services' ? parseServices(housekeeper.services)[0] || 'House cleaning' : title,
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
              <Text style={styles.backText}>{text.home}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {text.subtitle(filteredHousekeepers.length)}
              {recurring === 'monthly' ? text.monthlySuffix : ''}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadHousekeepers()} style={styles.retryButton}>
                <Text style={styles.retryText}>{text.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.filterArea}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsFilterOpen((current) => !current)}
              style={[styles.filterToggle, hasActiveFilters && styles.filterToggleActive]}
            >
              <Ionicons color={hasActiveFilters ? '#fff' : '#ff8128'} name="filter-outline" size={18} />
              <Text style={[styles.filterToggleText, hasActiveFilters && styles.filterToggleTextActive]}>
                {hasActiveFilters ? text.filtersApplied : text.filters}
              </Text>
              <Ionicons color={hasActiveFilters ? '#fff' : '#ff8128'} name={isFilterOpen ? 'chevron-up' : 'chevron-down'} size={16} />
            </TouchableOpacity>
          </View>

          {isFilterOpen ? (
            <View style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <View style={styles.filterTitleRow}>
                  <Ionicons color="#ff8128" name="options-outline" size={18} />
                  <Text style={styles.filterTitle}>{text.filters}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.78} onPress={resetFilters} style={styles.resetButton}>
                  <Text style={styles.resetText}>{text.reset}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>{text.minRating}</Text>
              <View style={styles.ratingFilterRow}>
                {[0, 3, 4, 5].map((rating) => (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    key={rating}
                    onPress={() => setMinRating(rating)}
                    style={[styles.ratingChip, minRating === rating && styles.ratingChipActive]}
                  >
                    <Text style={[styles.ratingChipText, minRating === rating && styles.ratingChipTextActive]}>
                      {rating === 0 ? text.all : `${rating}+`}
                    </Text>
                    {rating > 0 ? <Ionicons color={minRating === rating ? '#fff' : '#ff8128'} name="star" size={13} /> : null}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.filterInputRow}>
                <View style={styles.filterInputGroup}>
                  <Text style={styles.filterLabel}>{text.maxPrice}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setMaxPrice}
                    placeholder="100000"
                    style={styles.filterInput}
                    value={maxPrice}
                  />
                </View>
                <View style={styles.filterInputGroup}>
                  <Text style={styles.filterLabel}>{text.locationFilter}</Text>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setLocationFilter}
                    placeholder={text.locationPlaceholder}
                    style={styles.filterInput}
                    value={locationFilter}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {filteredHousekeepers.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons color="#ff9a28" name="search-outline" size={70} />
              <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
              <Text style={styles.emptyText}>{text.emptyText}</Text>
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
                  text={text}
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
  filterCard: {
    backgroundColor: '#fff',
    borderColor: '#f1e5d8',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
  },
  filterArea: {
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    color: '#172033',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  filterInputGroup: {
    flex: 1,
    gap: 7,
  },
  filterInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  filterTitle: {
    color: '#172033',
    fontSize: 15,
    fontWeight: '900',
  },
  filterTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  filterToggle: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  filterToggleActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  filterToggleText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  filterToggleTextActive: {
    color: '#fff',
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
  ratingChip: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  ratingChipActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  ratingChipText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  ratingChipTextActive: {
    color: '#fff',
  },
  ratingFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#fff7ed',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  resetText: {
    color: '#ff8128',
    fontSize: 12,
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
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  unavailable: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
});
