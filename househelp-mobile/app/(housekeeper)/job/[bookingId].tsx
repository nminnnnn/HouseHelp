import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../../lib/auth';
import { bookingService, type Booking } from '../../../lib/bookings';
import { formatVietnamDate } from '../../../lib/date';
import { useLanguage } from '../../../lib/language';

const jobCopy = {
  en: {
    customerNote: 'Customer notes',
    customerPays: 'Customer pays',
    hours: 'hours',
    location: 'Work location',
    noData: 'None',
    requirements: 'Job requirements',
    expectedEarnings: 'Expected earnings',
    youReceive: 'You receive',
    footerReceive: 'You will receive',
    arrived: 'I have arrived',
    qrTitle: 'My QR code',
    qrSubtitle: 'The customer scans this code to verify your identity and start the job.',
    qrHint: 'This QR code is valid for 30 minutes.',
  },
  vi: {
    customerNote: 'Ghi ch\u00fa kh\u00e1ch h\u00e0ng',
    customerPays: 'Kh\u00e1ch h\u00e0ng thanh to\u00e1n',
    hours: 'gi\u1edd',
    location: '\u0110\u1ecba \u0111i\u1ec3m l\u00e0m vi\u1ec7c',
    noData: 'Kh\u00f4ng c\u00f3',
    requirements: 'Y\u00eau c\u1ea7u c\u00f4ng vi\u1ec7c',
    expectedEarnings: 'Thu nh\u1eadp d\u1ef1 ki\u1ebfn',
    youReceive: 'B\u1ea1n nh\u1eadn \u0111\u01b0\u1ee3c',
    footerReceive: 'B\u1ea1n s\u1ebd nh\u1eadn \u0111\u01b0\u1ee3c',
    arrived: 'T\u00f4i \u0111\u00e3 \u0111\u1ebfn',
    qrTitle: 'M\u00e3 QR c\u1ee7a t\u00f4i',
    qrSubtitle: 'Kh\u00e1ch h\u00e0ng qu\u00e9t m\u00e3 n\u00e0y \u0111\u1ec3 x\u00e1c nh\u1eadn \u0111\u00fang ng\u01b0\u1eddi v\u00e0 b\u1eaft \u0111\u1ea7u ca l\u00e0m.',
    qrHint: 'M\u00e3 QR c\u00f3 hi\u1ec7u l\u1ef1c trong 30 ph\u00fat.',
  },
} as const;

const serviceLabels: Record<string, string> = {
  'Ch\u0103m s\u00f3c ng\u01b0\u1eddi gi\u00e0': 'Elder care',
  'Ch\u0103m s\u00f3c tr\u1ebb em': 'Child care',
  'D\u1ecdn d\u1eb9p': 'Cleaning',
  'D\u1ecdn d\u1eb9p nh\u00e0 c\u1eeda': 'Home cleaning',
  'Gi\u1eb7t \u1ee7i': 'Laundry',
  'Gi\u1eb7t \u1ee7i qu\u1ea7n \u00e1o': 'Laundry',
  'L\u00e0m v\u01b0\u1eddn': 'Gardening',
  'N\u1ea5u \u0103n': 'Cooking',
  'V\u1ec7 sinh c\u00f4ng nghi\u1ec7p': 'Industrial cleaning',
  'V\u1ec7 sinh nh\u00e0 c\u1eeda': 'Home cleaning',
};

function displayService(value: string | undefined, language: string) {
  if (!value) return 'House cleaning';
  if (language !== 'en') return value;

  return value.split(',').map((item) => {
    const service = item.trim();
    const monthly = /\s+monthly$/i.test(service);
    const base = service.replace(/\s+monthly$/i, '');
    return `${serviceLabels[base] || base}${monthly ? ' monthly' : ''}`;
  }).join(', ');
}

function formatPrice(value: number | string | undefined, language: string) {
  const price = Number(value || 0);
  return language === 'en'
    ? `${price.toLocaleString('en-US')} VND`
    : `${price.toLocaleString('vi-VN')}\u0111`;
}

function formatDateTime(booking?: Booking | null) {
  if (!booking) return '';

  const rawDate = booking.startDate || booking.date;

  if (!rawDate) return booking.time || 'No date';

  const date = formatVietnamDate(rawDate, 'No date');

  return `${date}${booking.time ? ` • ${booking.time}` : ''}`;
}

function parseCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || String(value).trim() === '') return null;

  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function getBookingDestination(booking?: Booking | null) {
  const rawAddress = String(booking?.location || '').trim();
  let latitude = parseCoordinate(booking?.latitude, -90, 90);
  let longitude = parseCoordinate(booking?.longitude, -180, 180);

  const legacyCoordinates = rawAddress.match(
    /\(\s*(-?\d{1,2}(?:[.,]\d+)?)\s*,\s*(-?\d{1,3}(?:[.,]\d+)?)\s*\)\s*$/,
  );

  if (legacyCoordinates) {
    latitude ??= parseCoordinate(legacyCoordinates[1], -90, 90);
    longitude ??= parseCoordinate(legacyCoordinates[2], -180, 180);
  }

  const address = rawAddress
    .replace(/\s*\(\s*-?\d{1,2}(?:[.,]\d+)?\s*,\s*-?\d{1,3}(?:[.,]\d+)?\s*\)\s*$/, '')
    .trim();

  return { address, latitude, longitude };
}

export default function HousekeeperJobDetailScreen() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [completionPhotoUri, setCompletionPhotoUri] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const text = jobCopy[language];

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
  const canShowArrivalQr = booking?.status === 'confirmed';
  const canComplete = booking?.status === 'in_progress' && !booking.completionRequestedAt;
  const awaitingCustomerConfirmation = booking?.status === 'in_progress' && !!booking.completionRequestedAt;
  const openMaps = async () => {
    const destination = getBookingDestination(booking);

    if (destination.latitude === null && destination.longitude === null && !destination.address) {
      Alert.alert('No address', 'This job does not have a customer address.');
      return;
    }

    const hasCoordinates = destination.latitude !== null && destination.longitude !== null;
    const url = hasCoordinates
      ? `https://www.google.com/maps/search/?api=1&query=${destination.latitude}%2C${destination.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination.address)}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert('Could not open Maps', destination.address || 'Invalid coordinates');
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
    if (!booking || !user || !completionPhotoUri) return;
    try {
      setIsUpdating(true);
      await bookingService.complete(booking.id, completionPhotoUri);
      setCompletionModalVisible(false);
      setCompletionPhotoUri(null);
      Alert.alert('Photo submitted', 'Waiting for the customer to confirm the completed work.');
      await loadBooking();
    } catch (error: any) {
      Alert.alert('Could not complete job', error.response?.data?.message || error.response?.data?.error || 'Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const takeCompletionPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access to photograph the completed work.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.82,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setCompletionPhotoUri(result.assets[0].uri);
    }
  };

  const showArrivalQr = async () => {
    if (!booking) return;
    try {
      setIsQrLoading(true);
      const result = await bookingService.getArrivalQr(booking.id);
      setQrToken(result.qrToken);
      setQrVisible(true);
    } catch (error: any) {
      Alert.alert('Could not create QR', error.response?.data?.message || error.response?.data?.error || 'Please try again.');
    } finally {
      setIsQrLoading(false);
    }
  };

  const copyQrToken = async () => {
    if (!qrToken) return;
    await Clipboard.setStringAsync(qrToken);
    Alert.alert('Copied', 'QR token đã được copy. Bạn có thể đăng nhập customer và dán token để test trên một iPhone.');
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

  const destination = getBookingDestination(booking);
  const addressParts = destination.address.split(',').map((part) => part.trim()).filter(Boolean);
  const primaryAddress = addressParts[0] || 'Address not provided';
  const secondaryAddress = addressParts.slice(1).join(', ');
  const coordinates = destination.latitude !== null && destination.longitude !== null
    ? `${destination.latitude.toFixed(6)}, ${destination.longitude.toFixed(6)}`
    : '';
  const bookingDate = formatVietnamDate(booking.startDate || booking.date, 'No date');
  const statusLabel = booking.status === 'pending'
    ? 'Pending'
    : booking.status === 'confirmed'
      ? 'Confirmed'
      : booking.status === 'in_progress'
        ? 'In progress'
        : booking.status === 'completed'
          ? 'Completed'
          : booking.status === 'cancelled'
            ? 'Cancelled'
            : 'Rejected';
  const statusDescription = booking.status === 'pending'
    ? 'Job request is waiting for your response.'
    : booking.status === 'confirmed'
      ? 'The job has been accepted and is ready to begin.'
      : booking.status === 'in_progress'
        ? 'The service is currently in progress.'
        : booking.status === 'completed'
          ? 'The service has been completed.'
          : 'This job is no longer active.';

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

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 126, 148) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.heroRow}>
              <View style={styles.serviceIcon}>
                <Ionicons color="#fff" name="sparkles" size={30} />
              </View>
              <View style={styles.heroCopy}>
                <Text numberOfLines={2} style={styles.jobTitle}>{displayService(booking.service, language)}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{bookingDate}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{booking.time || '--:--'}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{Number(booking.duration || 0) || '-'} {text.hours}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
              <Text style={styles.statusDescription}>{statusDescription}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{text.location}</Text>
            </View>
            <View style={styles.locationCopy}>
              <Text style={styles.primaryAddress}>{primaryAddress}</Text>
              {secondaryAddress ? <Text style={styles.secondaryAddress}>{secondaryAddress}</Text> : null}
              {coordinates ? <Text style={styles.coordinateText}>{coordinates}</Text> : null}
            </View>
            <View style={styles.mapCanvas}>
              <View style={[styles.mapBlock, styles.mapGreenOne]} />
              <View style={[styles.mapBlock, styles.mapGreenTwo]} />
              <View style={[styles.mapBlock, styles.mapRoadOne]} />
              <View style={[styles.mapBlock, styles.mapRoadTwo]} />
              <View style={styles.mapPin}><Ionicons color="#fff" name="location" size={28} /></View>
            </View>
            <TouchableOpacity onPress={openMaps} style={styles.mapsButton}>
              <Ionicons color="#ff8128" name="navigate-outline" size={19} />
              <Text style={styles.mapsText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.earningsCard}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{text.expectedEarnings}</Text>
            </View>
            <View style={styles.earningsColumns}>
              <View style={styles.earningsColumn}>
                <Text style={styles.earningsAmount}>{formatPrice(earnings, language)}</Text>
                <Text style={styles.earningsCaption}>{text.youReceive}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsColumn}>
                <Text style={styles.customerAmount}>{formatPrice(customerTotal, language)}</Text>
                <Text style={styles.earningsCaption}>{text.customerPays}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{text.requirements}</Text>
            </View>
            <View style={styles.sectionBody}>
              {customerRequirements.map((item) => <Text key={item} style={styles.bodyText}>{item === 'None' ? text.noData : item}</Text>)}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{text.customerNote}</Text>
            </View>
            <Text style={[styles.bodyText, styles.sectionBody]}>{booking.notes || text.noData}</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 18) }]}>
          <View style={styles.footerEarnings}>
            <Text style={styles.footerLabel}>{text.footerReceive}</Text>
            <Text style={styles.footerAmount}>{formatPrice(earnings, language)}</Text>
          </View>
          <View style={styles.footerAction}>
          {isPending ? (
            <TouchableOpacity disabled={isUpdating} onPress={acceptJob} style={styles.primaryButton}>
              {isUpdating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryText}>Accept</Text>
                  <Ionicons color="#fff" name="arrow-forward" size={18} />
                </>
              )}
            </TouchableOpacity>
          ) : canShowArrivalQr ? (
            <TouchableOpacity disabled={isQrLoading} onPress={showArrivalQr} style={styles.primaryButton}>
              {isQrLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryText}>{text.arrived}</Text>
                  <Ionicons color="#fff" name="qr-code-outline" size={18} />
                </>
              )}
            </TouchableOpacity>
          ) : canComplete ? (
            <TouchableOpacity disabled={isUpdating} onPress={() => setCompletionModalVisible(true)} style={styles.primaryButton}>
              {isUpdating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.primaryText}>Photograph completed work</Text>
                  <Ionicons color="#fff" name="camera-outline" size={18} />
                </>
              )}
            </TouchableOpacity>
          ) : awaitingCustomerConfirmation ? (
            <View style={styles.waitingButton}>
              <Ionicons color="#b45309" name="time-outline" size={18} />
              <Text style={styles.waitingText}>Waiting for customer confirmation</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push(`/chat/${booking.id}`)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Message Customer</Text>
            </TouchableOpacity>
          )}
          </View>
        </View>

        <Modal animationType="fade" onRequestClose={() => setQrVisible(false)} transparent visible={qrVisible}>
          <View style={styles.modalBackdrop}>
            <View style={styles.qrCard}>
              <TouchableOpacity onPress={() => setQrVisible(false)} style={styles.qrCloseButton}>
                <Ionicons color="#64748b" name="close" size={22} />
              </TouchableOpacity>
              <Text style={styles.qrTitle}>{text.qrTitle}</Text>
              <Text style={styles.qrSubtitle}>{text.qrSubtitle}</Text>
              <View style={styles.qrBox}>
                {qrToken ? <QRCode size={210} value={qrToken} /> : <ActivityIndicator color="#ff8128" />}
              </View>
              {qrToken ? (
                <TouchableOpacity onPress={copyQrToken} style={styles.copyTokenButton}>
                  <Ionicons color="#fff" name="copy-outline" size={18} />
                  <Text style={styles.copyTokenText}>Copy QR Token</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.qrHint}>{text.qrHint}</Text>
            </View>
          </View>
        </Modal>

        <Modal animationType="slide" onRequestClose={() => setCompletionModalVisible(false)} transparent visible={completionModalVisible}>
          <View style={styles.modalBackdrop}>
            <View style={styles.completionCard}>
              <Text style={styles.qrTitle}>Completion proof</Text>
              <Text style={styles.qrSubtitle}>Take a clear photo of the work area. The customer must approve this photo before payment and review.</Text>
              {completionPhotoUri ? (
                <Image source={{ uri: completionPhotoUri }} style={styles.completionPreview} />
              ) : (
                <View style={styles.completionPlaceholder}>
                  <Ionicons color="#ff8128" name="camera-outline" size={42} />
                  <Text style={styles.completionPlaceholderText}>No photo taken</Text>
                </View>
              )}
              <TouchableOpacity disabled={isUpdating} onPress={takeCompletionPhoto} style={styles.secondaryActionButton}>
                <Ionicons color="#ff8128" name="camera-outline" size={18} />
                <Text style={styles.secondaryActionText}>{completionPhotoUri ? 'Take another photo' : 'Open camera'}</Text>
              </TouchableOpacity>
              <View style={styles.completionActions}>
                <TouchableOpacity disabled={isUpdating} onPress={() => setCompletionModalVisible(false)} style={styles.cancelCompletionButton}>
                  <Text style={styles.cancelCompletionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isUpdating || !completionPhotoUri} onPress={completeJob} style={[styles.submitCompletionButton, !completionPhotoUri && styles.submitCompletionDisabled]}>
                  {isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitCompletionText}>Send</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const legacyStyles = StyleSheet.create({
  cancelCompletionButton: {
    alignItems: 'center',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelCompletionText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '900',
  },
  completionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  completionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxWidth: 480,
    padding: 20,
    width: '100%',
  },
  completionPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 210,
    justifyContent: 'center',
    marginTop: 16,
  },
  completionPlaceholderText: {
    color: '#9a4a10',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  completionPreview: {
    borderRadius: 8,
    height: 230,
    marginTop: 16,
    width: '100%',
  },
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
  copyTokenButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  copyTokenText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
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
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
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
  qrBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    padding: 16,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    width: '100%',
  },
  qrCloseButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 34,
    zIndex: 1,
  },
  qrHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  qrSubtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    paddingRight: 20,
  },
  qrTitle: {
    color: '#0f172a',
    fontSize: 24,
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
  secondaryActionButton: {
    alignItems: 'center',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 46,
  },
  secondaryActionText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  submitCompletionButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  submitCompletionDisabled: {
    backgroundColor: '#fdba74',
  },
  submitCompletionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
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
  waitingButton: {
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  waitingText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '900',
  },
});

const styles = {
  ...legacyStyles,
  ...StyleSheet.create({
    safeArea: {
      backgroundColor: '#F7F7F8',
      flex: 1,
    },
    screen: {
      backgroundColor: '#F7F7F8',
      flex: 1,
    },
    header: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderBottomColor: '#ECEFF3',
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    headerButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    headerTitle: {
      color: '#0F172A',
      fontSize: 20,
      fontWeight: '800',
    },
    content: {
      gap: 14,
      paddingHorizontal: 14,
      paddingTop: 16,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      elevation: 2,
      padding: 18,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    heroRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    serviceIcon: {
      alignItems: 'center',
      backgroundColor: '#ff8128',
      borderRadius: 30,
      height: 60,
      justifyContent: 'center',
      shadowColor: '#ff8128',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      width: 60,
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    jobTitle: {
      color: '#0F172A',
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23,
    },
    metaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    metaItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    metaText: {
      color: '#0F172A',
      fontSize: 13,
      fontWeight: '700',
    },
    metaDivider: {
      backgroundColor: '#D8DEE7',
      height: 18,
      width: 1,
    },
    statusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    statusBadge: {
      alignItems: 'center',
      backgroundColor: '#FFF3E8',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    statusText: {
      color: '#ff8128',
      fontSize: 13,
      fontWeight: '800',
    },
    statusDescription: {
      color: '#64748B',
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    cardTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    cardTitle: {
      color: '#0F172A',
      flex: 1,
      fontSize: 15,
      fontWeight: '900',
    },
    softIcon: {
      alignItems: 'center',
      backgroundColor: '#FFF3E8',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    locationCopy: {
      marginTop: 12,
    },
    primaryAddress: {
      color: '#0F172A',
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 22,
    },
    secondaryAddress: {
      color: '#64748B',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 3,
    },
    coordinateText: {
      color: '#64748B',
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
    },
    mapCanvas: {
      backgroundColor: '#DBEAFE',
      borderRadius: 14,
      height: 150,
      marginTop: 16,
      overflow: 'hidden',
    },
    mapPin: {
      alignItems: 'center',
      backgroundColor: '#ff8128',
      borderRadius: 25,
      height: 50,
      justifyContent: 'center',
      left: '43%',
      position: 'absolute',
      top: 48,
      width: 50,
    },
    mapsButton: {
      alignItems: 'center',
      borderColor: '#ff8128',
      borderRadius: 13,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 12,
      minHeight: 50,
      paddingHorizontal: 14,
    },
    mapsText: {
      color: '#ff8128',
      fontSize: 15,
      fontWeight: '800',
    },
    earningsCard: {
      backgroundColor: '#FFF3E8',
      borderRadius: 20,
      elevation: 1,
      padding: 18,
      shadowColor: '#ff8128',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 9,
    },
    earningsColumns: {
      alignItems: 'center',
      flexDirection: 'row',
      marginTop: 18,
    },
    earningsColumn: {
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    earningsDivider: {
      backgroundColor: '#FDBA74',
      height: 54,
      marginHorizontal: 10,
      width: 1,
    },
    earningsAmount: {
      color: '#ff8128',
      fontSize: 21,
      fontWeight: '900',
      textAlign: 'center',
    },
    customerAmount: {
      color: '#0F172A',
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    earningsCaption: {
      color: '#64748B',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 5,
      textAlign: 'center',
    },
    sectionBody: {
      marginTop: 10,
    },
    bodyText: {
      color: '#64748B',
      fontSize: 14,
      lineHeight: 21,
    },
    footer: {
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderTopColor: '#E7EAF0',
      borderTopWidth: 1,
      bottom: 0,
      elevation: 10,
      flexDirection: 'row',
      gap: 12,
      left: 0,
      paddingHorizontal: 14,
      paddingTop: 12,
      position: 'absolute',
      right: 0,
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    footerEarnings: {
      flexShrink: 0,
      width: 122,
    },
    footerLabel: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '700',
    },
    footerAmount: {
      color: '#ff8128',
      fontSize: 17,
      fontWeight: '900',
      marginTop: 3,
    },
    footerAction: {
      alignItems: 'flex-end',
      flex: 1,
      minWidth: 0,
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: '#ff8128',
      borderRadius: 18,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      maxWidth: 300,
      minHeight: 56,
      paddingHorizontal: 18,
    },
    primaryText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
    },
    waitingButton: {
      alignItems: 'center',
      backgroundColor: '#FFFBEB',
      borderColor: '#FDE68A',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: 8,
    },
    waitingText: {
      color: '#B45309',
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
  }),
};
