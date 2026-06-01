import api from './api';

export type VerificationDocumentInput = {
  originalName: string;
  path: string;
  type: string;
};

export type VerificationStatus = {
  aiCheckedAt?: string;
  aiOcrAddress?: string;
  aiOcrDob?: string;
  aiOcrIdNumber?: string;
  aiOcrName?: string;
  aiScore?: number | string;
  aiStatus?: 'not_configured' | 'pending' | 'passed' | 'failed' | 'needs_review' | 'error' | string;
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
    aiCheckedAt?: string;
    aiOcrAddress?: string;
    aiOcrDob?: string;
    aiOcrIdNumber?: string;
    aiOcrName?: string;
    aiScore?: number | string;
    aiStatus?: string;
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
    const response = await api.post<{ aiResult?: unknown; message?: string; requestId?: number; success: boolean }>('/verification/submit', {
      documents,
      userId,
      userNotes,
    });
    return response.data;
  },
};
