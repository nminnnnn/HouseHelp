import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { addressService, addressText, type SavedAddress } from '../lib/addresses';
import { authService, type AuthUser } from '../lib/auth';
import { profileService, type UserProfile } from '../lib/profile';

function AddressCard({
  address,
  isSelected,
  onDelete,
  onSelect,
}: {
  address: SavedAddress;
  isSelected: boolean;
  onDelete: () => void;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onSelect} style={[styles.card, isSelected && styles.selectedCard]}>
      <View style={styles.cardIcon}>
        <Ionicons color="#ff8128" name={address.isDefault ? 'home' : 'location'} size={22} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={styles.cardTitle}>{address.label}</Text>
          {isSelected ? <Text style={styles.selectedPill}>Dang dung</Text> : null}
        </View>
        <Text style={styles.cardAddress}>{addressText(address)}</Text>
        {address.note ? <Text style={styles.cardNote}>{address.note}</Text> : null}
      </View>
      {address.isDefault ? null : (
        <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
          <Ionicons color="#ef4444" name="trash-outline" size={20} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [form, setForm] = useState({ address: '', city: '', district: '', label: 'Home', note: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await authService.checkAuthStatus();

      if (!currentUser) {
        router.replace('/(auth)/login');
        return;
      }

      const nextProfile = await profileService.getProfile(currentUser.id);
      const [nextAddresses, nextSelectedId] = await Promise.all([
        addressService.getAll(currentUser.id, nextProfile),
        addressService.getSelectedId(currentUser.id),
      ]);

      const fallbackSelected = nextSelectedId || nextAddresses[0]?.id || null;
      if (!nextSelectedId && fallbackSelected) {
        await addressService.select(currentUser.id, fallbackSelected);
      }

      setUser(currentUser);
      setProfile(nextProfile);
      setAddresses(nextAddresses);
      setSelectedId(fallbackSelected);
    } catch (error: any) {
      Alert.alert('Khong tai duoc dia chi', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const selectAddress = async (address: SavedAddress) => {
    if (!user) return;
    await addressService.select(user.id, address.id);
    setSelectedId(address.id);
    Alert.alert('Da chon dia chi', addressText(address));
  };

  const deleteAddress = async (address: SavedAddress) => {
    if (!user || address.isDefault) return;

    Alert.alert('Xoa dia chi', `Ban muon xoa "${address.label}"?`, [
      { style: 'cancel', text: 'Huy' },
      {
        onPress: async () => {
          await addressService.remove(user.id, address.id);
          await loadAddresses();
        },
        style: 'destructive',
        text: 'Xoa',
      },
    ]);
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!form.label.trim() || !form.address.trim()) {
      Alert.alert('Thieu thong tin', 'Vui long nhap ten dia chi va dia chi chi tiet.');
      return;
    }

    try {
      setIsSaving(true);
      await addressService.saveCustom(user.id, {
        address: form.address.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        label: form.label.trim(),
        note: form.note.trim(),
      });
      setForm({ address: '', city: '', district: '', label: 'Home', note: '' });
      setIsFormOpen(false);
      await loadAddresses();
    } finally {
      setIsSaving(false);
    }
  };

  const useProfileAddress = () => {
    setForm({
      address: profile.address || '',
      city: profile.city || '',
      district: profile.district || '',
      label: 'Home',
      note: '',
    });
    setIsFormOpen(true);
  };

  const useCurrentLocationAddress = useCallback(async () => {
    try {
      setIsLocationLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Can quyen vi tri', 'Cho phep HouseHelp truy cap vi tri de tu dong nhap dia chi hien tai.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      const address = [
        place?.name,
        place?.street,
        place?.district,
        place?.city,
        place?.region,
      ].filter(Boolean).join(', ');

      setForm((currentForm) => ({
        ...currentForm,
        address: address || currentForm.address || `${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`,
        city: place?.city || place?.region || currentForm.city,
        district: place?.district || currentForm.district,
      }));
      setIsFormOpen(true);
    } catch {
      Alert.alert('Khong the tim vi tri', 'Vui long kiem tra quyen vi tri va thu lai hoac nhap dia chi bang tay.');
    } finally {
      setIsLocationLoading(false);
    }
  }, []);

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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color="#ff8128" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Addresses</Text>
          <TouchableOpacity onPress={() => setIsFormOpen(true)} style={styles.addIconButton}>
            <Ionicons color="#fff" name="add" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.helperText}>Chon dia chi mac dinh khi dat dich vu, giong cach chon dia chi tren Shopee/bTaskee.</Text>

          {addresses.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons color="#cbd5e1" name="location-outline" size={46} />
              <Text style={styles.emptyTitle}>Chua co dia chi</Text>
              <Text style={styles.emptyText}>Them dia chi nha rieng, cong ty hoac dia chi thuong dung.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {addresses.map((address) => (
                <AddressCard
                  address={address}
                  isSelected={selectedId === address.id}
                  key={address.id}
                  onDelete={() => deleteAddress(address)}
                  onSelect={() => selectAddress(address)}
                />
              ))}
            </View>
          )}

          <TouchableOpacity onPress={useProfileAddress} style={styles.secondaryButton}>
            <Ionicons color="#ff8128" name="person-circle-outline" size={20} />
            <Text style={styles.secondaryText}>Dung dia chi trong profile</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={isLocationLoading} onPress={useCurrentLocationAddress} style={styles.secondaryButton}>
            {isLocationLoading ? (
              <ActivityIndicator color="#ff8128" />
            ) : (
              <>
                <Ionicons color="#ff8128" name="locate-outline" size={20} />
                <Text style={styles.secondaryText}>Dung dia chi hien tai</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsFormOpen(true)} style={styles.primaryButton}>
            <Ionicons color="#fff" name="add-circle-outline" size={21} />
            <Text style={styles.primaryText}>Them dia chi moi</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal animationType="slide" onRequestClose={() => setIsFormOpen(false)} transparent visible={isFormOpen}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity activeOpacity={1} onPress={() => setIsFormOpen(false)} style={styles.modalScrim} />
            <View style={styles.formPanel}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Them dia chi</Text>
                <TouchableOpacity onPress={() => setIsFormOpen(false)} style={styles.closeButton}>
                  <Ionicons color="#172033" name="close" size={22} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Ten dia chi</Text>
              <TextInput onChangeText={(value) => setForm((current) => ({ ...current, label: value }))} placeholder="Nha rieng, Cong ty..." style={styles.input} value={form.label} />

              <Text style={styles.label}>Dia chi chi tiet</Text>
              <TextInput multiline onChangeText={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="So nha, ten duong, toa nha..." style={[styles.input, styles.multiline]} value={form.address} />

              <View style={styles.formRow}>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Quan/Huyen</Text>
                  <TextInput onChangeText={(value) => setForm((current) => ({ ...current, district: value }))} style={styles.input} value={form.district} />
                </View>
                <View style={styles.formColumn}>
                  <Text style={styles.label}>Thanh pho</Text>
                  <TextInput onChangeText={(value) => setForm((current) => ({ ...current, city: value }))} style={styles.input} value={form.city} />
                </View>
              </View>

              <Text style={styles.label}>Ghi chu</Text>
              <TextInput onChangeText={(value) => setForm((current) => ({ ...current, note: value }))} placeholder="Vi du: goi truoc khi den" style={styles.input} value={form.note} />

              <TouchableOpacity disabled={isSaving} onPress={saveAddress} style={styles.saveButton}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Luu va chon dia chi</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addIconButton: {
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    borderRadius: 12,
    borderColor: '#fed7aa',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  cardAddress: {
    color: '#273244',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  cardBody: {
    flex: 1,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  cardNote: {
    color: '#7d8796',
    fontSize: 13,
    marginTop: 5,
  },
  cardTitle: {
    color: '#172033',
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 7,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  content: {
    padding: 16,
    paddingBottom: 34,
  },
  deleteButton: {
    padding: 4,
  },
  emptyBox: {
    alignItems: 'center',
    borderColor: '#edf0f4',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  emptyText: {
    color: '#7d8796',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  formColumn: {
    flex: 1,
  },
  formHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  formPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formTitle: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '900',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  headerTitle: {
    color: '#172033',
    flex: 1,
    fontSize: 25,
    fontWeight: '900',
  },
  helperText: {
    color: '#687386',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    marginBottom: 14,
    padding: 14,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 7,
  },
  list: {
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    flex: 1,
  },
  multiline: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    padding: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#18bf62',
    borderRadius: 15,
    padding: 15,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  screen: {
    backgroundColor: '#fff',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#ffdbc0',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    padding: 15,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
  },
  selectedCard: {
    borderColor: '#ff8128',
    borderWidth: 2,
  },
  selectedPill: {
    backgroundColor: '#18bf62',
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
