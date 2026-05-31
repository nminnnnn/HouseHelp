import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Housekeeper } from './housekeepers';

type PreferenceKind = 'favorites' | 'blocked';

function keyFor(userId: number | string, kind: PreferenceKind) {
  return `househelp_housekeeper_${kind}_${userId}`;
}

async function readIds(userId: number | string, kind: PreferenceKind) {
  const raw = await AsyncStorage.getItem(keyFor(userId, kind));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function writeIds(userId: number | string, kind: PreferenceKind, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map(String)));
  await AsyncStorage.setItem(keyFor(userId, kind), JSON.stringify(uniqueIds));
  return uniqueIds;
}

async function addId(userId: number | string, kind: PreferenceKind, housekeeperId: number | string) {
  const ids = await readIds(userId, kind);
  return writeIds(userId, kind, [...ids, String(housekeeperId)]);
}

async function removeId(userId: number | string, kind: PreferenceKind, housekeeperId: number | string) {
  const targetId = String(housekeeperId);
  const ids = await readIds(userId, kind);
  return writeIds(userId, kind, ids.filter((id) => id !== targetId));
}

export const housekeeperPreferenceService = {
  favorite: async (userId: number | string, housekeeperId: number | string) => {
    await removeId(userId, 'blocked', housekeeperId);
    return addId(userId, 'favorites', housekeeperId);
  },

  unfavorite: async (userId: number | string, housekeeperId: number | string) => {
    return removeId(userId, 'favorites', housekeeperId);
  },

  block: async (userId: number | string, housekeeperId: number | string) => {
    await removeId(userId, 'favorites', housekeeperId);
    return addId(userId, 'blocked', housekeeperId);
  },

  unblock: async (userId: number | string, housekeeperId: number | string) => {
    return removeId(userId, 'blocked', housekeeperId);
  },

  toggleFavorite: async (userId: number | string, housekeeperId: number | string) => {
    const isFavorite = await housekeeperPreferenceService.isFavorite(userId, housekeeperId);
    if (isFavorite) {
      await housekeeperPreferenceService.unfavorite(userId, housekeeperId);
      return false;
    }

    await housekeeperPreferenceService.favorite(userId, housekeeperId);
    return true;
  },

  getFavoriteIds: async (userId: number | string) => readIds(userId, 'favorites'),

  getBlockedIds: async (userId: number | string) => readIds(userId, 'blocked'),

  isFavorite: async (userId: number | string, housekeeperId: number | string) => {
    const ids = await readIds(userId, 'favorites');
    return ids.includes(String(housekeeperId));
  },

  isBlocked: async (userId: number | string, housekeeperId: number | string) => {
    const ids = await readIds(userId, 'blocked');
    return ids.includes(String(housekeeperId));
  },

  filterBlocked: (housekeepers: Housekeeper[], blockedIds: string[]) => {
    const blockedSet = new Set(blockedIds.map(String));
    return housekeepers.filter((housekeeper) => !blockedSet.has(String(housekeeper.id)));
  },
};
