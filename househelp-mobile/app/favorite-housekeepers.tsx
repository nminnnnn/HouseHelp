import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../lib/auth';
import { housekeeperPreferenceService } from '../lib/housekeeper-preferences';
import { housekeeperService, type Housekeeper } from '../lib/housekeepers';

function formatPrice(price?: number | string) {
  const value = Number(price);
  if (!Number.isFinite(value)) return 'Lien he';
  return `${value.toLocaleString('vi-VN')} VND`;
}

export default function FavoriteHousekeepersScreen() {
  const [favorites, setFavorites] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async (refreshing = false) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const storedUser = await authService.checkAuthStatus();
      setUser(storedUser);

      if (!storedUser) {
        setFavorites([]);
        return;
      }

      const [favoriteIds, allHousekeepers] = await Promise.all([
        housekeeperPreferenceService.getFavoriteIds(storedUser.id),
        housekeeperService.getAll(undefined, { availableOnly: false }),
      ]);
      const favoriteSet = new Set(favoriteIds.map(String));
      setFavorites(allHousekeepers.filter((housekeeper) => favoriteSet.has(String(housekeeper.id))));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const removeFavorite = async (housekeeperId: number) => {
    if (!user) return;
    await housekeeperPreferenceService.unfavorite(user.id, housekeeperId);
    setFavorites((items) => items.filter((item) => item.id !== housekeeperId));
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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 44) }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#ff8128" />}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color="#ff8128" name="chevron-back" size={22} />
          <Text style={styles.backText}>Account</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Favorite Housekeepers</Text>
        <Text style={styles.subtitle}>Nhung nguoi ban muon uu tien dat lai.</Text>

        {favorites.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons color="#ff9a28" name="heart-outline" size={64} />
            <Text style={styles.emptyTitle}>Chua co housekeeper yeu thich</Text>
            <Text style={styles.emptyText}>Mo ho so housekeeper va bam trai tim de luu vao danh sach nay.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {favorites.map((housekeeper) => (
              <TouchableOpacity
                activeOpacity={0.86}
                key={String(housekeeper.id)}
                onPress={() => router.push(`/(customer)/housekeeper/${housekeeper.id}`)}
                style={styles.card}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{housekeeper.initials || housekeeper.fullName?.slice(0, 1) || 'H'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text numberOfLines={1} style={styles.name}>{housekeeper.fullName}</Text>
                  <Text numberOfLines={1} style={styles.meta}>{housekeeper.services || 'House cleaning'}</Text>
                  <Text style={styles.price}>{formatPrice(housekeeper.price)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFavorite(housekeeper.id)} style={styles.iconButton}>
                  <Ionicons color="#ff8128" name="heart" size={22} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    color: '#ff8128',
    fontSize: 18,
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
  card: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginTop: 24,
    padding: 28,
  },
  emptyText: {
    color: '#687386',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  list: {
    gap: 12,
    marginTop: 24,
  },
  meta: {
    color: '#687386',
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
  price: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f8f8fc',
    flex: 1,
  },
  subtitle: {
    color: '#687386',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '900',
  },
});
