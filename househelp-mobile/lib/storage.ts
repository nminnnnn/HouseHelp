import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'user_token';
const USER_KEY = 'user_info';
const LANGUAGE_KEY = 'app_language';
export type AppLanguage = 'vi' | 'en';

export const storage = {
  saveToken: async (token: string) => {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  getToken: async () => {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },
  saveUser: async <T>(user: T) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: async <T = unknown>() => {
    const user = await AsyncStorage.getItem(USER_KEY);
    return user ? (JSON.parse(user) as T) : null;
  },
  saveLanguage: async (language: AppLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  },
  getLanguage: async () => {
    const language = await AsyncStorage.getItem(LANGUAGE_KEY);
    return language === 'en' ? 'en' : 'vi';
  },
  clearAll: async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  }
};
