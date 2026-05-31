import api from './api';
import type { AuthUser } from './auth';

export type UserProfile = AuthUser & {
  avatar?: string;
  idCardFront?: string;
  idCardBack?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  district?: string;
  bio?: string;
  languages?: string;
  emergencyContact?: string;
  emergencyContactName?: string;
};

export type UploadedFile = {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  url: string;
  size: number;
  type: string;
};

export type UserFile = {
  id: number;
  userId: number;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  uploadedAt?: string;
  url: string;
};

export type UploadFileType = 'avatar' | 'document' | 'id_card_front' | 'id_card_back';

export const profileService = {
  getProfile: async (userId: number) => {
    const response = await api.get<UserProfile>(`/users/${userId}/profile`);
    return response.data;
  },

  updateProfile: async (userId: number, payload: Partial<UserProfile>) => {
    const response = await api.put<UserProfile>(`/users/${userId}/profile`, payload);
    return response.data;
  },

  getFiles: async (userId: number) => {
    const response = await api.get<UserFile[]>(`/users/${userId}/files`);
    return response.data;
  },

  uploadImage: async (
    userId: number,
    fileType: UploadFileType,
    file: { uri: string; name: string; type: string },
  ) => {
    const formData = new FormData();
    formData.append('userId', String(userId));
    formData.append('fileType', fileType);
    formData.append('file', file as unknown as Blob);

    const response = await api.post<{ success: boolean; message: string; file: UploadedFile }>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },
};
