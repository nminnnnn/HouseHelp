import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview/lib/WebView';

function sanitizeRoom(value?: string) {
  return String(value || 'househelp-call')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
}

export default function CallScreen() {
  const { roomId, type, title } = useLocalSearchParams<{
    roomId: string;
    title?: string;
    type?: 'audio' | 'video' | string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAudio = type === 'audio';
  const url = useMemo(() => {
    const room = sanitizeRoom(roomId);
    const params = [
      'config.prejoinPageEnabled=false',
      `config.startWithVideoMuted=${isAudio ? 'true' : 'false'}`,
      'config.startWithAudioMuted=false',
      'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true',
    ].join('&');

    return `https://meet.jit.si/${room}#${params}`;
  }, [isAudio, roomId]);

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.endButton}>
          <Ionicons color="#fff" name="call" size={18} />
          <Text style={styles.endText}>Ket thuc</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.title}>{title || (isAudio ? 'Cuoc goi am thanh' : 'Video call')}</Text>
          <Text style={styles.subtitle}>HouseHelp Call</Text>
        </View>
      </View>
      <WebView
        allowsInlineMediaPlayback
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        source={{ uri: url }}
        style={styles.webview}
      />
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
  webview: {
    backgroundColor: '#111827',
    flex: 1,
  },
});
