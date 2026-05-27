import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';

function formatPrice(price?: number | string) {
  const value = Number(price);
  if (!Number.isFinite(value)) {
    return 'Lien he';
  }

  return `${value.toLocaleString('vi-VN')} VND`;
}

function formatServices(services?: string) {
  if (!services) {
    return ['Chua cap nhat dich vu'];
  }

  const items = services
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : ['Chua cap nhat dich vu'];
}

export default function HousekeeperDetailScreen() {
  const [error, setError] = useState<string | null>(null);
  const [housekeeper, setHousekeeper] = useState<Housekeeper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const loadDetail = useCallback(async () => {
    if (!id) {
      setError('Thieu ma ho so housekeeper.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await housekeeperService.getById(id);
      setHousekeeper(data);
    } catch (detailError: any) {
      setError(detailError.response?.data?.message || detailError.response?.data?.error || 'Khong the tai ho so.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !housekeeper) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Khong tai duoc ho so</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadDetail} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Thu lai</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Quay lai</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const services = formatServices(housekeeper.services);

  const openChat = () => {
    if (!housekeeper.userId) {
      return;
    }

    router.push({
      pathname: '/chat/[bookingId]',
      params: {
        bookingId: 'direct',
        receiverId: String(housekeeper.userId),
        receiverName: housekeeper.fullName || 'Housekeeper',
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Quay lai</Text>
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {housekeeper.initials || housekeeper.fullName?.slice(0, 1) || 'H'}
          </Text>
        </View>
        <Text style={styles.name}>{housekeeper.fullName}</Text>
        <Text style={styles.location}>{housekeeper.location || 'Chua cap nhat khu vuc'}</Text>
        <Text style={[styles.status, housekeeper.available ? styles.available : styles.unavailable]}>
          {housekeeper.available ? 'Nhan viec' : 'Tam nghi'}
        </Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{housekeeper.rating ?? housekeeper.avgRating ?? '0.0'}</Text>
          <Text style={styles.statLabel}>Danh gia</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{housekeeper.reviewCount ?? 0}</Text>
          <Text style={styles.statLabel}>Nhan xet</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatPrice(housekeeper.price)}</Text>
          <Text style={styles.statLabel}>Gia tham khao</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gioi thieu</Text>
        <Text style={styles.bodyText}>
          {housekeeper.bio || housekeeper.description || housekeeper.experience || 'Ho so chua co mo ta.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dich vu</Text>
        <View style={styles.chips}>
          {services.map((service) => (
            <Text key={service} style={styles.chip}>
              {service}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lien he</Text>
        <TouchableOpacity disabled={!housekeeper.userId} onPress={openChat} style={styles.chatButton}>
          <Ionicons color="#ff8128" name="chatbubble-ellipses-outline" size={22} />
          <View style={styles.chatCopy}>
            <Text style={styles.chatTitle}>Nhan tin voi housekeeper</Text>
            <Text style={styles.chatSubtitle}>Hoi lich trong, trao doi yeu cau va thong tin dich vu.</Text>
          </View>
          <Ionicons color="#ff8128" name="chevron-forward" size={20} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push(`/(customer)/booking/${housekeeper.id}`)} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Dat lich</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  available: {
    backgroundColor: '#fff1e8',
    color: '#ff8128',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  chip: {
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  chatCopy: {
    flex: 1,
  },
  chatSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  chatTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  divider: {
    backgroundColor: '#e5e7eb',
    width: 1,
  },
  errorText: {
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  location: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  name: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 18,
    padding: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  secondaryButton: {
    marginTop: 16,
    padding: 8,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  stats: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    padding: 16,
  },
  statValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  status: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unavailable: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
});
