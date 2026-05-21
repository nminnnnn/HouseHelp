import api from './api';

export type ChatMessage = {
  id: number;
  bookingId: number;
  senderId: number;
  receiverId: number;
  message: string;
  messageType: 'text' | 'image' | 'file' | string;
  senderName?: string;
  receiverName?: string;
  createdAt?: string;
  timestamp?: string;
};

export type SendMessagePayload = {
  senderId: number;
  receiverId: number;
  message: string;
  messageType?: 'text';
};

export const messageService = {
  getForBooking: async (bookingId: number | string) => {
    const response = await api.get<ChatMessage[]>(`/bookings/${bookingId}/messages`);
    return response.data;
  },

  getBetweenUsers: async (userId1: number, userId2: number) => {
    const response = await api.get<ChatMessage[]>(`/users/${userId1}/messages/${userId2}`);
    return response.data;
  },

  send: async (bookingId: number | string, payload: SendMessagePayload) => {
    const response = await api.post<ChatMessage>(`/bookings/${bookingId}/messages`, payload);
    return response.data;
  },
};
