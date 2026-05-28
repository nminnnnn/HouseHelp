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
  price?: number | string;
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

type GetAllOptions = {
  availableOnly?: boolean;
};

function normalizeHousekeeper(housekeeper: Housekeeper): Housekeeper {
  const price = Number(housekeeper.price);

  return {
    ...housekeeper,
    price: Number.isFinite(price) ? price : undefined,
  };
}

export const housekeeperService = {
  getAll: async (services?: string, options: GetAllOptions = { availableOnly: true }) => {
    const response = await api.get<Housekeeper[]>('/housekeepers', {
      params: {
        ...(services ? { services } : {}),
        ...(options.availableOnly === false ? {} : { available: 1 }),
      },
    });
    return response.data.map(normalizeHousekeeper);
  },

  getById: async (id: number | string) => {
    const response = await api.get<Housekeeper>(`/housekeepers/${id}`);
    return normalizeHousekeeper(response.data);
  },

  getProfileByUserId: async (userId: number | string) => {
    const response = await api.get<Housekeeper>(`/housekeepers/${userId}/profile`);
    return normalizeHousekeeper(response.data);
  },

  updateAvailability: async (userId: number | string, available: boolean) => {
    const response = await api.put<Housekeeper>(`/housekeepers/${userId}/availability`, { available });
    return normalizeHousekeeper(response.data);
  },
};
