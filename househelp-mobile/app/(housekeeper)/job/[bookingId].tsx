import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../../lib/auth';
import { bookingService, type Booking } from '../../../lib/bookings';

function formatPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${price.toLocaleString('vi-VN')} VND`;
}

function formatCompactPrice(value?: number | string) {
  const price = Number(value || 0);
  return `${Math.round(price / 1000).toLocaleString('vi-VN')}K`;
}

function formatDuration(booking?: Booking | null) {
  const duration = Number(booking?.duration || 0);
  return duration > 0 ? `${duration} Hours Estimated` : 'Duration not set';
}

function formatDateTime(booking?: Booking | null) {
  if (!booking) return '';

  const rawDate = booking.startDate || booking.date;

  if (!rawDate) return booking.time || 'No date';

  const date = new Date(rawDate).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${date}${booking.time ? ` • ${booking.time}` : ''}`;
}

export default function HousekeeperJobDetailScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loadBooking = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await authService.checkAuthStatus();

      if (!storedUser) {
        router.replace('/(auth)/login');
        return;
      }

      setUser(storedUser);
      const bookings = await bookingService.getForUser(storedUser.id);
      const nextBooking = bookings.find((item) => String(item.id) === String(bookingId)) || null;
      setBooking(nextBooking);
    } catch (error: any) {
      Alert.alert('Could not load job', error.response?.data?.message || error.response?.data?.error || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const earnings = useMemo(() => {
    const explicit = Number(booking?.housekeeperAmount || 0);
    const total = Number(booking?.totalPrice || 0);
    if (explicit > 0) return explicit;
    return Math.max(total - Number(booking?.platformFee || 0), Math.round(total * 0.8));
  }, [booking]);

  const customerTotal = Number(booking?.totalPrice || 0);
  const customerRequirements = useMemo(() => {
    const items = String(booking?.notes || '')
      .split(/\r?\n|;|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    return items.length ? items : ['None'];
  }, [booking?.notes]);
  const isPending = booking?.status === 'pending';
  const canComplete = booking?.status === 'confirmed' || booking?.status === 'in_progress';

  const openMaps = async () => {
    if (!booking?.location?.trim()) {
      Alert.alert('No address', 'This job does not have a customer address.');
      return;
    }

    const query = encodeURIComponent(booking.location.trim());
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert('Could not open Maps', booking.location);
      return;
    }

    await Linking.openURL(url);
  };

  const acceptJob = async () => {
    if (!booking || !user) return;
    try {
      setIsUpdating(true);
      await bookingService.confirm(booking.id, booking.housekeeperId);
      await loadBooking();
    } catch (error: any) {
      Alert.alert('Could not accept job', error.response?.data?.message || error.response?.data?.error || 'Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const completeJob = async () => {
    if (!booking || !user) return;
    try {
      setIsUpdating(true);
      await bookingService.complete(booking.id, booking.housekeeperId);
      await loadBooking();
    } catch (error: any) {
      Alert.alert('Could not complete job', error.response?.data?.message || error.response?.data?.error || 'Please try again.');
    } finally {
      setIsUpdating(false);
    }
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

  if (!booking) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Job not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Back to dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons color="#ff8128" name="chevron-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Job Details</Text>
          <TouchableOpacity onPress={loadBooking} style={styles.headerButton}>
            <Ionicons color="#ff8128" name="refresh" size={18} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 96, 120) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.jobHero}>
  {/* <View style={styles.jobTopRow}>
    <View style={styles.jobIcon}>
      <Ionicons
        color="#ff8128"
        name="briefcase-outline"
        size={20}
      />
    </View>

    <Text style={styles.distanceBadge}>
      2.4 miles away
    </Text>
  </View> */}

  <Text style={styles.jobTitle}>
    {booking.service || 'House cleaning'}
  </Text>

  <Text style={styles.jobMeta}>
    {formatDateTime(booking)}
  </Text>

  <Text style={styles.jobMeta}>
    {formatDuration(booking)}
  </Text>
</View>

          <View style={styles.mapCard}>
            <View style={styles.mapCanvas}>
              <View style={[styles.mapBlock, styles.mapGreenOne]} />
              <View style={[styles.mapBlock, styles.mapGreenTwo]} />
              <View style={[styles.mapBlock, styles.mapRoadOne]} />
              <View style={[styles.mapBlock, styles.mapRoadTwo]} />
              <View style={styles.mapPin}>
                <Ionicons color="#fff" name="location" size={26} />
              </View>
            </View>
            <View style={styles.addressRow}>
              <View style={styles.addressCopy}>
                <Text style={styles.kicker}>SERVICE ADDRESS</Text>
                <Text style={styles.address}>{booking.location || 'Address not provided'}</Text>
              </View>
              <TouchableOpacity onPress={openMaps} style={styles.mapsButton}>
                <Ionicons color="#ff8128" name="navigate-outline" size={18} />
                <Text style={styles.mapsText}>MAPS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons color="#ff8128" name="clipboard-outline" size={18} />
              <Text style={styles.sectionTitle}>Job Requirements</Text>
            </View>
            {customerRequirements.map((item) => (
              <View key={item} style={styles.requirementRow}>
                <Ionicons color={item === 'None' ? '#94a3b8' : '#16a34a'} name={item === 'None' ? 'remove-circle-outline' : 'checkmark-circle-outline'} size={16} />
                <Text style={styles.requirementText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.kicker}>CUSTOMER NOTE</Text>
            <Text style={styles.noteText}>
              {booking.notes || 'None'}
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.earningsKicker}>YOUR ESTIMATED EARNINGS</Text>
            <View style={styles.earningRow}>
              <Text style={styles.earningLabel}>Customer total</Text>
              <Text style={styles.earningValue}>{formatPrice(customerTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Your estimated earnings</Text>
              <Text style={styles.totalValue}>{formatCompactPrice(earnings)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
          {isPending ? (
            <TouchableOpacity disabled={isUpdating} onPress={acceptJob} style={styles.primaryButton}>
              {isUpdating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryText}>Accept Job Request</Text>
                  <Ionicons color="#fff" name="arrow-forward" size={18} />
                </>
              )}
            </TouchableOpacity>
          ) : canComplete ? (
            <TouchableOpacity disabled={isUpdating} onPress={completeJob} style={styles.primaryButton}>
              {isUpdating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryText}>Complete Job</Text>
                  <Ionicons color="#fff" name="checkmark-circle-outline" size={18} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push(`/chat/${booking.id}`)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Message Customer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  address: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  jobTopRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
  addressCopy: {
    flex: 1,
  },
  addressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 12,
  },
  distanceBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  earningLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  earningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  earningsKicker: {
    color: '#ff8128',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  earningValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
  },
  footer: {
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  jobHero: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  jobIcon: {
  alignItems: 'center',
  backgroundColor: '#fff1e8',
  borderRadius: 18,
  height: 36,
  justifyContent: 'center',
  width: 36,
},
  jobMeta: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  jobTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 12,
  },
  kicker: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 4,
  },
  mapBlock: {
    position: 'absolute',
  },
  mapCanvas: {
    backgroundColor: '#dbeafe',
    height: 118,
    overflow: 'hidden',
  },
  mapCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  mapGreenOne: {
    backgroundColor: '#a7d980',
    height: 58,
    left: -20,
    top: 18,
    transform: [{ rotate: '-14deg' }],
    width: 180,
  },
  mapGreenTwo: {
    backgroundColor: '#c3e895',
    height: 46,
    right: -10,
    top: 58,
    transform: [{ rotate: '-14deg' }],
    width: 170,
  },
  mapPin: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    left: '45%',
    position: 'absolute',
    top: 28,
    width: 48,
  },
  mapRoadOne: {
    backgroundColor: '#f8fafc',
    height: 18,
    left: -10,
    top: 65,
    transform: [{ rotate: '-14deg' }],
    width: 260,
  },
  mapRoadTwo: {
    backgroundColor: '#f8fafc',
    height: 18,
    left: 95,
    top: 0,
    transform: [{ rotate: '62deg' }],
    width: 210,
  },
  mapsButton: {
    alignItems: 'center',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapsText: {
    color: '#ff8128',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  noteText: {
    color: '#334155',
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  requirementRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 11,
  },
  requirementText: {
    color: '#334155',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  secondaryButton: {
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  totalLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  totalRow: {
    alignItems: 'center',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
  },
  totalValue: {
    color: '#ff8128',
    fontSize: 28,
    fontWeight: '900',
  },
});
