import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { authService } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
import { getSocket } from '../../lib/socket';

function sanitizeRoom(value?: string) {
  return String(value || 'househelp-call')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
}

function encodeJitsiString(value: string) {
  return encodeURIComponent(JSON.stringify(value));
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
  const [displayName, setDisplayName] = useState('');
  const [hasLoadedUser, setHasLoadedUser] = useState(false);
  const text = copy[language];
  const isAudio = type === 'audio';
  const url = useMemo(() => {
    const room = sanitizeRoom(roomId);
    const jitsiDisplayName = encodeJitsiString(displayName || 'HouseHelp User');
    const params = [
      'config.prejoinPageEnabled=false',
      'config.prejoinConfig.enabled=false',
      'config.requireDisplayName=false',
      `config.startWithVideoMuted=${isAudio ? 'true' : 'false'}`,
      'config.startWithAudioMuted=false',
      'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
      `config.defaultLocalDisplayName=${jitsiDisplayName}`,
      `userInfo.displayName=${jitsiDisplayName}`,
    ].join('&');

    return `${JITSI_BASE_URL}/${room}#${params}`;
  }, [displayName, isAudio, roomId]);
  const injectedJitsiProfile = useMemo(() => {
    const safeDisplayName = JSON.stringify(displayName || 'HouseHelp User');

    return `
      (function() {
        try {
          localStorage.setItem('displayname', ${safeDisplayName});
          localStorage.setItem('user.displayname', ${safeDisplayName});
          localStorage.setItem('jitsi.settings', JSON.stringify({ displayName: ${safeDisplayName} }));
        } catch (error) {}
      })();
      true;
    `;
  }, [displayName]);

  useEffect(() => {
    let isMounted = true;

    authService.checkAuthStatus()
      .then((currentUser) => {
        if (!isMounted) return;
        setDisplayName(currentUser?.fullName || currentUser?.email || '');
      })
      .catch(() => {
        if (!isMounted) return;
        setDisplayName('');
      })
      .finally(() => {
        if (isMounted) setHasLoadedUser(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
        {hasLoadedUser ? (
          <WebView
            allowsInlineMediaPlayback
            domStorageEnabled
            injectedJavaScriptBeforeContentLoaded={injectedJitsiProfile}
            javaScriptEnabled
            mediaCapturePermissionGrantType="grant"
            mediaPlaybackRequiresUserAction={false}
            onError={() => Alert.alert(text.jitsiError, text.jitsiErrorText)}
            originWhitelist={['*']}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color="#ff8128" size="large" />
                <Text style={styles.bodyTitle}>{text.opening}</Text>
              </View>
            )}
            sharedCookiesEnabled
            source={{ uri: url }}
            startInLoadingState
            style={styles.webView}
            thirdPartyCookiesEnabled
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color="#ff8128" size="large" />
            <Text style={styles.bodyTitle}>{text.opening}</Text>
          </View>
        )}
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
    backgroundColor: '#f7f8fa',
    flex: 1,
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
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
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
  webView: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
});
