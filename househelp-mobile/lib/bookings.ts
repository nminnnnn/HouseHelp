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
  housekeeperAmount?: number | string;
  paymentMethod?: 'cash' | 'momo' | string;
  paymentStatus?: string;
  platformFee?: number | string;
  settlementStatus?: string;
  completionProofUrl?: string;
  completionNotes?: string;
  completionRequestedAt?: string;
  customerConfirmedAt?: string;
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
  paymentMethod?: 'cash' | 'momo';
};

export type ConfirmPaymentPayload = {
  customerId: number;
  paymentMethod: 'cash' | 'momo';
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

  complete: async (bookingId: number, proofUri: string, completionNotes?: string) => {
    const formData = new FormData();
    const extension = proofUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

    formData.append('completionProof', {
      name: `completion-${bookingId}.${extension}`,
      type: mimeType,
      uri: proofUri,
    } as any);
    if (completionNotes?.trim()) formData.append('completionNotes', completionNotes.trim());

    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/complete`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  confirmCompletion: async (bookingId: number) => {
    const response = await api.post<{ message: string; booking: Booking; paymentRequired: boolean }>(
      `/bookings/${bookingId}/confirm-completion`,
    );
    return response.data;
  },

  getArrivalQr: async (bookingId: number) => {
    const response = await api.post<{
      bookingId: number;
      expiresInMinutes: number;
      qrToken: string;
    }>(`/bookings/${bookingId}/arrival-qr`);
    return response.data;
  },

  startFromQr: async (bookingId: number, qrToken: string) => {
    const response = await api.post<{ message: string; booking: Booking }>(`/bookings/${bookingId}/start-from-qr`, {
      qrToken,
    });
    return response.data;
  },

  confirmPayment: async (bookingId: number, payload: ConfirmPaymentPayload) => {
    const response = await api.post<{
      booking: Booking;
      message: string;
      payment?: {
        amount: number;
        housekeeperAmount: number;
        method: 'cash' | 'momo';
        platformAccount: string;
        platformFee: number;
        settlementStatus: string;
        transactionCode: string;
      };
      paymentStatus: string;
    }>(
      `/bookings/${bookingId}/confirm-payment`,
      payload,
    );
    return response.data;
  },
};
