import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
import { getSocket } from '../../lib/socket';

function sanitizeRoom(value?: string) {
  return String(value || 'househelp-call')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
}

const JITSI_BASE_URL = (process.env.EXPO_PUBLIC_JITSI_URL || 'https://meet.ffmuc.net').replace(/\/+$/, '');

const copy = {
  en: {
    audioTitle: 'Audio call',
    body: 'If the browser does not open automatically, you can reopen the call.',
    callFailed: 'Could not start call',
    callFailedText: 'The recipient is offline or has not opened the app.',
    callRejected: 'Call rejected',
    callRejectedText: 'The recipient rejected the call.',
    end: 'End',
    jitsiError: 'Could not open Jitsi',
    jitsiErrorText: 'Please try again or open the call link in your browser.',
    opening: 'Opening Jitsi Meet',
    reopen: 'Reopen call',
    videoTitle: 'Video call',
  },
  vi: {
    audioTitle: 'Cuộc gọi âm thanh',
    body: 'Nếu trình duyệt không tự mở, bạn có thể bấm mở lại cuộc gọi.',
    callFailed: 'Không gọi được',
    callFailedText: 'Người nhận đang offline hoặc chưa mở ứng dụng.',
    callRejected: 'Cuộc gọi bị từ chối',
    callRejectedText: 'Người nhận đã từ chối cuộc gọi.',
    end: 'Kết thúc',
    jitsiError: 'Không mở được Jitsi',
    jitsiErrorText: 'Hãy thử lại hoặc mở link cuộc gọi bằng trình duyệt.',
    opening: 'Đang mở Jitsi Meet',
    reopen: 'Mở lại cuộc gọi',
    videoTitle: 'Video call',
  },
} as const;

export default function CallScreen() {
  const { bookingId, roomId, targetUserId, type, title } = useLocalSearchParams<{
    bookingId?: string;
    roomId: string;
    targetUserId?: string;
    title?: string;
    type?: 'audio' | 'video' | string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const text = copy[language];
  const isAudio = type === 'audio';
  const url = useMemo(() => {
    const room = sanitizeRoom(roomId);
    const params = [
      'config.prejoinPageEnabled=false',
      `config.startWithVideoMuted=${isAudio ? 'true' : 'false'}`,
      'config.startWithAudioMuted=false',
      'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
    ].join('&');

    return `${JITSI_BASE_URL}/${room}#${params}`;
  }, [isAudio, roomId]);

  useEffect(() => {
    WebBrowser.openBrowserAsync(url).catch(() => {
      Alert.alert(text.jitsiError, text.jitsiErrorText);
    });
  }, [text.jitsiError, text.jitsiErrorText, url]);

  useEffect(() => {
    let isMounted = true;
    const socket = getSocket();

    async function joinCallEvents() {
      const currentUser = await authService.checkAuthStatus();

      if (!currentUser || !isMounted) {
        return;
      }

      if (!socket.connected) {
        socket.connect();
      }

      socket.emit('join', {
        role: currentUser.role,
        userId: currentUser.id,
        userName: currentUser.fullName || currentUser.email,
      });
    }

    const handleCallRejected = (payload?: { roomName?: string; bookingId?: string }) => {
      if (payload?.roomName && payload.roomName !== roomId) {
        return;
      }

      if (payload?.bookingId && bookingId && String(payload.bookingId) !== String(bookingId)) {
        return;
      }

      Alert.alert(text.callRejected, text.callRejectedText, [
        {
          text: 'OK',
          onPress: () => {
            WebBrowser.dismissBrowser();
            router.back();
          },
        },
      ]);
    };

    const handleCallFailed = (payload?: { error?: string }) => {
      Alert.alert(text.callFailed, payload?.error || text.callFailedText, [
        {
          text: 'OK',
          onPress: () => {
            WebBrowser.dismissBrowser();
            router.back();
          },
        },
      ]);
    };

    joinCallEvents();
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_failed', handleCallFailed);

    return () => {
      isMounted = false;
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_failed', handleCallFailed);
    };
  }, [bookingId, roomId, router, text.callFailed, text.callFailedText, text.callRejected, text.callRejectedText]);

  const endCall = () => {
    WebBrowser.dismissBrowser();

    if (targetUserId) {
      getSocket().emit('call_ended', {
        bookingId,
        roomName: roomId,
        targetUserId: Number(targetUserId),
      });
    }

    router.back();
  };

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={endCall} style={styles.endButton}>
          <Ionicons color="#fff" name="call" size={18} />
          <Text style={styles.endText}>{text.end}</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.title}>{title || (isAudio ? text.audioTitle : text.videoTitle)}</Text>
          <Text style={styles.subtitle}>HouseHelp Call</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.statusIcon}>
          <Ionicons color="#ff8128" name={isAudio ? 'call-outline' : 'videocam-outline'} size={36} />
        </View>
        <Text style={styles.bodyTitle}>{text.opening}</Text>
        <Text style={styles.bodyText}>{text.body}</Text>
        <TouchableOpacity activeOpacity={0.84} onPress={() => WebBrowser.openBrowserAsync(url)} style={styles.openButton}>
          <Ionicons color="#111827" name="open-outline" size={18} />
          <Text style={styles.openText}>{text.reopen}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  endButton: {
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  endText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  body: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  bodyText: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  bodyTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 18,
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#111827',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#111827',
    flex: 1,
  },
  openButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  openText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  statusIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});
