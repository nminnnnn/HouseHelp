import api from './api';

export type VerificationDocumentInput = {
  originalName: string;
  path: string;
  type: string;
};

export type VerificationStatus = {
  documents?: Array<{
    documentType?: string;
    filePath?: string;
    id: number;
    originalName?: string;
    status?: string;
  }>;
  hasRequest: boolean;
  isApproved: boolean;
  isVerified: boolean;
  request?: {
    status?: string;
    submittedAt?: string;
  };
};

export const verificationService = {
  getStatus: async (userId: number | string) => {
    const response = await api.get<VerificationStatus>(`/verification/status/${userId}`);
    return response.data;
  },

  submit: async (userId: number | string, userNotes: string, documents: VerificationDocumentInput[]) => {
    const response = await api.post<{ message?: string; requestId?: number; success: boolean }>('/verification/submit', {
      documents,
      userId,
      userNotes,
    });
    return response.data;
  },
};
