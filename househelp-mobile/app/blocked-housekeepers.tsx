import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../lib/auth';
import { housekeeperPreferenceService } from '../lib/housekeeper-preferences';
import { housekeeperService, type Housekeeper } from '../lib/housekeepers';
import { useLanguage } from '../lib/language';

const copy = {
  en: {
    account: 'Account',
    emptyText: 'You can block from a housekeeper profile if you do not want to book them again.',
    emptyTitle: 'No blocked housekeepers yet',
    title: 'Block List',
    subtitle: 'Blocked housekeepers will not appear in your booking list.',
    unblock: 'Unblock',
  },
  vi: {
    account: 'Tài khoản',
    emptyText: 'Bạn có thể chặn từ màn hình hồ sơ housekeeper nếu không muốn đặt lại.',
    emptyTitle: 'Chưa có housekeeper bị chặn',
    title: 'Danh sách chặn',
    subtitle: 'Housekeeper bị chặn sẽ không hiện trong danh sách đặt lịch.',
    unblock: 'Bỏ chặn',
  },
} as const;

export default function BlockedHousekeepersScreen() {
  const [blocked, setBlocked] = useState<Housekeeper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
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
      const storedUser = await authService.checkAuthStatus();
      setUser(storedUser);

      if (!storedUser) {
        setBlocked([]);
        return;
      }

      const [blockedIds, allHousekeepers] = await Promise.all([
        housekeeperPreferenceService.getBlockedIds(storedUser.id),
        housekeeperService.getAll(undefined, { availableOnly: false }),
      ]);
      const blockedSet = new Set(blockedIds.map(String));
      setBlocked(allHousekeepers.filter((housekeeper) => blockedSet.has(String(housekeeper.id))));
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

  const unblock = async (housekeeperId: number) => {
    if (!user) return;
    await housekeeperPreferenceService.unblock(user.id, housekeeperId);
    setBlocked((items) => items.filter((item) => item.id !== housekeeperId));
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
          <Text style={styles.backText}>{text.account}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{text.title}</Text>
        <Text style={styles.subtitle}>{text.subtitle}</Text>

        {blocked.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons color="#ff9a28" name="ban-outline" size={64} />
            <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
            <Text style={styles.emptyText}>{text.emptyText}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {blocked.map((housekeeper) => (
              <View key={String(housekeeper.id)} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{housekeeper.initials || housekeeper.fullName?.slice(0, 1) || 'H'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text numberOfLines={1} style={styles.name}>{housekeeper.fullName}</Text>
                  <Text numberOfLines={1} style={styles.meta}>{housekeeper.services || 'House cleaning'}</Text>
                </View>
                <TouchableOpacity onPress={() => unblock(housekeeper.id)} style={styles.unblockButton}>
                  <Text style={styles.unblockText}>{text.unblock}</Text>
                </TouchableOpacity>
              </View>
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
  unblockButton: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  unblockText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
});
