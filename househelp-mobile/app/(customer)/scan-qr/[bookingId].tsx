import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingService } from '../../../lib/bookings';

export default function ScanBookingQrScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const submitQr = async (qrToken: string) => {
    const token = qrToken.trim();
    if (hasScannedRef.current || isSubmitting || !bookingId || !token) return;

    try {
      hasScannedRef.current = true;
      setIsSubmitting(true);
      await bookingService.startFromQr(Number(bookingId), token);
      Alert.alert('Ca làm đã bắt đầu', 'Housekeeper đã được xác nhận đúng booking.', [
        {
          text: 'OK',
          onPress: () => router.replace({
            pathname: '/(customer)/bookings',
            params: { refresh: String(Date.now()) },
          }),
        },
      ]);
    } catch (error: any) {
      hasScannedRef.current = false;
      setIsSubmitting(false);
      Alert.alert('Không quét được QR', error.response?.data?.message || error.response?.data?.error || 'Vui lòng thử lại.');
    }
  };

  if (!permission) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#ff8128" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.permissionScreen}>
          <Ionicons color="#ff8128" name="camera-outline" size={54} />
          <Text style={styles.permissionTitle}>Cần quyền camera</Text>
          <Text style={styles.permissionText}>Cho phép HouseHelp dùng camera để quét QR check-in của housekeeper.</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Cho phép camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Quay lại</Text>
          </TouchableOpacity>
          <ManualTokenBox
            isSubmitting={isSubmitting}
            manualToken={manualToken}
            onChangeToken={setManualToken}
            onSubmit={() => submitQr(manualToken)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <View style={styles.screen}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={isSubmitting ? undefined : ({ data }) => submitQr(data)}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color="#fff" name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quét QR</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.hint}>Đưa QR của housekeeper vào khung để bắt đầu ca làm.</Text>
          {isSubmitting ? (
            <View style={styles.loadingPill}>
              <ActivityIndicator color="#ff8128" />
              <Text style={styles.loadingText}>Đang xác nhận...</Text>
            </View>
          ) : null}
          <ManualTokenBox
            isSubmitting={isSubmitting}
            manualToken={manualToken}
            onChangeToken={setManualToken}
            onSubmit={() => submitQr(manualToken)}
          />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function ManualTokenBox({
  isSubmitting,
  manualToken,
  onChangeToken,
  onSubmit,
}: {
  isSubmitting: boolean;
  manualToken: string;
  onChangeToken: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.manualCard}>
      <Text style={styles.manualTitle}>Test bằng QR Token</Text>
      <Text style={styles.manualHint}>Dán token đã copy từ màn QR của housekeeper để demo trên một iPhone.</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onChangeToken}
        placeholder="Dán QR token..."
        placeholderTextColor="#94a3b8"
        style={styles.manualInput}
        value={manualToken}
      />
      <TouchableOpacity
        disabled={isSubmitting || !manualToken.trim()}
        onPress={onSubmit}
        style={[styles.manualButton, (!manualToken.trim() || isSubmitting) && styles.manualButtonDisabled]}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualButtonText}>Xác nhận bằng token</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  corner: {
    borderColor: '#ff8128',
    height: 46,
    position: 'absolute',
    width: 46,
  },
  cornerBottomLeft: {
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    bottom: -2,
    left: -2,
  },
  cornerBottomRight: {
    borderBottomWidth: 5,
    borderRightWidth: 5,
    bottom: -2,
    right: -2,
  },
  cornerTopLeft: {
    borderLeftWidth: 5,
    borderTopWidth: 5,
    left: -2,
    top: -2,
  },
  cornerTopRight: {
    borderRightWidth: 5,
    borderTopWidth: 5,
    right: -2,
    top: -2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    width: '100%',
    zIndex: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  hint: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 28,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  loadingPill: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loadingText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  manualButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  manualButtonDisabled: {
    opacity: 0.55,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  manualCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 24,
    padding: 16,
    width: '88%',
  },
  manualHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  manualInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 12,
    marginTop: 10,
    maxHeight: 86,
    minHeight: 56,
    padding: 10,
    textAlignVertical: 'top',
  },
  manualTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    flex: 1,
    justifyContent: 'center',
  },
  permissionScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  permissionTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 999,
    minWidth: 180,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#0f172a',
    flex: 1,
  },
  scanFrame: {
    height: 250,
    width: 250,
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    marginTop: 14,
    padding: 10,
  },
  secondaryText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
});
