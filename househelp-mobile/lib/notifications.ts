import api from './api';

export type AppNotification = {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  bookingId?: number | null;
  data?: unknown;
  read?: boolean;
  read_status?: number;
  createdAt?: string;
  timestamp?: string;
};

export const notificationService = {
  getForUser: async (userId: number) => {
    const response = await api.get<AppNotification[]>(`/notifications/${userId}`);
    return response.data;
  },

  markRead: async (notificationId: number) => {
    const response = await api.put<{ message: string }>(`/notifications/${notificationId}/read`);
    return response.data;
  },

  delete: async (notificationId: number) => {
    const response = await api.delete<{ message: string }>(`/notifications/${notificationId}`);
    return response.data;
  },
};
