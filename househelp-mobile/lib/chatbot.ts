import api from './api';

export type ChatbotMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatbotResponse = {
  success: boolean;
  response: string;
  intent?: string;
  suggestions?: string[];
  timestamp?: string;
};

export type ChatbotUserContext = {
  userId?: number;
  name?: string;
  location?: string;
  role?: string;
};

export const chatbotService = {
  sendMessage: async (
    message: string,
    conversationHistory: ChatbotMessage[],
    userContext: ChatbotUserContext,
  ) => {
    const response = await api.post<ChatbotResponse>('/chatbot/message', {
      conversationHistory,
      message,
      userContext,
    }, {
      timeout: 60000,
    });

    return response.data;
  },
};
