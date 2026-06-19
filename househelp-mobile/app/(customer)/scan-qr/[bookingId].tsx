import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { bookingService } from '../../../lib/bookings';
import { useLanguage } from '../../../lib/language';

const copy = {
  en: {
    allowCamera: 'Allow camera access', back: 'Back',
    cameraBody: 'Allow HouseHelp to use the camera to scan the housekeeper check-in QR code.',
    cameraTitle: 'Camera access required', confirmToken: 'Confirm token', errorFallback: 'Please try again.',
    errorTitle: 'Could not scan QR code', hint: 'Place the housekeeper QR code inside the frame to start the job.',
    manualHint: 'Paste the token copied from the housekeeper QR screen for a one-device demo.',
    manualPlaceholder: 'Paste QR token...', manualTitle: 'Test with QR token', scanning: 'Confirming...',
    successBody: 'The housekeeper has been verified for this booking.', successTitle: 'The job has started', title: 'Scan QR code',
  },
  vi: {
    allowCamera: 'Cho ph\u00e9p camera', back: 'Quay l\u1ea1i',
    cameraBody: 'Cho ph\u00e9p HouseHelp d\u00f9ng camera \u0111\u1ec3 qu\u00e9t m\u00e3 QR check-in c\u1ee7a housekeeper.',
    cameraTitle: 'C\u1ea7n quy\u1ec1n camera', confirmToken: 'X\u00e1c nh\u1eadn b\u1eb1ng token', errorFallback: 'Vui l\u00f2ng th\u1eed l\u1ea1i.',
    errorTitle: 'Kh\u00f4ng qu\u00e9t \u0111\u01b0\u1ee3c QR', hint: '\u0110\u01b0a QR c\u1ee7a housekeeper v\u00e0o khung \u0111\u1ec3 b\u1eaft \u0111\u1ea7u ca l\u00e0m.',
    manualHint: 'D\u00e1n token \u0111\u00e3 sao ch\u00e9p t\u1eeb m\u00e0n QR c\u1ee7a housekeeper \u0111\u1ec3 demo tr\u00ean m\u1ed9t iPhone.',
    manualPlaceholder: 'D\u00e1n QR token...', manualTitle: 'Ki\u1ec3m th\u1eed b\u1eb1ng QR token', scanning: '\u0110ang x\u00e1c nh\u1eadn...',
    successBody: 'Housekeeper \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn \u0111\u00fang booking.', successTitle: 'Ca l\u00e0m \u0111\u00e3 b\u1eaft \u0111\u1ea7u', title: 'Qu\u00e9t QR',
  },
} as const;

export default function ScanBookingQrScreen() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const text = copy[language];

  const submitQr = async (qrToken: string) => {
    const token = qrToken.trim();
    if (hasScannedRef.current || isSubmitting || !bookingId || !token) return;

    try {
      hasScannedRef.current = true;
      setIsSubmitting(true);
      await bookingService.startFromQr(Number(bookingId), token);
      Alert.alert(text.successTitle, text.successBody, [
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
      Alert.alert(text.errorTitle, error.response?.data?.message || error.response?.data?.error || text.errorFallback);
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
          <Text style={styles.permissionTitle}>{text.cameraTitle}</Text>
          <Text style={styles.permissionText}>{text.cameraBody}</Text>
          <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{text.allowCamera}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{text.back}</Text>
          </TouchableOpacity>
          <ManualTokenBox
            isSubmitting={isSubmitting}
            manualToken={manualToken}
            onChangeToken={setManualToken}
            onSubmit={() => submitQr(manualToken)}
            text={text}
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
          <Text style={styles.headerTitle}>{text.title}</Text>
          <View style={styles.backButton} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.hint}>{text.hint}</Text>
          {isSubmitting ? (
            <View style={styles.loadingPill}>
              <ActivityIndicator color="#ff8128" />
              <Text style={styles.loadingText}>{text.scanning}</Text>
            </View>
          ) : null}
          <ManualTokenBox
            isSubmitting={isSubmitting}
            manualToken={manualToken}
            onChangeToken={setManualToken}
            onSubmit={() => submitQr(manualToken)}
            text={text}
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
  text,
}: {
  isSubmitting: boolean;
  manualToken: string;
  onChangeToken: (value: string) => void;
  onSubmit: () => void;
  text: (typeof copy)[keyof typeof copy];
}) {
  return (
    <View style={styles.manualCard}>
      <Text style={styles.manualTitle}>{text.manualTitle}</Text>
      <Text style={styles.manualHint}>{text.manualHint}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={onChangeToken}
        placeholder={text.manualPlaceholder}
        placeholderTextColor="#94a3b8"
        style={styles.manualInput}
        value={manualToken}
      />
      <TouchableOpacity
        disabled={isSubmitting || !manualToken.trim()}
        onPress={onSubmit}
        style={[styles.manualButton, (!manualToken.trim() || isSubmitting) && styles.manualButtonDisabled]}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualButtonText}>{text.confirmToken}</Text>}
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
