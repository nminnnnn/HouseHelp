import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { useLanguage } from '../../lib/language';
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

const copy = {
  en: {
    back: 'Dashboard',
    camera: 'Take photo',
    changePhoto: 'Change photo',
    choosePhoto: 'Choose photo',
    defaultNotes: 'Identity verification with both sides of the ID card and a selfie.',
    documentsSent: (count: number) => `${count} document${count === 1 ? '' : 's'} submitted`,
    documentSlots: [
      {
        description: 'Front side of the ID card with clear number, full name, and photo.',
        fileType: 'id_card_front' as UploadFileType,
        icon: 'card-outline',
        key: 'idCardFront' as DocumentKey,
        title: 'ID card front',
        type: 'id_card_front',
      },
      {
        description: 'Back side of the ID card with clear issue date and issuing place.',
        fileType: 'id_card_back' as UploadFileType,
        icon: 'card-outline',
        key: 'idCardBack' as DocumentKey,
        title: 'ID card back',
        type: 'id_card_back',
      },
      {
        description: 'Clear selfie for admin to compare with the ID card.',
        fileType: 'document' as UploadFileType,
        icon: 'person-circle-outline',
        key: 'selfie' as DocumentKey,
        title: 'Selfie',
        type: 'selfie',
      },
    ],
    missingImages: 'Missing images',
    missingImagesText: (items: string) => `Please provide: ${items}.`,
    notesLabel: 'Notes for admin',
    notesPlaceholder: 'Example: photos were taken today and the ID information is clear.',
    permissionTitle: 'Permission required',
    permissionCamera: 'Please allow camera access to take a photo.',
    permissionLibrary: 'Please allow photo library access.',
    statusApproved: 'Approved',
    statusFallback: 'Not submitted',
    statusPending: 'Pending admin review',
    statusProfileVerified: 'Profile verified',
    statusRejected: 'Rejected',
    statusRequiresMoreInfo: 'Needs more information',
    submit: 'Submit for admin review',
    submitError: 'Could not submit',
    submitErrorFallback: 'Please try again.',
    submitSuccess: 'Verification submitted',
    submitSuccessText: 'Your identity verification profile has been sent to admin for review.',
    subtitle: 'Provide both sides of your ID card and a selfie. Admin will check and approve your housekeeper profile.',
    title: 'Identity verification',
  },
  vi: {
    back: 'Dashboard',
    camera: 'Ch\u1ee5p \u1ea3nh',
    changePhoto: '\u0110\u1ed5i \u1ea3nh',
    choosePhoto: 'Ch\u1ecdn \u1ea3nh',
    defaultNotes: 'X\u00e1c th\u1ef1c danh t\u00ednh b\u1eb1ng CCCD hai m\u1eb7t v\u00e0 \u1ea3nh selfie.',
    documentsSent: (count: number) => `${count} t\u00e0i li\u1ec7u \u0111\u00e3 g\u1eedi`,
    documentSlots: [
      {
        description: 'M\u1eb7t tr\u01b0\u1edbc c\u0103n c\u01b0\u1edbc c\u00f4ng d\u00e2n r\u00f5 s\u1ed1, h\u1ecd t\u00ean v\u00e0 \u1ea3nh.',
        fileType: 'id_card_front' as UploadFileType,
        icon: 'card-outline',
        key: 'idCardFront' as DocumentKey,
        title: 'CCCD m\u1eb7t tr\u01b0\u1edbc',
        type: 'id_card_front',
      },
      {
        description: 'M\u1eb7t sau c\u0103n c\u01b0\u1edbc c\u00f4ng d\u00e2n r\u00f5 ng\u00e0y c\u1ea5p v\u00e0 n\u01a1i c\u1ea5p.',
        fileType: 'id_card_back' as UploadFileType,
        icon: 'card-outline',
        key: 'idCardBack' as DocumentKey,
        title: 'CCCD m\u1eb7t sau',
        type: 'id_card_back',
      },
      {
        description: '\u1ea2nh selfie r\u00f5 m\u1eb7t \u0111\u1ec3 admin \u0111\u1ed1i chi\u1ebfu v\u1edbi c\u0103n c\u01b0\u1edbc.',
        fileType: 'document' as UploadFileType,
        icon: 'person-circle-outline',
        key: 'selfie' as DocumentKey,
        title: '\u1ea2nh selfie',
        type: 'selfie',
      },
    ],
    missingImages: 'Thi\u1ebfu h\u00ecnh \u1ea3nh',
    missingImagesText: (items: string) => `Vui l\u00f2ng cung c\u1ea5p: ${items}.`,
    notesLabel: 'Ghi ch\u00fa cho admin',
    notesPlaceholder: 'V\u00ed d\u1ee5: \u1ea3nh \u0111\u01b0\u1ee3c ch\u1ee5p h\u00f4m nay, th\u00f4ng tin CCCD r\u00f5 v\u00e0 ch\u00ednh ch\u1ee7.',
    permissionTitle: 'C\u1ea7n quy\u1ec1n truy c\u1eadp',
    permissionCamera: 'Vui l\u00f2ng cho ph\u00e9p d\u00f9ng camera \u0111\u1ec3 ch\u1ee5p \u1ea3nh.',
    permissionLibrary: 'Vui l\u00f2ng cho ph\u00e9p truy c\u1eadp th\u01b0 vi\u1ec7n \u1ea3nh.',
    statusApproved: '\u0110\u00e3 duy\u1ec7t',
    statusFallback: 'Ch\u01b0a g\u1eedi',
    statusPending: 'Ch\u1edd admin duy\u1ec7t',
    statusProfileVerified: 'H\u1ed3 s\u01a1 \u0111\u00e3 x\u00e1c minh',
    statusRejected: 'B\u1ecb t\u1eeb ch\u1ed1i',
    statusRequiresMoreInfo: 'C\u1ea7n b\u1ed5 sung',
    submit: 'G\u1eedi cho admin duy\u1ec7t',
    submitError: 'Kh\u00f4ng g\u1eedi \u0111\u01b0\u1ee3c',
    submitErrorFallback: 'Vui l\u00f2ng th\u1eed l\u1ea1i.',
    submitSuccess: '\u0110\u00e3 g\u1eedi x\u00e1c th\u1ef1c',
    submitSuccessText: 'H\u1ed3 s\u01a1 x\u00e1c th\u1ef1c danh t\u00ednh \u0111\u00e3 \u0111\u01b0\u1ee3c g\u1eedi \u0111\u1ebfn admin \u0111\u1ec3 x\u00e9t duy\u1ec7t.',
    subtitle: 'Cung c\u1ea5p CCCD hai m\u1eb7t v\u00e0 \u1ea3nh selfie. Admin s\u1ebd ki\u1ec3m tra v\u00e0 duy\u1ec7t h\u1ed3 s\u01a1 housekeeper.',
    title: 'X\u00e1c th\u1ef1c danh t\u00ednh',
  },
} as const;

function statusLabel(status: string | undefined, text: (typeof copy)['en'] | (typeof copy)['vi']) {
  const labels: Record<string, string> = {
    approved: text.statusApproved,
    pending: text.statusPending,
    rejected: text.statusRejected,
    requires_more_info: text.statusRequiresMoreInfo,
  };

  return labels[status || ''] || text.statusFallback;
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
  const { language } = useLanguage();
  const text = copy[language];

  const missingSlots = useMemo(
    () => text.documentSlots.filter((slot) => !documents[slot.key]),
    [documents, text.documentSlots],
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

  const pickDocument = async (slot: (typeof text.documentSlots)[number], fromCamera = false) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(text.permissionTitle, fromCamera ? text.permissionCamera : text.permissionLibrary);
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
      Alert.alert(text.missingImages, text.missingImagesText(missingSlots.map((slot) => slot.title).join(', '))); 
      return;
    }

    try {
      setIsSubmitting(true);
      const uploadedDocuments = [];

      for (const slot of text.documentSlots) {
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
        notes.trim() || text.defaultNotes,
        uploadedDocuments,
      );

      setDocuments({});
      setNotes('');
      try {
        await loadStatus();
      } catch (statusError) {
        console.log('Could not refresh verification status after submit:', statusError);
      }
      Alert.alert(text.submitSuccess, text.submitSuccessText);
    } catch (error: any) {
      Alert.alert(text.submitError, error.response?.data?.message || error.response?.data?.error || text.submitErrorFallback);
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
          <Text style={styles.backText}>{text.back}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{text.title}</Text>
        <Text style={styles.subtitle}>{text.subtitle}</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{status?.isVerified && status?.isApproved ? text.statusProfileVerified : statusLabel(status?.request?.status, text)}</Text>
          <Text style={styles.statusText}>{text.documentsSent(status?.documents?.length || 0)}</Text>
        </View>

        <View style={styles.section}>
          {text.documentSlots.map((slot) => {
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
                    <Text style={styles.secondaryText}>{selected ? text.changePhoto : text.choosePhoto}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.84} onPress={() => pickDocument(slot, true)} style={styles.secondaryButton}>
                    <Ionicons color="#ff8128" name="camera-outline" size={18} />
                    <Text style={styles.secondaryText}>{text.camera}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <Text style={styles.label}>{text.notesLabel}</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder={text.notesPlaceholder}
            style={[styles.input, styles.multiline]}
            value={notes}
          />

          <TouchableOpacity disabled={isSubmitting} onPress={submit} style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{text.submit}</Text>}
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
