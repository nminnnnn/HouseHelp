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

import { authService, type AuthUser } from '../../../lib/auth';
import { bookingService } from '../../../lib/bookings';
import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';

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

function dateOptions() {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    return {
      label: index === 0
        ? 'Hom nay'
        : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', weekday: 'short' }),
      value: toDateValue(date),
    };
  });
}

const timeOptions = ['07:00', '08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00', '18:00'];

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
  }, [housekeeperId, recurring, selectedService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPrice = useMemo(() => {
    const price = parsePrice(housekeeper?.price);
    return price * parseDuration(duration);
  }, [duration, housekeeper?.price]);
  const unitPrice = useMemo(() => parsePrice(housekeeper?.price), [housekeeper?.price]);
  const serviceOptions = useMemo(() => serviceList(housekeeper?.services), [housekeeper?.services]);
  const availableDates = useMemo(() => dateOptions(), []);

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

  const openMapPicker = useCallback(async () => {
    setIsMapVisible(true);

    if (selectedLocation) {
      setMapRegion((current) => ({
        ...current,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      }));
      return;
    }

    try {
      setIsMapLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Can quyen vi tri', 'Ban co the cham truc tiep tren ban do de chon dia chi.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      await chooseCoordinate(current.coords.latitude, current.coords.longitude);
    } catch {
      Alert.alert('Khong lay duoc vi tri', 'Ban co the cham truc tiep tren ban do de chon dia chi.');
    } finally {
      setIsMapLoading(false);
    }
  }, [chooseCoordinate, selectedLocation]);

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

  const handleSubmit = async () => {
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

    if (!selectedLocation) {
      Alert.alert('Can chon dia chi tren ban do', 'Vui long bam Chon tren ban do va dat ghim vi tri lam viec.');
      return;
    }

    if (!isValidTimeFrame(time)) {
      Alert.alert('Khung gio chua hop le', 'Vui long nhap khung gio muon thue, vi du: 08:00-11:00 hoac 8h den 11h.');
      return;
    }

    if (date < todayDate()) {
      Alert.alert('Ngay khong hop le', 'Vui long chon ngay hom nay hoac mot ngay trong tuong lai.');
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
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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

      <Text style={styles.label}>Dich vu</Text>
      <View style={styles.servicePicker}>
        {/* <Text style={styles.servicePickerTitle}>Chon cong viec housekeeper co the lam</Text> */}
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
      {/* <Text style={styles.helperText}>Co the nhap tu do theo nhu cau, cac moc duoi day chi la goi y nhanh.</Text> */}
      <View style={styles.timeGrid}>
        {timeOptions.map((item) => {
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

      <Text style={styles.label}>So gio</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setDuration}
        placeholder="2"
        style={styles.input}
        value={duration}
      />

      <Text style={styles.label}>Dia chi lam viec</Text>
        <View style={styles.locationCard}>
        <View style={styles.locationPin}>
          <Text style={styles.locationPinText}>PIN</Text>
        </View>
        <View style={styles.locationBody}>
          <Text style={styles.locationTitle}>{selectedLocation ? 'Da chon vi tri' : 'Chua chon vi tri'}</Text>
          <Text numberOfLines={3} style={styles.locationText}>
            {selectedLocation ? location : 'Vui long chon dia chi chinh xac tren ban do.'}
          </Text>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.86} onPress={openMapPicker} style={styles.mapButton}>
        <Text style={styles.mapButtonText}>{selectedLocation ? 'Chon lai tren ban do' : 'Chon tren ban do'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Ghi chu</Text>
      <TextInput
        multiline
        onChangeText={setNotes}
        placeholder="Yeu cau them neu co"
        style={[styles.input, styles.multiline]}
        value={notes}
      />

      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Tom tat truoc khi gui</Text>
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
          <Text style={styles.reviewLabel}>Dia chi</Text>
          <Text numberOfLines={2} style={styles.reviewValue}>{location.trim() || 'Chua nhap'}</Text>
        </View>
        <View style={[styles.reviewRow, styles.reviewTotalRow]}>
          <Text style={styles.reviewTotalLabel}>Tong tien</Text>
          <Text style={styles.reviewTotalValue}>{totalPrice.toLocaleString('vi-VN')} VND</Text>
        </View>
      </View>

      <TouchableOpacity disabled={isSubmitting} onPress={handleSubmit} style={styles.primaryButton}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Gui yeu cau dat lich</Text>}
      </TouchableOpacity>

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
});
