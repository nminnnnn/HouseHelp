import api from './api';

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | string;

export type Booking = {
  id: number;
  customerId: number;
  housekeeperId: number;
  service?: string;
  startDate?: string;
  date?: string;
  time?: string;
  duration?: number;
  location?: string;
  notes?: string;
  status: BookingStatus;
  totalPrice?: number | string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  housekeeperName?: string;
  paymentStatus?: string;
  createdAt?: string;
};

export type CreateBookingPayload = {
  customerId: number;
  housekeeperId: number;
  service: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  notes?: string;
  totalPrice: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  housekeeperName?: string;
};

export type ConfirmPaymentPayload = {
  customerId: number;
  paymentMethod: string;
  rating?: number;
  review?: string;
};

export const bookingService = {
  create: async (payload: CreateBookingPayload) => {
    const response = await api.post<Booking>('/bookings', payload);
    return response.data;
  },

  getForUser: async (userId: number) => {
    const response = await api.get<Booking[]>(`/bookings/user/${userId}`);
    return response.data;
  },

  confirm: async (bookingId: number, housekeeperId: number) => {
    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/confirm`, {
      housekeeperId,
    });
    return response.data;
  },

  reject: async (bookingId: number) => {
    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/reject`);
    return response.data;
  },

  cancel: async (bookingId: number) => {
    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/cancel`);
    return response.data;
  },

  complete: async (bookingId: number, housekeeperId: number) => {
    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/complete`, {
      housekeeperId,
    });
    return response.data;
  },

  confirmPayment: async (bookingId: number, payload: ConfirmPaymentPayload) => {
    const response = await api.post<{ message: string; booking: Booking; paymentStatus: string }>(
      `/bookings/${bookingId}/confirm-payment`,
      payload,
    );
    return response.data;
  },
};
