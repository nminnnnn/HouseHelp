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
  address?: string;
  city?: string;
  district?: string;
  bio?: string;
  availability?: string;
};

type GetAllOptions = {
  availableOnly?: boolean;
};

export function parseServices(value?: string | string[] | unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    }
  } catch {
    // Ignore invalid JSON and fall back to delimited parsing.
  }

  return raw
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function servicesToString(value?: string | string[] | unknown) {
  return parseServices(value).join(', ');
}

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
    services: servicesToString(housekeeper.services),
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

  updateProfile: async (userId: number | string, payload: Partial<Housekeeper>) => {
    const response = await api.put<Housekeeper>(`/housekeepers/${userId}/profile`, payload);
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
