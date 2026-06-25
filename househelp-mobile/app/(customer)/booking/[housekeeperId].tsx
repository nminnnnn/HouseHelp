import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
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
import { formatVietnamDate } from '../../../lib/date';
import { housekeeperPreferenceService } from '../../../lib/housekeeper-preferences';
import { housekeeperService, parseServices, type Housekeeper } from '../../../lib/housekeepers';
import { useLanguage } from '../../../lib/language';
import { profileService } from '../../../lib/profile';
import { serviceLabel } from '../../../lib/service-labels';

function todayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOptions(language: 'en' | 'vi') {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return {
      label: index === 0
        ? (language === 'vi' ? 'Hôm nay' : 'Today')
        : date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', weekday: 'short' }),
      value: toDateValue(date),
    };
  });
}

const bookingSteps = ['Location', 'Time', 'Notes', 'Payment'] as const;
const durationOptions = [2, 3, 4, 5, 6, 7, 8, 9];
const PICK_HOUSEKEEPER_FEE = 15000;
const paymentOptions = [
  { key: 'cash', label: 'Cash' },
  { key: 'momo', label: 'MoMo' },
] as const;

type BookingStep = (typeof bookingSteps)[number];
type PaymentMethod = (typeof paymentOptions)[number]['key'];


function serviceList(services?: string | string[] | unknown) {
  return parseServices(services);
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parsePrice(value?: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCoordinateParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDurationParam(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? String(Math.round(parsed)) : '';
}

function serviceSelection(services?: string, selectedService?: string | string[]) {
  const options = serviceList(services);
  const selectedItems = parseServices(selectedService);
  const normalizedOptions = options.map((item) => ({ key: item.trim().toLowerCase(), value: item }));
  const matchedItems = selectedItems
    .map((item) => normalizedOptions.find((option) => option.key === item.trim().toLowerCase())?.value)
    .filter((item): item is string => Boolean(item));

  return matchedItems.length > 0 ? matchedItems : [firstService(services, selectedService)];
}

function isValidTimeFrame(value: string) {
  return value.trim().length >= 3;
}

type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function uniqueAddressParts(parts: unknown[]) {
  const seen = new Set<string>();
  return parts.filter((part): part is string => {
    const value = String(part || '').trim();
    if (!value) return false;
    const key = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function CreateBookingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState<BookingStep>('Location');
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
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [time, setTime] = useState('08:00');
  const [user, setUser] = useState<AuthUser | null>(null);
  const {
    duration: prefillDuration,
    housekeeperId,
    latitude: prefillLatitude,
    location: prefillLocation,
    longitude: prefillLongitude,
    notes: prefillNotes,
    paymentMethod: prefillPaymentMethod,
    recurring,
    service: selectedService,
  } = useLocalSearchParams<{
    duration?: string;
    housekeeperId: string;
    latitude?: string;
    location?: string;
    longitude?: string;
    notes?: string;
    paymentMethod?: string;
    recurring?: string;
    service?: string;
  }>();
  const router = useRouter();
  const { language } = useLanguage();

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
      if (!prefillLocation?.trim()) {
        await loadSelectedAddress(storedUser);
      }
      setHousekeeper(detail);
      setSelectedServices(serviceSelection(detail.services, selectedService));
      if (prefillLocation?.trim()) {
        const latitude = parseCoordinateParam(prefillLatitude);
        const longitude = parseCoordinateParam(prefillLongitude);
        const nextLocation = prefillLocation.trim();

        setLocation(nextLocation);
        if (latitude !== null && longitude !== null) {
          setSelectedLocation({ address: nextLocation, latitude, longitude });
          setMapRegion((current) => ({
            ...current,
            latitude,
            longitude,
          }));
        }
      }
      if (prefillNotes?.trim()) {
        setNotes(prefillNotes.trim());
      }
      if (prefillPaymentMethod === 'cash' || prefillPaymentMethod === 'momo') {
        setPaymentMethod(prefillPaymentMethod);
      }
      const nextDuration = parseDurationParam(prefillDuration);
      if (nextDuration) {
        setDuration(nextDuration);
      }
      if (recurring === 'monthly') {
        setDuration('3');
      }
    } catch (error: any) {
      Alert.alert(language === 'vi' ? 'Không tải được dữ liệu' : 'Could not load data', error.response?.data?.message || error.response?.data?.error || (language === 'vi' ? 'Thử lại sau.' : 'Please try again.'));
    } finally {
      setIsLoading(false);
    }
  }, [
    housekeeperId,
    language,
    loadSelectedAddress,
    prefillDuration,
    prefillLatitude,
    prefillLocation,
    prefillLongitude,
    prefillNotes,
    prefillPaymentMethod,
    recurring,
    selectedService,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      if (prefillLocation?.trim()) return;
      loadSelectedAddress(user);
    }, [loadSelectedAddress, prefillLocation, user]),
  );

  const pricePerService = useMemo(() => {
    const price = parsePrice(housekeeper?.price);
    return price * parseDuration(duration);
  }, [duration, housekeeper?.price]);
  const basePrice = pricePerService * selectedServices.length;
  const additionalServicesAmount = pricePerService * Math.max(selectedServices.length - 1, 0);
  const totalPrice = basePrice + PICK_HOUSEKEEPER_FEE;
  const unitPrice = useMemo(() => parsePrice(housekeeper?.price), [housekeeper?.price]);
  const serviceOptions = useMemo(() => serviceList(housekeeper?.services), [housekeeper?.services]);
  const availableDates = useMemo(() => dateOptions(language), [language]);
  const selectedDuration = parseDuration(duration);
  const selectedDurationIndex = Math.max(0, durationOptions.findIndex((item) => item === selectedDuration));
  const toggleService = (item: string) => {
    setSelectedServices((current) => (
      current.includes(item)
        ? current.filter((serviceItem) => serviceItem !== item)
        : [...current, item]
    ));
  };
// choose address 
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude }); //lấy địa chỉ từ tọa độ
      const place: any = results[0];
      const streetAddress = place?.streetNumber && place?.street
        ? `${place.streetNumber} ${place.street}`
        : place?.name || place?.street;
      const parts = uniqueAddressParts([
        streetAddress,
        place?.district,
        place?.subregion,
        place?.city,
        place?.region,
      ]);

      return parts.length > 0 ? parts.join(', ') : `${language === 'vi' ? 'Vị trí đã chọn' : 'Selected location'} ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    } catch {
      return `${language === 'vi' ? 'Vị trí đã chọn' : 'Selected location'} ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    }
  }, [language]);

  const getDeviceLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      throw new Error('permission');
    }

    const current = await Location.getCurrentPositionAsync({});
    return current.coords;
  }, []);

  const chooseCoordinate = useCallback(async (latitude: number, longitude: number) => { // chọn tọa độ trên bản đồ
    setMapRegion((current) => ({
      ...current,
      latitude,
      longitude,
    }));

    const address = await reverseGeocode(latitude, longitude);
    const nextLocation = { address, latitude, longitude };
    setSelectedLocation(nextLocation);
    setLocation(address);
  }, [reverseGeocode]);

  const centerOnDeviceLocation = useCallback(async () => {
    try {
      setIsMapLoading(true);
      const coords = await getDeviceLocation();
      await chooseCoordinate(coords.latitude, coords.longitude);
    } catch {
      Alert.alert(language === 'vi' ? 'Không thể truy cập vị trí' : 'Could not access location', language === 'vi' ? 'Hãy kiểm tra quyền vị trí và thử lại.' : 'Check location permission and try again.');
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
      Alert.alert(language === 'vi' ? 'Không lấy được vị trí' : 'Could not get location', language === 'vi' ? 'Bạn có thể chạm trực tiếp trên bản đồ để chọn địa chỉ.' : 'You can tap the map to choose an address.');
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
      Alert.alert(language === 'vi' ? 'Nhập địa chỉ' : 'Enter an address', language === 'vi' ? 'Vui lòng nhập địa chỉ cần tìm.' : 'Enter the address you want to find.');
      return;
    }

    try {
      setIsMapLoading(true);
      const results = await Location.geocodeAsync(query);

      if (!results.length) {
        Alert.alert(language === 'vi' ? 'Không tìm thấy' : 'Address not found', language === 'vi' ? 'Vui lòng nhập địa chỉ cụ thể hơn.' : 'Enter a more specific address.');
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
      setLocation(query);
    } catch {
      Alert.alert(language === 'vi' ? 'Không tìm được địa chỉ' : 'Could not find address', language === 'vi' ? 'Vui lòng thử lại hoặc chạm trực tiếp trên bản đồ.' : 'Try again or tap the map directly.');
    } finally {
      setIsMapLoading(false);
    }
  };

  const updateLocationAddress = (value: string) => {
    setLocation(value);
    setSelectedLocation((current) => (current ? { ...current, address: value } : current));
  };

  const validateCurrentStep = () => {
    if (currentStep === 'Location' && selectedServices.length === 0) {
      Alert.alert(language === 'vi' ? 'Chưa chọn dịch vụ' : 'No service selected', language === 'vi' ? 'Vui lòng chọn dịch vụ cần đặt.' : 'Select at least one service.');
      return false;
    }

    if (currentStep === 'Location' && !location.trim()) {
      Alert.alert(language === 'vi' ? 'Chưa chọn địa chỉ' : 'No address selected', language === 'vi' ? 'Vui lòng chọn địa chỉ làm việc.' : 'Select the work address.');
      return false;
    }

    if (currentStep === 'Time') {
      if (!date.trim() || !time.trim()) {
        Alert.alert(language === 'vi' ? 'Thiếu ngày giờ' : 'Missing schedule', language === 'vi' ? 'Vui lòng chọn ngày và khung giờ.' : 'Select a date and time.');
        return false;
      }

      if (!isValidTimeFrame(time)) {
        Alert.alert(language === 'vi' ? 'Khung giờ chưa hợp lệ' : 'Invalid time', language === 'vi' ? 'Vui lòng nhập khung giờ muốn thuê, ví dụ: 08:00-11:00 hoặc 8h đến 11h.' : 'Enter a valid time, for example 08:00-11:00.');
        return false;
      }

      if (date < todayDate()) {
        Alert.alert(language === 'vi' ? 'Ngày không hợp lệ' : 'Invalid date', language === 'vi' ? 'Vui lòng chọn ngày hôm nay hoặc một ngày trong tương lai.' : 'Choose today or a future date.');
        return false;
      }

      if (parseDuration(duration) <= 0) {
        Alert.alert(language === 'vi' ? 'Thời lượng chưa hợp lệ' : 'Invalid duration', language === 'vi' ? 'Vui lòng nhập số giờ muốn thuê.' : 'Enter the number of service hours.');
        return false;
      }
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
      Alert.alert(language === 'vi' ? 'Cần đăng nhập' : 'Login required', language === 'vi' ? 'Vui lòng đăng nhập lại để đặt lịch.' : 'Log in again to create a booking.');
      router.replace('/(auth)/login');
      return;
    }

    if (!housekeeper.available) {
      Alert.alert(language === 'vi' ? 'Housekeeper đang tạm nghỉ' : 'Housekeeper unavailable', language === 'vi' ? 'Vui lòng chọn housekeeper khác đang nhận việc.' : 'Choose another housekeeper who is currently available.');
      return;
    }

    if (selectedServices.length === 0 || !date.trim() || !time.trim() || !location.trim()) {
      Alert.alert(language === 'vi' ? 'Thiếu thông tin' : 'Missing information', language === 'vi' ? 'Vui lòng chọn dịch vụ, ngày, khung giờ và địa chỉ.' : 'Select services, date, time, and address.');
      return;
    }

    const blockedHousekeeper = await housekeeperPreferenceService.isBlocked(user.id, housekeeper.id);
    if (blockedHousekeeper) {
      Alert.alert(language === 'vi' ? 'Housekeeper đã bị chặn' : 'Housekeeper blocked', language === 'vi' ? 'Vui lòng bỏ chặn housekeeper này nếu bạn muốn đặt lịch lại.' : 'Unblock this housekeeper before booking again.');
      return;
    }

    if (!isValidTimeFrame(time)) {
      Alert.alert(language === 'vi' ? 'Khung giờ chưa hợp lệ' : 'Invalid time', language === 'vi' ? 'Vui lòng nhập khung giờ muốn thuê, ví dụ: 08:00-11:00 hoặc 8h đến 11h.' : 'Enter a valid time, for example 08:00-11:00.');
      return;
    }

    if (date < todayDate()) {
      Alert.alert(language === 'vi' ? 'Ngày không hợp lệ' : 'Invalid date', language === 'vi' ? 'Vui lòng chọn ngày hôm nay hoặc một ngày trong tương lai.' : 'Choose today or a future date.');
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
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        notes: notes.trim() || undefined,
        service: selectedServices
          .map((item) => (recurring === 'monthly' ? `${item} monthly` : item))
          .join(', '),
        paymentMethod,
        time: time.trim(),
        totalPrice,
      });

      Alert.alert(language === 'vi' ? 'Đặt lịch thành công' : 'Booking created', language === 'vi' ? 'Yêu cầu của bạn đã được gửi đến người giúp việc.' : 'Your request was sent to the housekeeper.', [
        { text: 'Xem booking', onPress: () => router.replace('/(customer)/bookings') },
      ]);
    } catch (error: any) {
      Alert.alert(language === 'vi' ? 'Đặt lịch thất bại' : 'Booking failed', error.response?.data?.message || error.response?.data?.error || (language === 'vi' ? 'Không thể tạo booking.' : 'Could not create the booking.'));
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
      <View style={styles.bookingHeader}>
        <TouchableOpacity onPress={goBackStep} style={styles.headerIconButton}>
          <Ionicons color="#ff8128" name="chevron-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <TouchableOpacity onPress={loadData} style={styles.headerIconButton}>
          <Ionicons color="#ff8128" name="refresh" size={18} />
        </TouchableOpacity>
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

      {currentStep === 'Location' ? (
        <View style={styles.bookingSection}>
          <Text style={styles.sectionTitle}>Service</Text>
          <View style={styles.servicePicker}>
            <View style={styles.serviceSelectionHeader}>
              <Text style={styles.servicePickerTitle}>Select one or more services</Text>
              <Text style={styles.serviceCount}>{selectedServices.length} selected</Text>
            </View>
            <View style={styles.serviceOptions}>
              {(serviceOptions.length > 0 ? serviceOptions : ['House cleaning']).map((item) => {
                const isSelected = selectedServices.includes(item);

                return (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    key={item}
                    onPress={() => toggleService(item)}
                    style={[styles.serviceOption, isSelected && styles.serviceOptionActive]}
                  >
                    <Ionicons
                      color={isSelected ? '#fff' : '#ff8128'}
                      name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={16}
                    />
                    <Text style={[styles.serviceOptionText, isSelected && styles.serviceOptionTextActive]}>{serviceLabel(item, language)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.additionalServiceHint}>
              Each service costs {pricePerService.toLocaleString('vi-VN')} VND for {selectedDuration} hours.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Service Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationPin}>
              <Ionicons color="#ff8128" name="location-outline" size={18} />
            </View>
            <View style={styles.locationBody}>
              <Text style={styles.locationTitle}>{location
                ? (language === 'vi' ? 'Địa chỉ đã chọn' : 'Selected address')
                : (language === 'vi' ? 'Chưa chọn địa chỉ' : 'No address selected')}
              </Text>
              <Text numberOfLines={3} style={styles.locationText}>
                {location || (language === 'vi'
                  ? 'Vui lòng chọn địa chỉ từ sổ địa chỉ hoặc trên bản đồ.'
                  : 'Choose an address from your saved addresses or the map.')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/addresses')} style={styles.changeButton}>
              <Text style={styles.changeButtonText}>CHANGE</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.9} onPress={openMapPicker} style={styles.mapPreview}>
            {selectedLocation ? (
              <MapView
                pointerEvents="none"
                region={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                style={styles.previewMap}
              >
                <Marker coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }} />
              </MapView>
            ) : (
              <View style={styles.mapPreviewPlaceholder}>
                <View style={styles.largePin}>
                  <Ionicons color="#fff" name="location" size={30} />
                </View>
                <Text style={styles.mapPreviewText}>{language === 'vi' ? 'Chọn vị trí trên bản đồ' : 'Choose a location on the map'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {currentStep === 'Time' ? (
        <View style={styles.bookingSection}>
          <Text style={styles.sectionTitle}>Schedule & Duration</Text>
          <ScrollView
            contentContainerStyle={styles.pickerRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroller}
          >
            {availableDates.slice(0, 7).map((item, index) => {
              const isSelected = item.value === date;

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  key={item.value}
                  onPress={() => setDate(item.value)}
                  style={[styles.dateOption, isSelected && styles.dateOptionActive]}
                >
                  <Text style={[styles.dateOptionLabel, isSelected && styles.dateOptionLabelActive]}>
                    {index === 0 ? (language === 'vi' ? 'Hôm nay' : 'Today') : item.label.split(',')[0]}
                  </Text>
                  <Text style={[styles.dateOptionValue, isSelected && styles.dateOptionValueActive]}>{item.value.slice(5)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.timeGrid}>
            {['09:00', '11:30', '14:00', '16:00'].map((item) => {
              const isSelected = item === time;

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  key={item}
                  onPress={() => setTime(item)}
                  style={[styles.timeOption, isSelected && styles.timeOptionActive]}
                >
                  <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customTimeRow}>
            <Ionicons color="#ff8128" name="create-outline" size={18} />
            <TextInput
              onChangeText={setTime}
              placeholder="Enter custom time, e.g. 08:00-11:00"
              style={styles.customTimeInput}
              value={time}
            />
          </View>

          <View style={styles.durationCard}>
            <View style={styles.durationHeader}>
              <Text style={styles.durationLabel}>Cleaning Duration</Text>
              <Text style={styles.durationValue}>{selectedDuration} Hours</Text>
            </View>
            {/* <View style={styles.durationTrack}>
              <View style={styles.durationTrackBase} />
              <View style={[styles.durationTrackFill, { width: durationProgress }]} />
              {durationOptions.map((item) => {
                const isSelected = item === selectedDuration;
                return (
                  <TouchableOpacity
                    activeOpacity={0.84}
                    key={item}
                    onPress={() => setDuration(String(item))}
                    style={[styles.durationDot, isSelected && styles.durationDotActive]}
                  />
                );
              })}
            </View> */}
            <View style={styles.durationSliderWrap}>
  <Slider
    minimumValue={0}
    maximumValue={durationOptions.length - 1}
    step={1}
    value={selectedDurationIndex}
    onValueChange={(index) => {
      setDuration(String(durationOptions[index]));
    }}
    minimumTrackTintColor="#ff8128"
    maximumTrackTintColor="#fed7aa"
    thumbTintColor="#ff8128"
  />
</View>
            <View style={styles.durationScale}>
              {durationOptions.map((item) => (
                <Text key={item} style={[styles.durationScaleText, item === selectedDuration && styles.durationScaleTextActive]}>
                  {item}H
                </Text>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {currentStep === 'Notes' ? (
        <View style={styles.bookingSection}>
          <Text style={styles.sectionTitle}>Special Requirements</Text>
          <View style={styles.requirementsGrid}>
            {['Pets at home', 'Key under mat', 'Use eco-products'].map((item) => (
              <TouchableOpacity
                activeOpacity={0.84}
                key={item}
                onPress={() => setNotes((current) => (current.includes(item) ? current : `${current}${current ? '\n' : ''}${item}`))}
                style={styles.requirementChip}
              >
                <Ionicons color="#ff8128" name="sparkles-outline" size={14} />
                <Text style={styles.requirementText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Add any specific instructions for the housekeeper..."
            style={[styles.input, styles.multiline]}
            value={notes}
          />
        </View>
      ) : null}

      {currentStep === 'Payment' ? (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Review & Payment</Text>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Service</Text>
            <Text numberOfLines={4} style={styles.reviewValue}>{selectedServices.map((item) => serviceLabel(item, language)).join(', ') || 'Not selected'}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Date & time</Text>
            <Text style={styles.reviewValue}>{formatVietnamDate(date)} - {time}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Duration</Text>
            <Text style={styles.reviewValue}>{parseDuration(duration)} hours</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Unit price</Text>
            <Text style={styles.reviewValue}>{unitPrice.toLocaleString('vi-VN')} VND/hour</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Primary service</Text>
            <Text style={styles.reviewValue}>{pricePerService.toLocaleString('vi-VN')} VND</Text>
          </View>
          {selectedServices.length > 1 ? (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Additional services ({selectedServices.length - 1})</Text>
              <Text style={styles.reviewValue}>{additionalServicesAmount.toLocaleString('vi-VN')} VND</Text>
            </View>
          ) : null}
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Pick housekeeper fee</Text>
            <Text style={styles.reviewValue}>{PICK_HOUSEKEEPER_FEE.toLocaleString('vi-VN')} VND</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Address</Text>
            <Text numberOfLines={3} style={styles.reviewValue}>{location.trim() || 'Not entered'}</Text>
          </View>
          {notes.trim() ? (
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Notes</Text>
              <Text numberOfLines={3} style={styles.reviewValue}>{notes.trim()}</Text>
            </View>
          ) : null}
          <View style={styles.paymentMethodBlock}>
            <Text style={styles.paymentMethodTitle}>Payment method</Text>
            <View style={styles.paymentMethodRow}>
              {paymentOptions.map((option) => {
                const isActive = paymentMethod === option.key;

                return (
                  <TouchableOpacity
                    activeOpacity={0.84}
                    key={option.key}
                    onPress={() => setPaymentMethod(option.key)}
                    style={[styles.paymentMethodButton, isActive && styles.paymentMethodButtonActive]}
                  >
                    <Ionicons
                      color={isActive ? '#fff' : '#ff8128'}
                      name={option.key === 'cash' ? 'cash-outline' : 'wallet-outline'}
                      size={18}
                    />
                    <Text style={[styles.paymentMethodText, isActive && styles.paymentMethodTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.estimateCard}>
        <View style={styles.estimateTopRow}>
          <View style={styles.estimateInfo}>
            <Text style={styles.estimateLabel}>TOTAL ESTIMATE</Text>
            <View style={styles.estimatePriceRow}>
              <Text style={styles.estimatePrice}>{totalPrice.toLocaleString('vi-VN')} VND</Text>
              <Text style={styles.estimateUnit}>/ session</Text>
            </View>
          </View>
          <View style={styles.estimateSavings}>
            <Text style={styles.estimateSavingsText}>Save 10%</Text>
            <Text style={styles.breakdownText}>View Breakdown</Text>
          </View>
        </View>
      </View>

      <View style={styles.stepActions}>
        <TouchableOpacity
          disabled={isSubmitting}
          onPress={currentStep === 'Payment' ? createBooking : goNext}
          style={styles.primaryButton}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.primaryContent}>
              <Text style={styles.primaryText}>Continue</Text>
              <Ionicons color="#fff" name="arrow-forward" size={18} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Modal animationType="slide" onRequestClose={() => setIsMapVisible(false)} visible={isMapVisible}>
        <View style={[styles.mapScreen, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setIsMapVisible(false)} style={styles.mapHeaderButton}>
              <Text style={styles.mapHeaderButtonText}>{language === 'vi' ? 'Đóng' : 'Close'}</Text>
            </TouchableOpacity>
            <View style={styles.mapHeaderTextWrap}>
              <Text style={styles.mapTitle}>{language === 'vi' ? 'Chọn địa chỉ' : 'Choose an address'}</Text>
              <Text style={styles.mapSubtitle}>{language === 'vi' ? 'Chạm trên bản đồ để đặt ghim vị trí làm việc.' : 'Tap the map to place the work-location pin.'}</Text>
            </View>
          </View>

          <View style={styles.mapSearchBox}>
            <TextInput
              onChangeText={setMapQuery}
              onSubmitEditing={searchAddressOnMap}
              placeholder={language === 'vi' ? 'Nhập địa chỉ để tìm...' : 'Search for an address...'}
              returnKeyType="search"
              style={styles.mapSearchInput}
              value={mapQuery}
            />
            <TouchableOpacity activeOpacity={0.84} onPress={searchAddressOnMap} style={styles.mapSearchButton}>
              <Text style={styles.mapSearchButtonText}>{language === 'vi' ? 'Tìm' : 'Search'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.84} onPress={centerOnDeviceLocation} style={styles.mapLocationButton}>
            <Text style={styles.mapLocationButtonText}>{language === 'vi' ? 'Chuyển đến vị trí hiện tại' : 'Use my current location'}</Text>
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
                title={language === 'vi' ? 'Vị trí làm việc' : 'Work location'}
              />
            ) : null}
          </MapView>

          <View style={[styles.mapFooter, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {isMapLoading ? <ActivityIndicator color="#ff8128" /> : null}
            {selectedLocation ? (
              <TextInput
                multiline
                onChangeText={updateLocationAddress}
                placeholder={language === 'vi' ? 'Bổ sung số nhà, tầng, tòa nhà...' : 'Add house number, floor, or building...'}
                style={styles.mapAddressInput}
                value={location}
              />
            ) : null}
            <Text numberOfLines={2} style={styles.mapAddress}>
              {selectedLocation ? selectedLocation.address : (language === 'vi' ? 'Hãy chạm vào vị trí làm việc trên bản đồ.' : 'Tap the work location on the map.')}
            </Text>
            <TouchableOpacity
              disabled={!selectedLocation}
              onPress={() => setIsMapVisible(false)}
              style={[styles.confirmMapButton, !selectedLocation && styles.confirmMapButtonDisabled]}
            >
              <Text style={styles.confirmMapText}>{language === 'vi' ? 'Dùng vị trí này' : 'Use this location'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  additionalServiceHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 12,
  },
  bookingHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bookingSection: {
    marginBottom: 12,
  },
  changeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  changeButtonText: {
    color: '#ff8128',
    fontSize: 10,
    fontWeight: '900',
  },
  durationCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    marginBottom: 14,
    padding: 12,
  },
  durationDot: {
    backgroundColor: '#ffbe91',
    borderColor: '#fff7ed',
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    width: 12,
    zIndex: 2,
  },
  durationDotActive: {
    backgroundColor: '#ff8128',
    borderColor: '#fff',
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  durationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  durationLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  durationScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  durationScaleText: {
    color: '#9ca3af',
    fontSize: 9,
    fontWeight: '800',
  },
  durationScaleTextActive: {
    color: '#ff8128',
  },
  durationTrack: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    minHeight: 18,
    position: 'relative',
  },
  durationTrackBase: {
    backgroundColor: '#fed7aa',
    borderRadius: 999,
    height: 3,
    left: 6,
    position: 'absolute',
    right: 6,
  },
  durationTrackFill: {
    backgroundColor: '#ff8128',
    borderRadius: 999,
    height: 3,
    left: 6,
    position: 'absolute',
  },
  durationValue: {
    color: '#ff8128',
    fontSize: 12,
    fontWeight: '900',
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  largePin: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  mapPreview: {
    backgroundColor: '#e8eef5',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    height: 120,
    marginBottom: 14,
    marginTop: -12,
    overflow: 'hidden',
  },
  mapPreviewPlaceholder: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  mapPreviewText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  previewMap: {
    height: '100%',
    width: '100%',
  },
  primaryContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  requirementChip: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  requirementText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  requirementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  savePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
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
    flexGrow: 1,
    padding: 14,
    paddingBottom: 14,
  },
  breakdownText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 5,
    textDecorationLine: 'underline',
  },
  customTimeInput: {
    color: '#111827',
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    paddingVertical: 0,
  },
  customTimeRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateOption: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 62,
    paddingHorizontal: 8,
    paddingVertical: 10,
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
    borderColor: '#fed7aa',
    borderRadius: 10,
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
  paymentMethodBlock: {
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 14,
  },
  paymentMethodButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  paymentMethodButtonActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentMethodText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentMethodTextActive: {
    color: '#fff',
  },
  paymentMethodTitle: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  estimateCard: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    padding: 14,
  },
  estimateInfo: {
    flex: 1,
  },
  estimateLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  estimatePrice: {
    color: '#111827',
    fontSize: 21,
    fontWeight: '900',
  },
  estimatePriceRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  estimateSavings: {
    alignItems: 'flex-end',
  },
  estimateSavingsText: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  estimateTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  estimateUnit: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
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
    borderColor: '#fed7aa',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
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
    borderRadius: 16,
    padding: 16,
    width: '100%',
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
    borderColor: '#fed7aa',
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
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
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
    borderRadius: 16,
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
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  servicePickerTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '800',
  },
  serviceCount: {
    color: '#ff8128',
    fontSize: 12,
    fontWeight: '900',
  },
  serviceSelectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginTop: 'auto',
    paddingTop: 14,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepDotActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
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
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    paddingHorizontal: 2,
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
    borderColor: '#fed7aa',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 74,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  timeOptionActive: {
    backgroundColor: '#ff8128',
    borderColor: '#ff8128',
  },
  timeOptionText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  timeOptionTextActive: {
    color: '#fff',
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  durationSliderWrap: {
  marginTop: 10,
  marginHorizontal: -8,
},
});
