import api from './api';

export type HousekeeperReview = {
  id: number;
  bookingDate?: string;
  bookingId?: number;
  comment?: string;
  createdAt?: string;
  customerId?: number;
  customerName?: string;
  housekeeperId?: number;
  rating: number;
  service?: string;
};

export const reviewService = {
  getForHousekeeper: async (housekeeperId: number | string) => {
    const response = await api.get<HousekeeperReview[]>(`/housekeepers/${housekeeperId}/reviews`);
    return response.data;
  },
};
