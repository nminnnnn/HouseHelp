import api from './api';
import { storage } from './storage';

export type UserRole = 'customer' | 'housekeeper' | 'admin' | string;

export type AuthUser = {
  id: number;
  fullName?: string;
  email: string;
  role: UserRole;
  phone?: string;
  [key: string]: unknown;
};

type LoginResponse = {
  success: boolean;
  message?: string;
  accessToken: string;
  user: AuthUser;
};

type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  role: 'customer' | 'housekeeper';
  services?: string[];
  emergencyContact?: string;
};

type AuthResponse = LoginResponse;

async function persistAuth(response: AuthResponse) {
  const { accessToken, user } = response;

  await storage.saveToken(accessToken);
  await storage.saveUser(user);

  return user;
}

export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post<LoginResponse>('/login', { email, password });
    return persistAuth(response.data);
  },

  registerCustomer: async (payload: Omit<RegisterPayload, 'role' | 'services'>) => {
    const response = await api.post<AuthResponse>('/register', {
      ...payload,
      role: 'customer',
    });
    return persistAuth(response.data);
  },

  registerHousekeeper: async (payload: Omit<RegisterPayload, 'role'>) => {
    const response = await api.post<AuthResponse>('/register', {
      ...payload,
      emergencyContact: payload.emergencyContact || payload.phone,
      role: 'housekeeper',
    });
    return persistAuth(response.data);
  },

  logout: async () => {
    await storage.clearAll();
  },

  checkAuthStatus: async () => {
    const token = await storage.getToken();
    const user = await storage.getUser<AuthUser>();

    if (token && user) {
      return user;
    }

    return null;
  },
};
