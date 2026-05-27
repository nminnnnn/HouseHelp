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

export type Conversation = {
  bookingId?: number;
  service?: string;
  bookingStatus?: string;
  customerId?: number;
  housekeeperId?: number;
  customerName?: string;
  housekeeperName?: string;
  otherUserId: number;
  otherUserName?: string;
  otherUserRole?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  bookingCreatedAt?: string;
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

  getConversations: async (userId: number) => {
    const response = await api.get<Conversation[]>(`/users/${userId}/conversations`);
    return response.data;
  },

  send: async (bookingId: number | string, payload: SendMessagePayload) => {
    const response = await api.post<ChatMessage>(`/bookings/${bookingId}/messages`, payload);
    return response.data;
  },

  sendBetweenUsers: async (userId1: number, userId2: number, payload: Pick<SendMessagePayload, 'message' | 'messageType'>) => {
    const response = await api.post<ChatMessage>(`/users/${userId1}/messages/${userId2}`, payload);
    return response.data;
  },
};
