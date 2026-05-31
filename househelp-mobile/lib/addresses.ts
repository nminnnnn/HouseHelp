import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from './profile';

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  district?: string;
  city?: string;
  note?: string;
  isDefault?: boolean;
};

const listKey = (userId: number | string) => `househelp_addresses_${userId}`;
const selectedKey = (userId: number | string) => `househelp_selected_address_${userId}`;

function compactAddress(profile: Partial<UserProfile>) {
  return [profile.address, profile.district, profile.city].filter(Boolean).join(', ');
}

export function addressText(address: SavedAddress) {
  return [address.address, address.district, address.city].filter(Boolean).join(', ');
}

export function profileToAddress(profile: Partial<UserProfile>): SavedAddress | null {
  const text = compactAddress(profile);
  if (!text) return null;

  return {
    address: profile.address || text,
    city: profile.city,
    district: profile.district,
    id: 'profile-home',
    isDefault: true,
    label: 'Home',
  };
}

export const addressService = {
  getAll: async (userId: number | string, profile?: Partial<UserProfile>) => {
    const raw = await AsyncStorage.getItem(listKey(userId));
    const stored = raw ? (JSON.parse(raw) as SavedAddress[]) : [];
    const profileAddress = profile ? profileToAddress(profile) : null;
    const withoutProfile = stored.filter((address) => address.id !== 'profile-home');
    return profileAddress ? [profileAddress, ...withoutProfile] : withoutProfile;
  },

  getSelectedId: async (userId: number | string) => {
    return AsyncStorage.getItem(selectedKey(userId));
  },

  select: async (userId: number | string, addressId: string) => {
    await AsyncStorage.setItem(selectedKey(userId), addressId);
  },

  saveCustom: async (userId: number | string, address: Omit<SavedAddress, 'id' | 'isDefault'>) => {
    const raw = await AsyncStorage.getItem(listKey(userId));
    const stored = raw ? (JSON.parse(raw) as SavedAddress[]) : [];
    const nextAddress: SavedAddress = {
      ...address,
      id: `custom-${Date.now()}`,
      isDefault: false,
    };
    const next = [nextAddress, ...stored.filter((item) => item.id !== 'profile-home')];
    await AsyncStorage.setItem(listKey(userId), JSON.stringify(next));
    await AsyncStorage.setItem(selectedKey(userId), nextAddress.id);
    return nextAddress;
  },

  remove: async (userId: number | string, addressId: string) => {
    const raw = await AsyncStorage.getItem(listKey(userId));
    const stored = raw ? (JSON.parse(raw) as SavedAddress[]) : [];
    const next = stored.filter((address) => address.id !== addressId);
    await AsyncStorage.setItem(listKey(userId), JSON.stringify(next));

    const selected = await AsyncStorage.getItem(selectedKey(userId));
    if (selected === addressId) {
      await AsyncStorage.removeItem(selectedKey(userId));
    }
  },
};
