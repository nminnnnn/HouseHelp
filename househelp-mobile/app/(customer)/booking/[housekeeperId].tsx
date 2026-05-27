import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authService, type AuthUser } from '../../../lib/auth';
import { bookingService } from '../../../lib/bookings';
import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function firstService(services?: string, selectedService?: string | string[]) {
  const paramService = Array.isArray(selectedService) ? selectedService[0] : selectedService;
  if (paramService?.trim()) {
    return paramService.trim();
  }

  const value = services
    ?.split(',')
    .map((item) => item.trim())
    .find(Boolean);

  return value || 'House cleaning';
}

function parseDuration(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function parsePrice(value?: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CreateBookingScreen() {
  const [date, setDate] = useState(todayDate());
  const [duration, setDuration] = useState('2');
  const [housekeeper, setHousekeeper] = useState<Housekeeper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
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

  const handleSubmit = async () => {
    if (!user || !housekeeper) {
      Alert.alert('Can dang nhap', 'Vui long dang nhap lai de dat lich.');
      router.replace('/(auth)/login');
      return;
    }

    if (!service.trim() || !date.trim() || !time.trim() || !location.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long nhap dich vu, ngay, gio va dia chi.');
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
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.screen}>
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
      <TextInput onChangeText={setService} placeholder="Dich vu" style={styles.input} value={service} />

      <Text style={styles.label}>Ngay lam</Text>
      <TextInput onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} value={date} />

      <Text style={styles.label}>Gio bat dau</Text>
      <TextInput onChangeText={setTime} placeholder="08:00" style={styles.input} value={time} />

      <Text style={styles.label}>So gio</Text>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setDuration}
        placeholder="2"
        style={styles.input}
        value={duration}
      />

      <Text style={styles.label}>Dia chi</Text>
      <TextInput
        multiline
        onChangeText={setLocation}
        placeholder="Nhap dia chi lam viec"
        style={[styles.input, styles.multiline]}
        value={location}
      />

      <Text style={styles.label}>Ghi chu</Text>
      <TextInput
        multiline
        onChangeText={setNotes}
        placeholder="Yeu cau them neu co"
        style={[styles.input, styles.multiline]}
        value={notes}
      />

      <TouchableOpacity disabled={isSubmitting} onPress={handleSubmit} style={styles.primaryButton}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Gui yeu cau dat lich</Text>}
      </TouchableOpacity>
    </ScrollView>
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
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },
  multiline: {
    minHeight: 82,
    textAlignVertical: 'top',
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
  screen: {
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
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
});
