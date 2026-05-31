import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../lib/auth';
import { verificationService, type VerificationStatus } from '../../lib/verification';

const documentTypes = [
  { label: 'CCCD/CMND', value: 'id_card' },
  { label: 'Ly lich tu phap', value: 'background_check' },
  { label: 'Chung chi nghe', value: 'certificate' },
];

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    approved: 'Da duyet',
    pending: 'Cho duyet',
    rejected: 'Bi tu choi',
    requires_more_info: 'Can bo sung',
  };

  return labels[status || ''] || 'Chua gui';
}

export default function HousekeeperVerificationScreen() {
  const [documentName, setDocumentName] = useState('');
  const [documentPath, setDocumentPath] = useState('');
  const [documentType, setDocumentType] = useState(documentTypes[0].value);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const submit = async () => {
    if (!user) return;

    if (!documentName.trim() || !documentPath.trim()) {
      Alert.alert('Thieu tai lieu', 'Vui long nhap ten file va duong dan/link tai lieu.');
      return;
    }

    try {
      setIsSubmitting(true);
      await verificationService.submit(user.id, notes.trim(), [
        {
          originalName: documentName.trim(),
          path: documentPath.trim(),
          type: documentType,
        },
      ]);
      setDocumentName('');
      setDocumentPath('');
      setNotes('');
      await loadStatus();
      Alert.alert('Da gui', 'Tai lieu xac minh da duoc gui cho admin duyet.');
    } catch (error: any) {
      Alert.alert('Khong gui duoc', error.response?.data?.message || error.response?.data?.error || 'Vui long thu lai.');
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

        <Text style={styles.title}>Tai lieu xac minh</Text>
        <Text style={styles.subtitle}>Gui giay to de admin kiem tra va duyet ho so housekeeper.</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>{status?.isVerified && status?.isApproved ? 'Ho so da xac minh' : statusLabel(status?.request?.status)}</Text>
          <Text style={styles.statusText}>
            {status?.documents?.length || 0} tai lieu da gui
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Loai tai lieu</Text>
          <View style={styles.typeRow}>
            {documentTypes.map((item) => {
              const selected = item.value === documentType;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setDocumentType(item.value)}
                  style={[styles.typeButton, selected && styles.typeButtonActive]}
                >
                  <Text style={[styles.typeText, selected && styles.typeTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Ten file</Text>
          <TextInput onChangeText={setDocumentName} placeholder="cccd-mat-truoc.jpg" style={styles.input} value={documentName} />

          <Text style={styles.label}>Duong dan/link file</Text>
          <TextInput onChangeText={setDocumentPath} placeholder="/uploads/verification/cccd.jpg" style={styles.input} value={documentPath} />

          <Text style={styles.label}>Ghi chu cho admin</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Mo ta ngan gon ve tai lieu hoac kinh nghiem cua ban"
            style={[styles.input, styles.multiline]}
            value={notes}
          />

          <TouchableOpacity disabled={isSubmitting} onPress={submit} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{isSubmitting ? 'Dang gui' : 'Gui cho admin duyet'}</Text>
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
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    padding: 14,
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
  section: {
    backgroundColor: '#fff',
    borderColor: '#edf0f4',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
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
  typeButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  typeButtonActive: {
    backgroundColor: '#ff8128',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeText: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '900',
  },
  typeTextActive: {
    color: '#fff',
  },
});
