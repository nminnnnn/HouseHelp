import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { profileService, type UploadFileType } from '../../lib/profile';
import { verificationService, type VerificationStatus } from '../../lib/verification';

type DocumentKey = 'idCardFront' | 'idCardBack' | 'selfie';

type SelectedDocument = {
  fileType: UploadFileType;
  name: string;
  title: string;
  type: string;
  uri: string;
};

const documentSlots: {
  description: string;
  fileType: UploadFileType;
  icon: string;
  key: DocumentKey;
  title: string;
  type: string;
}[] = [
  {
    description: 'Mặt trước căn cước công dân rõ số, họ tên và ảnh.',
    fileType: 'id_card_front',
    icon: 'card-outline',
    key: 'idCardFront',
    title: 'CCCD mặt trước',
    type: 'id_card_front',
  },
  {
    description: 'Mặt sau căn cước công dân rõ ngày cấp và nơi cấp.',
    fileType: 'id_card_back',
    icon: 'card-outline',
    key: 'idCardBack',
    title: 'CCCD mặt sau',
    type: 'id_card_back',
  },
  {
    description: 'Ảnh selfie rõ mặt để admin đối chiếu với căn cước.',
    fileType: 'document',
    icon: 'person-circle-outline',
    key: 'selfie',
    title: 'Ảnh selfie',
    type: 'selfie',
  },
];

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    approved: 'Đã duyệt',
    pending: 'Chờ admin duyệt',
    rejected: 'Bị từ chối',
    requires_more_info: 'Cần bổ sung',
  };

  return labels[status || ''] || 'Chưa gửi';
}

function fileNameFromUri(uri: string, fallback: string) {
  const name = uri.split('/').pop()?.split('?')[0];
  return name || fallback;
}

function mimeTypeFromName(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export default function HousekeeperVerificationScreen() {
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, SelectedDocument>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const missingSlots = useMemo(
    () => documentSlots.filter((slot) => !documents[slot.key]),
    [documents],
  );

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedUser = await authService.checkAuthStatus();
      setUser(storedUser);

      if (!storedUser) {
        router.replace('/(auth)/login');
        return;
      }

      const nextStatus = await verificationService.getStatus(storedUser.id);
      setStatus(nextStatus);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus]),
  );

  const pickDocument = async (slot: (typeof documentSlots)[number], fromCamera = false) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert('Cần quyền truy cập', fromCamera ? 'Vui lòng cho phép dùng camera để chụp ảnh.' : 'Vui lòng cho phép truy cập thư viện ảnh.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.82 })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.82,
        });

    if (result.canceled || !result.assets[0]?.uri) return;

    const uri = result.assets[0].uri;
    setDocuments((current) => ({
      ...current,
      [slot.key]: {
        fileType: slot.fileType,
        name: fileNameFromUri(uri, `${slot.type}.jpg`),
        title: slot.title,
        type: slot.type,
        uri,
      },
    }));
  };

  const submit = async () => {
    if (!user) return;

    if (missingSlots.length > 0) {
      Alert.alert('Thiếu hình ảnh', `Vui lòng cung cấp: ${missingSlots.map((slot) => slot.title).join(', ')}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedDocuments = [];

      for (const slot of documentSlots) {
        const document = documents[slot.key]!;
        const uploaded = await profileService.uploadImage(user.id, document.fileType, {
          name: document.name,
          type: mimeTypeFromName(document.name),
          uri: document.uri,
        });

        uploadedDocuments.push({
          originalName: document.name,
          path: uploaded.file.path,
          type: document.type,
        });
      }

      await verificationService.submit(
        user.id,
        notes.trim() || 'Xác thực danh tính bằng CCCD hai mặt và ảnh selfie.',
        uploadedDocuments,
      );

      setDocuments({});
      setNotes('');
      await loadStatus();
      Alert.alert('Đã gửi xác thực', 'Hồ sơ xác thực danh tính đã được gửi đến admin để xét duyệt.');
    } catch (error: any) {
      Alert.alert('Không gửi được', error.response?.data?.message || error.response?.data?.error || 'Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <ActivityIndicator color="#ff8128" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 44) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color="#ff8128" name="chevron-back" size={22} />
          <Text style={styles.backText}>Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Xác thực danh tính</Text>
        <Text style={styles.subtitle}>Cung cấp CCCD hai mặt và ảnh selfie. Admin sẽ kiểm tra và duyệt hồ sơ housekeeper.</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{status?.isVerified && status?.isApproved ? 'Hồ sơ đã xác minh' : statusLabel(status?.request?.status)}</Text>
          <Text style={styles.statusText}>{status?.documents?.length || 0} tài liệu đã gửi</Text>
        </View>

        <View style={styles.section}>
          {documentSlots.map((slot) => {
            const selected = documents[slot.key];

            return (
              <View key={slot.key} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <Ionicons color="#ff8128" name={slot.icon as any} size={22} />
                  </View>
                  <View style={styles.documentTitleWrap}>
                    <Text style={styles.documentTitle}>{slot.title}</Text>
                    <Text style={styles.documentDescription}>{slot.description}</Text>
                  </View>
                  {selected ? <Ionicons color="#16a34a" name="checkmark-circle" size={24} /> : null}
                </View>

                {selected ? <Image source={{ uri: selected.uri }} style={styles.preview} /> : null}

                <View style={styles.documentActions}>
                  <TouchableOpacity activeOpacity={0.84} onPress={() => pickDocument(slot)} style={styles.secondaryButton}>
                    <Ionicons color="#ff8128" name="images-outline" size={18} />
                    <Text style={styles.secondaryText}>{selected ? 'Đổi ảnh' : 'Chọn ảnh'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.84} onPress={() => pickDocument(slot, true)} style={styles.secondaryButton}>
                    <Ionicons color="#ff8128" name="camera-outline" size={18} />
                    <Text style={styles.secondaryText}>Chụp ảnh</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <Text style={styles.label}>Ghi chú cho admin</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Ví dụ: ảnh được chụp hôm nay, thông tin CCCD rõ và chính chủ."
            style={[styles.input, styles.multiline]}
            value={notes}
          />

          <TouchableOpacity disabled={isSubmitting} onPress={submit} style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Gửi cho admin duyệt</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  documentCard: {
    borderBottomColor: '#edf0f4',
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingTop: 16,
  },
  documentDescription: {
    color: '#687386',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 3,
  },
  documentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  documentTitle: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
  documentTitleWrap: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f8f8fc',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    color: '#172033',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    padding: 13,
  },
  label: {
    color: '#172033',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  preview: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 160,
    marginTop: 12,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
    padding: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#f8f8fc',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    padding: 11,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statusCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  statusText: {
    color: '#687386',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  statusTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#687386',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  title: {
    color: '#172033',
    fontSize: 30,
    fontWeight: '900',
  },
});
