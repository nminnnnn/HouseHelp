import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authService } from '../lib/auth';
import { storage } from '../lib/storage';
import { profileService, type UploadFileType, type UserProfile } from '../lib/profile';

function publicUrl(value?: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith('http')) {
    return value;
  }

  return `${process.env.EXPO_PUBLIC_SOCKET_URL}${value}`;
}

function imageName(fileType: UploadFileType) {
  if (fileType === 'avatar') return 'avatar.jpg';
  if (fileType === 'id_card_front') return 'id-card-front.jpg';
  return 'id-card-back.jpg';
}

export default function ProfileScreen() {
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<UploadFileType | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = await authService.checkAuthStatus();

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      setUserId(user.id);
      const profile = await profileService.getProfile(user.id);
      setForm(profile);
    } catch (error: any) {
      Alert.alert('Khong tai duoc profile', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateField = (key: keyof UserProfile, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      setIsSaving(true);
      const updated = await profileService.updateProfile(userId, form);
      setForm(updated);
      await storage.saveUser(updated);
      Alert.alert('Da luu', 'Profile da duoc cap nhat.');
    } catch (error: any) {
      Alert.alert('Khong luu duoc', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async (fileType: UploadFileType) => {
    if (!userId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Can quyen truy cap', 'Vui long cho phep truy cap thu vien anh de upload.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const file = {
      name: asset.fileName || imageName(fileType),
      type: asset.mimeType || 'image/jpeg',
      uri: asset.uri,
    };

    try {
      setUploadingType(fileType);
      await profileService.uploadImage(userId, fileType, file);
      await loadProfile();
      Alert.alert('Upload thanh cong', 'Anh da duoc cap nhat.');
    } catch (error: any) {
      Alert.alert('Upload that bai', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setUploadingType(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const avatarUrl = publicUrl(form.avatar);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.screen}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Quay lai</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>{form.email}</Text>

      <View style={styles.avatarBox}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{form.fullName?.slice(0, 1) || 'U'}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => handlePickImage('avatar')} style={styles.uploadButton}>
          <Text style={styles.uploadText}>{uploadingType === 'avatar' ? 'Dang upload...' : 'Upload avatar'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Ho ten</Text>
      <TextInput onChangeText={(value) => updateField('fullName', value)} style={styles.input} value={form.fullName || ''} />

      <Text style={styles.label}>So dien thoai</Text>
      <TextInput
        keyboardType="phone-pad"
        onChangeText={(value) => updateField('phone', value)}
        style={styles.input}
        value={form.phone || ''}
      />

      <Text style={styles.label}>Dia chi</Text>
      <TextInput onChangeText={(value) => updateField('address', value)} style={styles.input} value={form.address || ''} />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Thanh pho</Text>
          <TextInput onChangeText={(value) => updateField('city', value)} style={styles.input} value={form.city || ''} />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Quan/Huyen</Text>
          <TextInput onChangeText={(value) => updateField('district', value)} style={styles.input} value={form.district || ''} />
        </View>
      </View>

      <Text style={styles.label}>Gioi thieu</Text>
      <TextInput
        multiline
        onChangeText={(value) => updateField('bio', value)}
        style={[styles.input, styles.multiline]}
        value={form.bio || ''}
      />

      <View style={styles.documents}>
        <Text style={styles.sectionTitle}>Giay to xac minh</Text>
        <TouchableOpacity onPress={() => handlePickImage('id_card_front')} style={styles.documentButton}>
          <Text style={styles.documentText}>
            {uploadingType === 'id_card_front' ? 'Dang upload...' : 'Upload mat truoc CCCD'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handlePickImage('id_card_back')} style={styles.documentButton}>
          <Text style={styles.documentText}>
            {uploadingType === 'id_card_back' ? 'Dang upload...' : 'Upload mat sau CCCD'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity disabled={isSaving} onPress={handleSave} style={styles.primaryButton}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Luu profile</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 44,
    height: 88,
    width: 88,
  },
  avatarBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    padding: 18,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 44,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '700',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  documentButton: {
    backgroundColor: '#e6f4f1',
    borderRadius: 8,
    padding: 13,
  },
  documentText: {
    color: '#0f766e',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  documents: {
    gap: 10,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    marginBottom: 14,
    padding: 14,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    marginTop: 18,
    padding: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 18,
  },
  title: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  uploadButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  uploadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
