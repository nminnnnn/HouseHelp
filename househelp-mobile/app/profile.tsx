import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../components/customer-bottom-nav';
import { authService } from '../lib/auth';
import { storage } from '../lib/storage';
import { profileService, type UserProfile } from '../lib/profile';

const accountRows = [
  { action: 'edit', label: 'Personal Profile', icon: 'person' },
  { action: 'addresses', label: 'Saved Addresses', icon: 'location' },
  { action: 'transactions', label: 'Transaction history', icon: 'time' },
  { action: 'rewards', label: 'My Rewards', icon: 'gift' },
  { action: 'favorites', label: 'Favorite Housekeepers', icon: 'heart' },
  { action: 'blockList', label: 'Block List', icon: 'ban' },
  { action: 'business', label: 'Create a Business account', icon: 'business' },
];

const utilityRows = [
  { action: 'pay', label: 'HouseHelp Pay', icon: 'wallet' },
  { action: 'language', label: 'Language', icon: 'globe' },
  { action: 'help', label: 'Help Center', icon: 'help-circle' },
];

type AccountAction =
  | 'addresses'
  | 'blockList'
  | 'business'
  | 'edit'
  | 'favorites'
  | 'help'
  | 'language'
  | 'pay'
  | 'rewards'
  | 'transactions';

type PanelAction = Exclude<AccountAction, 'addresses' | 'blockList' | 'edit' | 'favorites' | 'help' | 'transactions' | 'business'>;

function initials(name?: string) {
  return (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AccountRow({ label, icon, onPress }: { label: string; icon: string; onPress?: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.rowButton}>
      <View style={styles.rowIcon}>
        <Ionicons color="#ff8128" name={icon as any} size={18} />
      </View>
      <Text numberOfLines={1} style={styles.rowLabel}>{label}</Text>
      <Ionicons color="#ff8128" name="chevron-forward" size={22} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelAction | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
      setForm({ ...user, ...profile });
    } catch (error: any) {
      Alert.alert('Khong tai duoc profile', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, refresh]);

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
      setIsEditing(false);
      Alert.alert('Da luu', 'Profile da duoc cap nhat.');
    } catch (error: any) {
      Alert.alert('Khong luu duoc', error.response?.data?.message || error.response?.data?.error || 'Thu lai sau.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  const handleAccountAction = (action: AccountAction) => {
    switch (action) {
      case 'edit':
        setIsEditing(true);
        break;
      case 'addresses':
        router.push('/addresses');
        break;
      case 'transactions':
        router.push('/(customer)/bookings');
        break;
      case 'favorites':
        router.push('/favorite-housekeepers');
        break;
      case 'blockList':
        router.push('/blocked-housekeepers');
        break;
      case 'business':
        router.push('/(auth)/register-housekeeper');
        break;
      case 'help':
        router.push('/chatbot');
        break;
      default:
        setActivePanel(action);
        break;
    }
  };

  const closePanel = () => setActivePanel(null);

  const panelTitle = {
    language: 'Language',
    pay: 'HouseHelp Pay',
    rewards: 'My Rewards',
  }[activePanel || 'rewards'];

  const renderPanelContent = () => {
    if (activePanel === 'rewards') {
      return (
        <>
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>0 points</Text>
            <Text style={styles.panelCardText}>Diem thuong se xuat hien sau khi ban hoan thanh booking hoac nhan uu dai.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)')} style={styles.panelPrimaryButton}>
            <Text style={styles.panelPrimaryText}>Dat dich vu</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activePanel === 'pay') {
      return (
        <>
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>Thanh toan tien mat dang bat</Text>
            <Text style={styles.panelCardText}>HouseHelp Pay se theo doi cac thanh toan da xac nhan trong Activity.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)/bookings')} style={styles.panelPrimaryButton}>
            <Text style={styles.panelPrimaryText}>Xem thanh toan</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activePanel === 'language') {
      return (
        <View style={styles.panelCard}>
          <Text style={styles.panelCardTitle}>Ngon ngu hien tai</Text>
          <Text style={styles.panelCardText}>Tieng Viet/English trong mobile app se duoc cai dat o day khi co module ngon ngu rieng.</Text>
        </View>
      );
    }

    return null;
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

  if (isEditing) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <ScrollView
          contentContainerStyle={[styles.editorContent, { paddingBottom: Math.max(insets.bottom + 40, 56) }]}
          keyboardShouldPersistTaps="handled"
          style={styles.screen}
        >
          <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.backButton}>
            <Ionicons color="#ff8128" name="chevron-back" size={22} />
            <Text style={styles.backText}>Account</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Personal Profile</Text>
          <Text style={styles.subtitle}>{form.email}</Text>

          <Text style={styles.label}>Ho ten</Text>
          <TextInput onChangeText={(value) => updateField('fullName', value)} style={styles.input} value={form.fullName || ''} />

          <Text style={styles.label}>So dien thoai</Text>
          <TextInput keyboardType="phone-pad" onChangeText={(value) => updateField('phone', value)} style={styles.input} value={form.phone || ''} />

          <Text style={styles.label}>Dia chi</Text>
          <TextInput onChangeText={(value) => updateField('address', value)} style={styles.input} value={form.address || ''} />

          <View style={styles.editorRow}>
            <View style={styles.editorColumn}>
              <Text style={styles.label}>Thanh pho</Text>
              <TextInput onChangeText={(value) => updateField('city', value)} style={styles.input} value={form.city || ''} />
            </View>
            <View style={styles.editorColumn}>
              <Text style={styles.label}>Quan/Huyen</Text>
              <TextInput onChangeText={(value) => updateField('district', value)} style={styles.input} value={form.district || ''} />
            </View>
          </View>

          <Text style={styles.label}>Gioi thieu</Text>
          <TextInput multiline onChangeText={(value) => updateField('bio', value)} style={[styles.input, styles.multiline]} value={form.bio || ''} />

          <TouchableOpacity disabled={isSaving} onPress={handleSave} style={styles.primaryButton}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Luu profile</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 112, 128) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Account</Text>

          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(form.fullName)}</Text>
            </View>
            <View style={styles.identityInfo}>
              <Text numberOfLines={2} style={styles.name}>{form.fullName || 'HouseHelp User'}</Text>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setActivePanel('rewards')} style={styles.memberPill}>
                <Text style={styles.memberText}>Member tier</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {accountRows.map((row) => (
              <AccountRow
                icon={row.icon}
                key={row.label}
                label={row.label}
                onPress={() => handleAccountAction(row.action as AccountAction)}
              />
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Utilities</Text>
            {utilityRows.map((row) => (
              <AccountRow
                icon={row.icon}
                key={row.label}
                label={row.label}
                onPress={() => handleAccountAction(row.action as AccountAction)}
              />
            ))}
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons color="#ef4444" name="log-out-outline" size={20} />
            <Text style={styles.logoutText}>Dang xuat</Text>
          </TouchableOpacity>
        </ScrollView>
        <Modal animationType="slide" onRequestClose={closePanel} transparent visible={activePanel !== null}>
          <View style={styles.modalBackdrop}>
            <TouchableOpacity activeOpacity={1} onPress={closePanel} style={styles.modalScrim} />
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>{panelTitle}</Text>
                <TouchableOpacity onPress={closePanel} style={styles.panelCloseButton}>
                  <Ionicons color="#172033" name="close" size={22} />
                </TouchableOpacity>
              </View>
              {renderPanelContent()}
            </View>
          </View>
        </Modal>
        <CustomerBottomNav />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#eef0f4',
    borderRadius: 39,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  avatarText: {
    color: '#9aa3af',
    fontSize: 24,
    fontWeight: '900',
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 8,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '900',
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 112,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  editorColumn: {
    flex: 1,
  },
  editorContent: {
    padding: 16,
    paddingBottom: 40,
  },
  editorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    marginBottom: 30,
    marginTop: 28,
  },
  identityInfo: {
    flex: 1,
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 15,
    marginBottom: 14,
    padding: 14,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 7,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: '#fee2e2',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 22,
    padding: 14,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
  },
  memberPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff8128',
    borderRadius: 999,
    marginTop: 9,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScrim: {
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
    flex: 1,
  },
  name: {
    color: '#172033',
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 34,
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 28,
  },
  panelCard: {
    backgroundColor: '#fff',
    borderColor: '#eceef2',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  panelCardText: {
    color: '#687386',
    fontSize: 15,
    lineHeight: 22,
  },
  panelCardTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  panelCloseButton: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  panelPrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 14,
    marginTop: 14,
    padding: 14,
  },
  panelPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  panelTitle: {
    color: '#172033',
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#18bf62',
    borderRadius: 14,
    marginTop: 10,
    padding: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  rowButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#edf0f4',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: '#fff1e8',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginRight: 18,
    width: 32,
  },
  rowLabel: {
    color: '#1d2636',
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#fff',
    flex: 1,
  },
  screen: {
    backgroundColor: '#fff',
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 18,
  },
  title: {
    color: '#172033',
    fontSize: 34,
    fontWeight: '900',
  },
});
