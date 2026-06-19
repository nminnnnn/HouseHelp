import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CustomerBottomNav } from '../components/customer-bottom-nav';
import { authService, type AuthUser } from '../lib/auth';
import { chatbotService, type ChatbotMessage } from '../lib/chatbot';
import { useLanguage } from '../lib/language';
import type { AppLanguage } from '../lib/storage';

type UiMessage = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
};

const copy = {
  en: {
    back: 'Home',
    error: 'Chatbot is having connection issues. Please try again later.',
    fallback: 'I do not have a suitable answer yet. Please try asking another way.',
    placeholder: 'Ask a question...',
    subtitle: 'HouseHelp assistant',
    suggestions: ['Cleaning service advice', 'Estimate service cost', 'Booking guide', 'Complaint support'],
    timeout: 'Chatbot took too long to respond. Please try again in a few seconds.',
    welcome: (name: string) => `Hi${name}! I am HouseHelp chatbot. Do you need service advice, cost estimates, or booking help?`,
  },
  vi: {
    back: 'Trang chủ',
    error: 'Chatbot đang gặp sự cố kết nối. Bạn thử lại sau nhé.',
    fallback: 'Tôi chưa có câu trả lời phù hợp. Bạn thử hỏi theo cách khác nhé.',
    placeholder: 'Nhập câu hỏi...',
    subtitle: 'Trợ lý HouseHelp',
    suggestions: ['Tư vấn dịch vụ dọn dẹp', 'Tính chi phí thuê giúp việc', 'Hướng dẫn đặt lịch', 'Hỗ trợ khiếu nại'],
    timeout: 'Chatbot phản hồi quá lâu. Bạn thử lại sau ít giây.',
    welcome: (name: string) => `Xin chào${name}! Tôi là chatbot HouseHelp. Bạn cần tư vấn dịch vụ, ước tính chi phí hay hướng dẫn đặt lịch?`,
  },
} as const;

const CHATBOT_STORAGE_KEY = 'chatbot_history';

function welcomeMessage(user: AuthUser | null, language: AppLanguage): UiMessage {
  const name = user?.fullName ? ` ${user.fullName}` : '';

  return {
    content: copy[language].welcome(name),
    id: 'welcome',
    type: 'assistant',
  };
}

async function loadChatbotHistory(): Promise<UiMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHATBOT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UiMessage[]) : [];
  } catch {
    return [];
  }
}

async function saveChatbotHistory(messages: UiMessage[]) {
  try {
    await AsyncStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore write failure
  }
}

export default function MobileChatbotScreen() {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const { language } = useLanguage();
  const text = copy[language];
  const [suggestions, setSuggestions] = useState<string[]>([...text.suggestions]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<UiMessage>>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const storedUser = await authService.checkAuthStatus();
      const storedMessages = await loadChatbotHistory();

      if (!mounted) return;
      setUser(storedUser);
      setMessages(storedMessages.length > 0 ? storedMessages : [welcomeMessage(storedUser, language)]);
    };

    init();
    return () => {
      mounted = false;
    };
  }, [language]);

  useEffect(() => {
    if (messages.length > 0) {
      saveChatbotHistory(messages);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  const conversationHistory = useMemo<ChatbotMessage[]>(
    () =>
      messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          content: message.content,
          role: message.type === 'user' ? 'user' : 'assistant',
        })),
    [messages],
  );

  const sendMessage = useCallback(async (value = input) => {
    const text = value.trim();
    if (!text || isSending) return;

    const userMessage: UiMessage = {
      content: text,
      id: `user-${Date.now()}`,
      type: 'user',
    };

    setInput('');
    setSuggestions([]);
    setMessages((current) => [...current, userMessage]);
    setIsSending(true);

    try {
      const response = await chatbotService.sendMessage(text, conversationHistory, {
        location: String(user?.address || 'Viet Nam'),
        name: user?.fullName,
        role: user?.role || 'customer',
        userId: user?.id,
      });

      setMessages((current) => [
        ...current,
        {
          content: response.response || copy[language].fallback,
          id: `assistant-${Date.now()}`,
          type: 'assistant',
        },
      ]);
      setSuggestions(response.suggestions?.length ? response.suggestions : [...copy[language].suggestions]);
    } catch (error: any) {
      const serverMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        (error.code === 'ECONNABORTED' ? copy[language].timeout : null);

      setMessages((current) => [
        ...current,
        {
          content: serverMessage || copy[language].error,
          id: `assistant-error-${Date.now()}`,
          type: 'assistant',
        },
      ]);
      setSuggestions([...copy[language].suggestions]);
    } finally {
      setIsSending(false);
    }
  }, [conversationHistory, input, isSending, language, user]);

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.screen}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(customer)')} style={styles.backButton}>
            <Ionicons color="#ff8128" name="chevron-back" size={22} />
            <Text style={styles.backText}>{text.back}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Chatbot</Text>
            <Text style={styles.subtitle}>{text.subtitle}</Text>
          </View>
        </View>

        <FlatList
          contentContainerStyle={styles.messages}
          data={messages}
          keyExtractor={(item) => item.id}
          ref={listRef}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.type === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, item.type === 'user' && styles.userBubbleText]}>{item.content}</Text>
            </View>
          )}
        />

        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.slice(0, 4).map((suggestion) => (
              <TouchableOpacity
                activeOpacity={0.84}
                key={suggestion}
                onPress={() => sendMessage(suggestion)}
                style={styles.suggestionButton}
              >
                <Text numberOfLines={1} style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom + 82, 96) }]}>
          <TextInput
            multiline
            onChangeText={setInput}
            placeholder={text.placeholder}
            style={styles.input}
            value={input}
          />
          <TouchableOpacity disabled={isSending} onPress={() => sendMessage()} style={styles.sendButton}>
            {isSending ? <ActivityIndicator color="#fff" /> : <Ionicons color="#fff" name="send" size={19} />}
          </TouchableOpacity>
        </View>

        <CustomerBottomNav />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 3,
  },
  backText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  bubble: {
    borderRadius: 16,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleText: {
    color: '#172033',
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#edf0f4',
    borderBottomWidth: 1,
    gap: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 18,
    borderWidth: 1,
    color: '#172033',
    flex: 1,
    fontSize: 15,
    maxHeight: 96,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: '#f8f8fc',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  messages: {
    gap: 10,
    padding: 16,
    paddingBottom: 12,
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  screen: {
    backgroundColor: '#f8f8fc',
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 18,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  subtitle: {
    color: '#687386',
    fontSize: 15,
    marginTop: 3,
  },
  suggestionButton: {
    backgroundColor: '#fff1e8',
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '48%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  suggestions: {
    backgroundColor: '#f8f8fc',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '900',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#ff8128',
  },
  userBubbleText: {
    color: '#fff',
    fontWeight: '800',
  },
});
