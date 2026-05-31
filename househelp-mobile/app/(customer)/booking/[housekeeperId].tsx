import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { addressService, addressText } from '../../../lib/addresses';
import { authService, type AuthUser } from '../../../lib/auth';
import { bookingService } from '../../../lib/bookings';
import { housekeeperPreferenceService } from '../../../lib/housekeeper-preferences';
import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';
import { profileService } from '../../../lib/profile';

const HCM_UTC_OFFSET_HOURS = 7;
const MIN_BOOKING_NOTICE_HOURS = 3;

function hcmNow() {
  return new Date(Date.now() + HCM_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

function todayDate() {
  const now = hcmNow();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOptions() {
  return Array.from({ length: 14 }, (_, index) => {
    const date = hcmNow();
    date.setUTCDate(date.getUTCDate() + index);

    return {
      label: index === 0
        ? 'Hom nay'
        : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', weekday: 'short' }),
      value: toDateValue(date),
    };
  });
}

const timeOptions = ['07:00', '08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00', '18:00'];
const bookingSteps = ['Dich vu', 'Dia chi', 'Ngay gio', 'Thoi luong', 'Xac nhan'] as const;
const PICK_HOUSEKEEPER_FEE = 15000;
const paymentMethods = [
  { key: 'cash', label: 'Tien mat' },
  { key: 'momo', label: 'MoMo' },
] as const;

type BookingStep = (typeof bookingSteps)[number];

function serviceList(services?: string) {
  return String(services || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstService(services?: string, selectedService?: string | string[]) {
  const paramService = Array.isArray(selectedService) ? selectedService[0] : selectedService;
  const options = serviceList(services);
  const matchedService = options.find((item) => item.toLowerCase() === paramService?.trim().toLowerCase());

  if (matchedService) {
    return matchedService;
  }

  return options[0] || 'House cleaning';
}

function parseDuration(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function parsePrice(value?: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidTimeFrame(value: string) {
  return value.trim().length >= 3;
}

function parseStartTime(value: string) {
  const match = value.trim().match(/(\d{1,2})(?::|h)?(\d{2})?/i);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function bookingStartUtcMs(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const start = parseStartTime(timeValue);

  if (!year || !month || !day || !start) {
    return null;
  }

  return Date.UTC(year, month - 1, day, start.hour - HCM_UTC_OFFSET_HOURS, start.minute, 0, 0);
}

function minBookingStartUtcMs() {
  return Date.now() + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000;
}

type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function locationLabel(location: SelectedLocation) {
  return `${location.address} (${formatCoordinate(location.latitude)}, ${formatCoordinate(location.longitude)})`;
}

export default function CreateBookingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<BookingStep>('Dich vu');
  const [date, setDate] = useState(todayDate());
  const [duration, setDuration] = useState('2');
  const [housekeeper, setHousekeeper] = useState<Housekeeper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState('');
  const [mapQuery, setMapQuery] = useState('');
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 16.4637,
    longitude: 107.5909,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  });
  const [nowTick, setNowTick] = useState(Date.now());
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'momo'>('cash');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [service, setService] = useState('');
  const [time, setTime] = useState('08:00');
  const [user, setUser] = useState<AuthUser | null>(null);
  const { housekeeperId, recurring, service: selectedService } = useLocalSearchParams<{
    housekeeperId: string;
    recurring?: string;
    service?: string;
  }>();
  const router = useRouter();

  const loadSelectedAddress = useCallback(async (storedUser: AuthUser | null) => {
    if (!storedUser) return;

    try {
      const profile = await profileService.getProfile(storedUser.id);
      const [savedAddresses, selectedAddressId] = await Promise.all([
        addressService.getAll(storedUser.id, profile),
        addressService.getSelectedId(storedUser.id),
      ]);
      const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId) || savedAddresses[0];

      if (selectedAddress) {
        const nextAddress = addressText(selectedAddress);
        setLocation(nextAddress);
        setSelectedLocation(null);
      }
    } catch {
      // User can still enter or pick an address manually.
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!housekeeperId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [storedUser, detail] = await Promise.all([
        authService.checkAuthStatus(),
        housekeeperService.getById(housekeeperId),
      ]);

      setUser(storedUser);
      await loadSelectedAddress(storedUser);
      setHousekeeper(detail);
      setService(firstService(detail.services, selectedService));
      if (recurring === 'monthly') {
        setDuration('3');
      }
    } catch (error: any) {
      Alert.alert('Khong tai duoc du lieu', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsLoading(false);
    }
  }, [housekeeperId, loadSelectedAddress, recurring, selectedService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const intervalId = setInterval(() => setNowTick(Date.now()), 60000);

    return () => clearInterval(intervalId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSelectedAddress(user);
    }, [loadSelectedAddress, user]),
  );

  const basePrice = useMemo(() => {
    const price = parsePrice(housekeeper?.price);
    return price * parseDuration(duration);
  }, [duration, housekeeper?.price]);
  const totalPrice = basePrice + PICK_HOUSEKEEPER_FEE;
  const unitPrice = useMemo(() => parsePrice(housekeeper?.price), [housekeeper?.price]);
  const serviceOptions = useMemo(() => serviceList(housekeeper?.services), [housekeeper?.services]);
  const availableDates = useMemo(() => {
    void nowTick;
    return dateOptions();
  }, [nowTick]);
  const isTimeOptionDisabled = useCallback((timeValue: string) => {
    const startUtcMs = bookingStartUtcMs(date, timeValue);
    return !startUtcMs || startUtcMs < nowTick + MIN_BOOKING_NOTICE_HOURS * 60 * 60 * 1000;
  }, [date, nowTick]);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place: any = results[0];
      const parts = [
        place?.name,
        place?.street,
        place?.district,
        place?.city,
        place?.region,
      ].filter(Boolean);

      return parts.length > 0 ? parts.join(', ') : `Vi tri da chon ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    } catch {
      return `Vi tri da chon ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    }
  }, []);

  const getDeviceLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw new Error('permission');
    }

    const current = await Location.getCurrentPositionAsync({});
    return current.coords;
  }, []);

  const chooseCoordinate = useCallback(async (latitude: number, longitude: number) => {
    setMapRegion((current) => ({
      ...current,
      latitude,
      longitude,
    }));

    const address = await reverseGeocode(latitude, longitude);
    const nextLocation = { address, latitude, longitude };
    setSelectedLocation(nextLocation);
    setLocation(locationLabel(nextLocation));
  }, [reverseGeocode]);

  const centerOnDeviceLocation = useCallback(async () => {
    try {
      setIsMapLoading(true);
      const coords = await getDeviceLocation();
      await chooseCoordinate(coords.latitude, coords.longitude);
    } catch {
      Alert.alert('Khong the truy cap vi tri', 'Hay kiem tra quyen vi tri va thu lai.');
    } finally {
      setIsMapLoading(false);
    }
  }, [chooseCoordinate, getDeviceLocation]);

  const openMapPicker = useCallback(async () => {
    setIsMapVisible(true);

    if (selectedLocation && selectedLocation.latitude !== 0 && selectedLocation.longitude !== 0) {
      setMapRegion((current) => ({
        ...current,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      }));
      return;
    }

    try {
      setIsMapLoading(true);
      const coords = await getDeviceLocation();
      await chooseCoordinate(coords.latitude, coords.longitude);
    } catch {
      Alert.alert('Khong lay duoc vi tri', 'Ban co the cham truc tiep tren ban do de chon dia chi.');
    } finally {
      setIsMapLoading(false);
    }
  }, [getDeviceLocation, chooseCoordinate, selectedLocation]);

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    chooseCoordinate(latitude, longitude);
  };

  const searchAddressOnMap = async () => {
    const query = mapQuery.trim();

    if (!query) {
      Alert.alert('Nhap dia chi', 'Vui long nhap dia chi can tim.');
      return;
    }

    try {
      setIsMapLoading(true);
      const results = await Location.geocodeAsync(query);

      if (!results.length) {
        Alert.alert('Khong tim thay', 'Vui long nhap dia chi cu the hon.');
        return;
      }

      const result = results[0];
      const nextLocation = {
        address: query,
        latitude: result.latitude,
        longitude: result.longitude,
      };
      setMapRegion((current) => ({
        ...current,
        latitude: result.latitude,
        longitude: result.longitude,
      }));
      setSelectedLocation(nextLocation);
      setLocation(locationLabel(nextLocation));
    } catch {
      Alert.alert('Khong tim duoc dia chi', 'Vui long thu lai hoac cham truc tiep tren ban do.');
    } finally {
      setIsMapLoading(false);
    }
  };

  const updateLocationAddress = (value: string) => {
    setLocation(value);
    setSelectedLocation((current) => (current ? { ...current, address: value } : current));
  };

  const validateCurrentStep = () => {
    if (currentStep === 'Dich vu' && !service.trim()) {
      Alert.alert('Chua chon dich vu', 'Vui long chon dich vu can dat.');
      return false;
    }

    if (currentStep === 'Dia chi' && !location.trim()) {
      Alert.alert('Chua chon dia chi', 'Vui long chon dia chi lam viec.');
      return false;
    }

    if (currentStep === 'Ngay gio') {
      if (!date.trim() || !time.trim()) {
        Alert.alert('Thieu ngay gio', 'Vui long chon ngay va khung gio.');
        return false;
      }

      if (!isValidTimeFrame(time)) {
        Alert.alert('Khung gio chua hop le', 'Vui long nhap khung gio muon thue, vi du: 08:00-11:00 hoac 8h den 11h.');
        return false;
      }

      const startUtcMs = bookingStartUtcMs(date, time);

      if (!startUtcMs) {
        Alert.alert('Khung gio chua hop le', 'Vui long nhap gio bat dau hop le, vi du: 08:00-11:00 hoac 8h den 11h.');
        return false;
      }

      if (startUtcMs < minBookingStartUtcMs()) {
        Alert.alert(
          'Lich qua gan',
          `Vui long chon lich cach thoi diem hien tai it nhat ${MIN_BOOKING_NOTICE_HOURS} tieng theo gio Ho Chi Minh (UTC+7).`,
        );
        return false;
      }
    }

    if (currentStep === 'Thoi luong' && parseDuration(duration) <= 0) {
      Alert.alert('Thoi luong chua hop le', 'Vui long nhap so gio muon thue.');
      return false;
    }

    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    const currentIndex = bookingSteps.indexOf(currentStep);
    const nextStep = bookingSteps[currentIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const goBackStep = () => {
    const currentIndex = bookingSteps.indexOf(currentStep);
    const previousStep = bookingSteps[currentIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep);
      return;
    }
    router.back();
  };

  const createBooking = async () => {
    if (!user || !housekeeper) {
      Alert.alert('Can dang nhap', 'Vui long dang nhap lai de dat lich.');
      router.replace('/(auth)/login');
      return;
    }

    if (!housekeeper.available) {
      Alert.alert('Housekeeper dang tam nghi', 'Vui long chon housekeeper khac dang nhan viec.');
      return;
    }

    if (!service.trim() || !date.trim() || !time.trim() || !location.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long chon dich vu, ngay, khung gio va dia chi.');
      return;
    }

    const blockedHousekeeper = await housekeeperPreferenceService.isBlocked(user.id, housekeeper.id);
    if (blockedHousekeeper) {
      Alert.alert('Housekeeper da bi chan', 'Vui long bo chan housekeeper nay neu ban muon dat lich lai.');
      return;
    }

    if (!isValidTimeFrame(time)) {
      Alert.alert('Khung gio chua hop le', 'Vui long nhap khung gio muon thue, vi du: 08:00-11:00 hoac 8h den 11h.');
      return;
    }

    const startUtcMs = bookingStartUtcMs(date, time);

    if (!startUtcMs) {
      Alert.alert('Khung gio chua hop le', 'Vui long nhap gio bat dau hop le, vi du: 08:00-11:00 hoac 8h den 11h.');
      return;
    }

    if (startUtcMs < minBookingStartUtcMs()) {
      Alert.alert(
        'Lich qua gan',
        `Vui long chon lich cach thoi diem hien tai it nhat ${MIN_BOOKING_NOTICE_HOURS} tieng theo gio Ho Chi Minh (UTC+7).`,
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await bookingService.create({
        customerEmail: user.email,
        customerId: user.id,
        customerName: user.fullName,
        customerPhone: user.phone,
        date: date.trim(),
        duration: parseDuration(duration),
        housekeeperId: housekeeper.id,
        housekeeperName: housekeeper.fullName,
        location: location.trim(),
        notes: notes.trim() || undefined,
        paymentMethod,
        service: recurring === 'monthly' ? `${service.trim()} monthly` : service.trim(),
        time: time.trim(),
        totalPrice,
      });

      Alert.alert('Dat lich thanh cong', 'Yeu cau cua ban da duoc gui den nguoi giup viec.', [
        { text: 'Xem booking', onPress: () => router.replace('/(customer)/bookings') },
      ]);
    } catch (error: any) {
      Alert.alert('Dat lich that bai', error.response?.data?.message || error.response?.data?.error || 'Khong the tao booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <TouchableOpacity onPress={goBackStep} style={styles.backButton}>
        <Text style={styles.backText}>Quay lai</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Dat lich</Text>
      <Text style={styles.subtitle}>{housekeeper?.fullName || 'Nguoi giup viec'}</Text>
      {recurring === 'monthly' ? (
        <View style={styles.recurringBadge}>
          <Text style={styles.recurringText}>Lich hang thang</Text>
        </View>
      ) : null}

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Tam tinh</Text>
        <Text style={styles.summaryValue}>{totalPrice.toLocaleString('vi-VN')} VND</Text>
      </View>

      <View style={styles.stepper}>
        {bookingSteps.map((step, index) => {
          const isActive = step === currentStep;
          const isDone = bookingSteps.indexOf(currentStep) > index;

          return (
            <View key={step} style={styles.stepItem}>
              <View style={[styles.stepDot, (isActive || isDone) && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, (isActive || isDone) && styles.stepDotTextActive]}>{index + 1}</Text>
              </View>
              <Text numberOfLines={1} style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step}</Text>
            </View>
          );
        })}
      </View>

      {currentStep === 'Dich vu' ? (
        <>
          <Text style={styles.label}>Dich vu</Text>
          <View style={styles.servicePicker}>
            <View style={styles.serviceOptions}>
              {(serviceOptions.length > 0 ? serviceOptions : [service || 'House cleaning']).map((item) => {
                const isSelected = item === service;

                return (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    key={item}
                    onPress={() => setService(item)}
                    style={[styles.serviceOption, isSelected && styles.serviceOptionActive]}
                  >
                    <Text style={[styles.serviceOptionText, isSelected && styles.serviceOptionTextActive]}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      {currentStep === 'Dia chi' ? (
        <>
          <Text style={styles.label}>Dia chi lam viec</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationPin}>
              <Text style={styles.locationPinText}>PIN</Text>
            </View>
            <View style={styles.locationBody}>
              <Text style={styles.locationTitle}>{location ? 'Dia chi da chon' : 'Chua chon dia chi'}</Text>
              <Text numberOfLines={3} style={styles.locationText}>
                {location || 'Vui long chon dia chi tu so dia chi hoac tren ban do.'}
              </Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.86} onPress={() => router.push('/addresses')} style={styles.addressBookButton}>
            <Text style={styles.addressBookButtonText}>Chon tu so dia chi</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.86} onPress={openMapPicker} style={styles.mapButton}>
            <Text style={styles.mapButtonText}>{selectedLocation ? 'Chon lai tren ban do' : 'Chon tren ban do'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {currentStep === 'Ngay gio' ? (
        <>
          <Text style={styles.label}>Ngay lam</Text>
          <ScrollView
            contentContainerStyle={styles.pickerRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroller}
          >
            {availableDates.map((item) => {
              const isSelected = item.value === date;

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  key={item.value}
                  onPress={() => setDate(item.value)}
                  style={[styles.dateOption, isSelected && styles.dateOptionActive]}
                >
                  <Text style={[styles.dateOptionLabel, isSelected && styles.dateOptionLabelActive]}>{item.label}</Text>
                  <Text style={[styles.dateOptionValue, isSelected && styles.dateOptionValueActive]}>{item.value.slice(5)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Khung gio muon thue</Text>
          <TextInput
            onChangeText={setTime}
            placeholder="Vi du: 08:00-11:00"
            style={styles.input}
            value={time}
          />
          <View style={styles.timeGrid}>
            {timeOptions.map((item) => {
              const isSelected = item === time;
              const isDisabled = isTimeOptionDisabled(item);

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={isDisabled}
                  key={item}
                  onPress={() => setTime(item)}
                  style={[styles.timeOption, isDisabled && styles.timeOptionDisabled, isSelected && !isDisabled && styles.timeOptionActive]}
                >
                  <Text style={[styles.timeOptionText, isDisabled && styles.timeOptionTextDisabled, isSelected && !isDisabled && styles.timeOptionTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {currentStep === 'Thoi luong' ? (
        <>
          <Text style={styles.label}>So gio</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setDuration}
            placeholder="2"
            style={styles.input}
            value={duration}
          />

          <Text style={styles.label}>Ghi chu</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Yeu cau them neu co"
            style={[styles.input, styles.multiline]}
            value={notes}
          />
        </>
      ) : null}

      {currentStep === 'Xac nhan' ? (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Xac nhan don truoc khi dat</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Dich vu</Text>
            <Text numberOfLines={2} style={styles.reviewValue}>{service || 'Chua chon'}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Ngay gio</Text>
            <Text style={styles.reviewValue}>{date} - {time}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>So gio</Text>
            <Text style={styles.reviewValue}>{parseDuration(duration)} gio</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Don gia</Text>
            <Text style={styles.reviewValue}>{unitPrice.toLocaleString('vi-VN')} VND/gio</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Tien dich vu</Text>
            <Text style={styles.reviewValue}>{basePrice.toLocaleString('vi-VN')} VND</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Phi tu chon nguoi lam</Text>
            <Text style={styles.reviewValue}>{PICK_HOUSEKEEPER_FEE.toLocaleString('vi-VN')} VND</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Dia chi</Text>
            <Text numberOfLines={3} style={styles.reviewValue}>{location.trim() || 'Chua nhap'}</Text>
          </View>
          <Text style={styles.paymentTitle}>Phuong thuc thanh toan</Text>
          <View style={styles.paymentMethodRow}>
            {paymentMethods.map((method) => {
              const selected = paymentMethod === method.key;

              return (
                <TouchableOpacity
                  activeOpacity={0.84}
                  key={method.key}
                  onPress={() => setPaymentMethod(method.key)}
                  style={[styles.paymentMethodButton, selected && styles.paymentMethodButtonActive]}
                >
                  <Text style={[styles.paymentMethodLabel, selected && styles.paymentMethodLabelActive]}>{method.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {notes.trim() ? (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Ghi chu</Text>
              <Text numberOfLines={3} style={styles.reviewValue}>{notes.trim()}</Text>
            </View>
          ) : null}
          <View style={[styles.reviewRow, styles.reviewTotalRow]}>
            <Text style={styles.reviewTotalLabel}>Tong tien</Text>
            <Text style={styles.reviewTotalValue}>{totalPrice.toLocaleString('vi-VN')} VND</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.stepActions}>
        {currentStep !== 'Dich vu' ? (
          <TouchableOpacity disabled={isSubmitting} onPress={goBackStep} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Quay lai</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={currentStep === 'Xac nhan' ? createBooking : goNext}
          style={[styles.primaryButton, currentStep !== 'Dich vu' && styles.primaryButtonFlex]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{currentStep === 'Xac nhan' ? 'Xac nhan dat lich' : 'Tiep tuc'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" onRequestClose={() => setIsMapVisible(false)} visible={isMapVisible}>
        <View style={[styles.mapScreen, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setIsMapVisible(false)} style={styles.mapHeaderButton}>
              <Text style={styles.mapHeaderButtonText}>Dong</Text>
            </TouchableOpacity>
            <View style={styles.mapHeaderTextWrap}>
              <Text style={styles.mapTitle}>Chon dia chi</Text>
              <Text style={styles.mapSubtitle}>Cham tren ban do de dat ghim vi tri lam viec.</Text>
            </View>
          </View>

          <View style={styles.mapSearchBox}>
            <TextInput
              onChangeText={setMapQuery}
              onSubmitEditing={searchAddressOnMap}
              placeholder="Nhap dia chi de tim..."
              returnKeyType="search"
              style={styles.mapSearchInput}
              value={mapQuery}
            />
            <TouchableOpacity activeOpacity={0.84} onPress={searchAddressOnMap} style={styles.mapSearchButton}>
              <Text style={styles.mapSearchButtonText}>Tim</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.84} onPress={centerOnDeviceLocation} style={styles.mapLocationButton}>
            <Text style={styles.mapLocationButtonText}>Chuyen den vi tri hien tai</Text>
          </TouchableOpacity>

          <MapView
            initialRegion={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={handleMapPress}
            region={mapRegion}
            style={styles.map}
          >
            {selectedLocation ? (
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                draggable
                onDragEnd={(event) => {
                  const { latitude, longitude } = event.nativeEvent.coordinate;
                  chooseCoordinate(latitude, longitude);
                }}
                title="Vi tri lam viec"
              />
            ) : null}
          </MapView>

          <View style={[styles.mapFooter, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {isMapLoading ? <ActivityIndicator color="#ff8128" /> : null}
            {selectedLocation ? (
              <TextInput
                multiline
                onChangeText={updateLocationAddress}
                placeholder="Bo sung so nha, tang, toa nha..."
                style={styles.mapAddressInput}
                value={location}
              />
            ) : null}
            <Text numberOfLines={2} style={styles.mapAddress}>
              {selectedLocation ? selectedLocation.address : 'Hay cham vao vi tri lam viec tren ban do.'}
            </Text>
            <TouchableOpacity
              disabled={!selectedLocation}
              onPress={() => setIsMapVisible(false)}
              style={[styles.confirmMapButton, !selectedLocation && styles.confirmMapButtonDisabled]}
            >
              <Text style={styles.confirmMapText}>Dung vi tri nay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addressBookButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    marginBottom: 10,
    paddingVertical: 13,
  },
  addressBookButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
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
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  dateOption: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dateOptionActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  dateOptionLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  dateOptionLabelActive: {
    color: '#fff',
  },
  dateOptionValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
    textAlign: 'center',
  },
  dateOptionValueActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    marginBottom: 14,
    padding: 14,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 10,
    marginTop: -8,
  },
  confirmMapButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmMapButtonDisabled: {
    backgroundColor: '#f3c09d',
  },
  confirmMapText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },
  pickerRow: {
    gap: 9,
    paddingRight: 16,
  },
  pickerScroller: {
    marginBottom: 14,
  },
  multiline: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  locationBody: {
    flex: 1,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  locationPin: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  locationPinText: {
    color: '#ff8128',
    fontSize: 11,
    fontWeight: '900',
  },
  locationText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  locationTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  map: {
    flex: 1,
  },
  mapAddress: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  mapAddressInput: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    minHeight: 66,
    padding: 12,
    textAlignVertical: 'top',
  },
  mapButton: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingVertical: 13,
  },
  mapButtonText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
  },
  mapFooter: {
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    gap: 12,
    padding: 16,
    paddingBottom: 24,
  },
  mapHeader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapHeaderButton: {
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  mapHeaderButtonText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  mapHeaderTextWrap: {
    flex: 1,
  },
  mapScreen: {
    backgroundColor: '#fff',
    flex: 1,
  },
  mapSearchBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mapSearchButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mapSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  mapSearchInput: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  mapLocationButton: {
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 12,
  },
  mapLocationButtonText: {
    color: '#c2410c',
    fontSize: 14,
    fontWeight: '900',
  },
  mapSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  mapTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 10,
    padding: 15,
  },
  primaryButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentMethodButton: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    padding: 12,
  },
  paymentMethodButtonActive: {
    backgroundColor: '#fff1e8',
    borderColor: '#ff8128',
  },
  paymentMethodLabel: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentMethodLabelActive: {
    color: '#ff8128',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 9,
  },
  paymentTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  recurringBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    marginBottom: 14,
    marginTop: -6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recurringText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 2,
    padding: 14,
  },
  reviewLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  reviewTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
  },
  reviewTotalLabel: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  reviewTotalRow: {
    borderTopColor: '#edf0f4',
    borderTopWidth: 1,
    marginTop: 2,
    paddingTop: 12,
  },
  reviewTotalValue: {
    color: '#ff8128',
    fontSize: 17,
    fontWeight: '900',
  },
  reviewValue: {
    color: '#111827',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  serviceOption: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  serviceOptionActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  serviceOptionText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  serviceOptionTextActive: {
    color: '#fff',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 15,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 16,
    fontWeight: '900',
  },
  serviceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  servicePicker: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  servicePickerTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 11,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 16,
  },
  summary: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    padding: 16,
  },
  summaryLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryValue: {
    color: '#ff8128',
    fontSize: 16,
    fontWeight: '800',
  },
  stepActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepDotActive: {
    backgroundColor: '#ff8128',
  },
  stepDotText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  stepLabel: {
    color: '#8a94a3',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#ff8128',
  },
  stepper: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    padding: 10,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  timeOption: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 68,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  timeOptionActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  timeOptionDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    opacity: 0.55,
  },
  timeOptionText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  timeOptionTextActive: {
    color: '#fff',
  },
  timeOptionTextDisabled: {
    color: '#9ca3af',
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
});
