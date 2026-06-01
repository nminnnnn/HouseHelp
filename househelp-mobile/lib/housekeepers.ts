import api from './api';

export type Housekeeper = {
  id: number;
  userId: number;
  fullName: string;
  avatar?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  initials?: string;
  services?: string;
  price?: number | string;
  priceType?: 'hourly' | 'daily' | 'per_service' | string;
  available?: number | boolean;
  description?: string;
  experience?: number | string;
  skills?: string[] | string;
  certifications?: string[] | string;
  workingDays?: string[] | string;
  workingHours?: string;
  serviceRadius?: number | string;
  profileImages?: string[] | string;
  hasInsurance?: number | boolean;
  insured?: number | boolean;
  backgroundChecked?: number | boolean;
  completedJobs?: number;
  responseTime?: number;
  isTopRated?: number | boolean;
  isVerified?: number | boolean;
  isApproved?: number | boolean;
  totalReviews?: number;
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

export type HousekeeperEarnings = {
  cashCollected?: number | string;
  cashPlatformFeeDue?: number | string;
  grossPaid?: number | string;
  paidBookings?: number;
  paidOut?: number | string;
  pendingPayout?: number | string;
  platformFees?: number | string;
};

function normalizeHousekeeper(housekeeper: Housekeeper): Housekeeper {
  const price = Number(housekeeper.price);
  const available = housekeeper.available === true || housekeeper.available === 1 || housekeeper.available === '1';
  const isApproved = housekeeper.isApproved === true || housekeeper.isApproved === 1 || housekeeper.isApproved === '1';
  const isVerified = housekeeper.isVerified === true || housekeeper.isVerified === 1 || housekeeper.isVerified === '1';

  return {
    ...housekeeper,
    available,
    isApproved,
    isVerified,
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

  getEarnings: async (userId: number | string) => {
    const response = await api.get<HousekeeperEarnings>(`/housekeepers/${userId}/earnings`);
    return response.data;
  },
};
