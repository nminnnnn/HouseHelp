import api from './api';

export type Housekeeper = {
  id: number;
  userId: number;
  fullName: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  initials?: string;
  services?: string;
  price?: number;
  available?: number | boolean;
  description?: string;
  experience?: string;
  rating?: string | number;
  avgRating?: string | number;
  reviewCount?: number;
  location?: string;
  bio?: string;
  availability?: string;
};

export const housekeeperService = {
  getAll: async () => {
    const response = await api.get<Housekeeper[]>('/housekeepers');
    return response.data;
  },

  getById: async (id: number | string) => {
    const response = await api.get<Housekeeper>(`/housekeepers/${id}`);
    return response.data;
  },
};
