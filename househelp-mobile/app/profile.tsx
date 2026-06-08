import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerBottomNav } from '../components/customer-bottom-nav';
import { authService, type AuthUser } from '../lib/auth';
import { useLanguage } from '../lib/language';
import { profileService, type UserProfile } from '../lib/profile';
import { storage, type AppLanguage } from '../lib/storage';
import { verificationService, type VerificationStatus } from '../lib/verification';

const accountRows = [
  { action: 'edit', icon: 'person', label: { en: 'Personal Profile', vi: 'H\u1ed3 s\u01a1 c\u00e1 nh\u00e2n' } },
  { action: 'addresses', icon: 'location', label: { en: 'Saved Addresses', vi: '\u0110\u1ecba ch\u1ec9 \u0111\u00e3 l\u01b0u' } },
  { action: 'transactions', icon: 'time', label: { en: 'Transaction History', vi: 'L\u1ecbch s\u1eed giao d\u1ecbch' } },
  { action: 'rewards', icon: 'gift', label: { en: 'My Rewards', vi: '\u01afu \u0111\u00e3i c\u1ee7a t\u00f4i' } },
  { action: 'favorites', icon: 'heart', label: { en: 'Favorite Housekeepers', vi: 'Ng\u01b0\u1eddi gi\u00fap vi\u1ec7c y\u00eau th\u00edch' } },
  { action: 'blockList', icon: 'ban', label: { en: 'Block List', vi: 'Danh s\u00e1ch ch\u1eb7n' } },
  { action: 'business', icon: 'business', label: { en: 'Create a Business Account', vi: 'T\u1ea1o t\u00e0i kho\u1ea3n ng\u01b0\u1eddi gi\u00fap vi\u1ec7c' } },
];

const utilityRows = [
  { action: 'pay', icon: 'wallet', label: { en: 'HouseHelp Pay', vi: 'Thanh to\u00e1n HouseHelp' } },
  { action: 'language', icon: 'globe', label: { en: 'Language', vi: 'Ng\u00f4n ng\u1eef' } },
  { action: 'help', icon: 'help-circle', label: { en: 'Help Center', vi: 'Trung t\u00e2m tr\u1ee3 gi\u00fap' } },
];

const copy = {
  en: {
    account: 'Account',
    chooseAddress: 'Choose address on map',
    chooseAddressTitle: 'Choose address',
    chooseAddressSubtitle: 'Search for an address or tap the map to drop a pin.',
    close: 'Close',
    currentLanguage: 'Current language',
    dashboard: 'Dashboard',
    doneAddress: 'Use this address',
    editProfile: 'Personal Profile',
    enterAddress: 'Enter address',
    enterAddressText: 'Please enter the address to search.',
    fullName: 'Full name',
    language: 'Language',
    languageHint: 'Choose the display language for the mobile app.',
    loadProfileError: 'Could not load profile',
    loadRetry: 'Please try again later.',
    locationError: 'Could not get location',
    locationErrorText: 'You can search for an address or tap directly on the map.',
    logout: 'Log out',
    memberTier: 'Member tier',
    notFound: 'Not found',
    notFoundText: 'Please enter a more specific address.',
    permissionNeeded: 'Location permission needed',
    permissionNeededText: 'Please allow location access to use this feature.',
    phone: 'Phone number',
    profileSaved: 'Profile has been updated.',
    profileSaveTitle: 'Saved',
    rewardsEmpty: 'Reward points will appear after completed bookings or promotions.',
    saveError: 'Could not save',
    saveProfile: 'Save profile',
    searchFailed: 'Could not find address',
    searchFailedText: 'Please try again or tap directly on the map.',
    selectLanguage: 'Select language',
    selectedLocationPrefix: 'Selected location',
    useCurrentLocation: 'Use current location',
  },
  vi: {
    account: 'T\u00e0i kho\u1ea3n',
    chooseAddress: 'Ch\u1ecdn \u0111\u1ecba ch\u1ec9 tr\u00ean b\u1ea3n \u0111\u1ed3',
    chooseAddressTitle: 'Ch\u1ecdn \u0111\u1ecba ch\u1ec9',
    chooseAddressSubtitle: 'T\u00ecm \u0111\u1ecba ch\u1ec9 ho\u1eb7c ch\u1ea1m tr\u00ean b\u1ea3n \u0111\u1ed3 \u0111\u1ec3 \u0111\u1eb7t ghim.',
    close: '\u0110\u00f3ng',
    currentLanguage: 'Ng\u00f4n ng\u1eef hi\u1ec7n t\u1ea1i',
    dashboard: 'Dashboard',
    doneAddress: 'D\u00f9ng \u0111\u1ecba ch\u1ec9 n\u00e0y',
    editProfile: 'H\u1ed3 s\u01a1 c\u00e1 nh\u00e2n',
    enterAddress: 'Nh\u1eadp \u0111\u1ecba ch\u1ec9',
    enterAddressText: 'Vui l\u00f2ng nh\u1eadp \u0111\u1ecba ch\u1ec9 c\u1ea7n t\u00ecm.',
    fullName: 'H\u1ecd t\u00ean',
    language: 'Ng\u00f4n ng\u1eef',
    languageHint: 'Ch\u1ecdn ng\u00f4n ng\u1eef hi\u1ec3n th\u1ecb cho \u1ee9ng d\u1ee5ng mobile.',
    loadProfileError: 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c h\u1ed3 s\u01a1',
    loadRetry: 'Th\u1eed l\u1ea1i sau.',
    locationError: 'Kh\u00f4ng l\u1ea5y \u0111\u01b0\u1ee3c v\u1ecb tr\u00ed',
    locationErrorText: 'B\u1ea1n c\u00f3 th\u1ec3 t\u00ecm \u0111\u1ecba ch\u1ec9 ho\u1eb7c ch\u1ea1m tr\u1ef1c ti\u1ebfp tr\u00ean b\u1ea3n \u0111\u1ed3.',
    logout: '\u0110\u0103ng xu\u1ea5t',
    memberTier: 'H\u1ea1ng th\u00e0nh vi\u00ean',
    notFound: 'Kh\u00f4ng t\u00ecm th\u1ea5y',
    notFoundText: 'Vui l\u00f2ng nh\u1eadp \u0111\u1ecba ch\u1ec9 c\u1ee5 th\u1ec3 h\u01a1n.',
    permissionNeeded: 'C\u1ea7n quy\u1ec1n v\u1ecb tr\u00ed',
    permissionNeededText: 'Vui l\u00f2ng cho ph\u00e9p truy c\u1eadp v\u1ecb tr\u00ed \u0111\u1ec3 d\u00f9ng ch\u1ee9c n\u0103ng n\u00e0y.',
    phone: 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i',
    profileSaved: 'H\u1ed3 s\u01a1 \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt.',
    profileSaveTitle: '\u0110\u00e3 l\u01b0u',
    rewardsEmpty: '\u0110i\u1ec3m th\u01b0\u1edfng s\u1ebd xu\u1ea5t hi\u1ec7n sau khi b\u1ea1n ho\u00e0n th\u00e0nh booking ho\u1eb7c nh\u1eadn \u01b0u \u0111\u00e3i.',
    saveError: 'Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c',
    saveProfile: 'L\u01b0u h\u1ed3 s\u01a1',
    searchFailed: 'Kh\u00f4ng t\u00ecm \u0111\u01b0\u1ee3c \u0111\u1ecba ch\u1ec9',
    searchFailedText: 'Vui l\u00f2ng th\u1eed l\u1ea1i ho\u1eb7c ch\u1ea1m tr\u1ef1c ti\u1ebfp tr\u00ean b\u1ea3n \u0111\u1ed3.',
    selectLanguage: 'Ch\u1ecdn ng\u00f4n ng\u1eef',
    selectedLocationPrefix: 'V\u1ecb tr\u00ed \u0111\u00e3 ch\u1ecdn',
    useCurrentLocation: 'D\u00f9ng v\u1ecb tr\u00ed hi\u1ec7n t\u1ea1i',
  },
} as const;

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

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function normalizeDateOfBirth(value?: string) {
  if (!value) return undefined;
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export default function ProfileScreen() {
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [mapQuery, setMapQuery] = useState('');
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 16.4637,
    longitude: 107.5909,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  });
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; latitude: number; longitude: number } | null>(null);
  const [activePanel, setActivePanel] = useState<PanelAction | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const { refresh, returnTo } = useLocalSearchParams<{ refresh?: string; returnTo?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isHousekeeperAccount = currentUser?.role === 'housekeeper' || returnTo === 'housekeeper';
  const isIdentityVerified = Boolean(verificationStatus?.isVerified && verificationStatus?.isApproved);
  const text = copy[language];

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const user = await authService.checkAuthStatus();

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      setCurrentUser(user);
      setUserId(user.id);
      const profile = await profileService.getProfile(user.id);
      setForm({ ...user, ...profile });

      if (user.role === 'housekeeper' || returnTo === 'housekeeper') {
        const nextVerificationStatus = await verificationService.getStatus(user.id);
        setVerificationStatus(nextVerificationStatus);
      } else {
        setVerificationStatus(null);
      }
    } catch (error: any) {
      Alert.alert(text.loadProfileError, error.response?.data?.message || error.response?.data?.error || text.loadRetry);
    } finally {
      setIsLoading(false);
    }
  }, [returnTo, router, text.loadProfileError, text.loadRetry]);

  const goBackToRoleHome = () => {
    router.replace(isHousekeeperAccount ? '/(housekeeper)' : '/(customer)');
  };

  useEffect(() => {
    loadProfile();
  }, [loadProfile, refresh]);

  const updateField = (key: keyof UserProfile, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place: any = results[0];
      const parts = [place?.name, place?.street, place?.district, place?.city, place?.region].filter(Boolean);

      return parts.length ? parts.join(', ') : `${text.selectedLocationPrefix} ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    } catch {
      return `${text.selectedLocationPrefix} ${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
    }
  }, [text.selectedLocationPrefix]);

  const chooseCoordinate = useCallback(async (latitude: number, longitude: number, addressOverride?: string) => {
    setMapRegion((current) => ({ ...current, latitude, longitude }));
    const address = addressOverride || await reverseGeocode(latitude, longitude);
    setSelectedLocation({ address, latitude, longitude });
    updateField('address', address);
  }, [reverseGeocode]);

  const openMapPicker = useCallback(async () => {
    setIsMapVisible(true);

    try {
      setIsMapLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({});
        await chooseCoordinate(current.coords.latitude, current.coords.longitude);
      }
    } catch {
      Alert.alert(text.locationError, text.locationErrorText);
    } finally {
      setIsMapLoading(false);
    }
  }, [chooseCoordinate, text.locationError, text.locationErrorText]);

  const centerOnDeviceLocation = useCallback(async () => {
    try {
      setIsMapLoading(true);
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(text.permissionNeeded, text.permissionNeededText);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      await chooseCoordinate(current.coords.latitude, current.coords.longitude);
    } finally {
      setIsMapLoading(false);
    }
  }, [chooseCoordinate, text.permissionNeeded, text.permissionNeededText]);

  const searchAddressOnMap = async () => {
    const query = mapQuery.trim();

    if (!query) {
      Alert.alert(text.enterAddress, text.enterAddressText);
      return;
    }

    try {
      setIsMapLoading(true);
      const results = await Location.geocodeAsync(query);

      if (!results.length) {
        Alert.alert(text.notFound, text.notFoundText);
        return;
      }

      await chooseCoordinate(results[0].latitude, results[0].longitude, query);
    } catch {
      Alert.alert(text.searchFailed, text.searchFailedText);
    } finally {
      setIsMapLoading(false);
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    chooseCoordinate(latitude, longitude);
  };

  const confirmSelectedAddress = () => {
    if (selectedLocation?.address) {
      updateField('address', selectedLocation.address);
      setMapQuery('');
    }

    setIsMapVisible(false);
  };

  const handleSave = async () => {
    if (!userId) return;

    try {
      setIsSaving(true);
      const nextAddress = (selectedLocation?.address || form.address || '').trim();
      const payload: Partial<UserProfile> = {
        address: nextAddress,
        bio: form.bio || '',
        city: '',
        district: '',
        emergencyContact: form.emergencyContact || '',
        emergencyContactName: form.emergencyContactName || '',
        fullName: form.fullName || '',
        languages: form.languages || '',
        phone: form.phone || '',
      };

      if (form.avatar) payload.avatar = form.avatar;
      const normalizedDateOfBirth = normalizeDateOfBirth(form.dateOfBirth);
      if (normalizedDateOfBirth) payload.dateOfBirth = normalizedDateOfBirth;
      if (form.gender) payload.gender = form.gender;
      if (form.idCardBack) payload.idCardBack = form.idCardBack;
      if (form.idCardFront) payload.idCardFront = form.idCardFront;

      const updated = await profileService.updateProfile(userId, payload);
      const nextForm = { ...form, ...updated, address: updated.address || nextAddress };
      const nextAuthUser = currentUser
        ? { ...currentUser, ...updated, address: nextForm.address, role: currentUser.role, email: currentUser.email, id: currentUser.id }
        : nextForm;

      setForm(nextForm);
      setCurrentUser(nextAuthUser as AuthUser);
      await storage.saveUser(nextAuthUser);
      setSelectedLocation(null);
      setIsEditing(false);
      Alert.alert(text.profileSaveTitle, text.profileSaved);
    } catch (error: any) {
      Alert.alert(text.saveError, error.response?.data?.message || error.response?.data?.error || text.loadRetry);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageSelect = async (nextLanguage: AppLanguage) => {
    await setLanguage(nextLanguage);
    setActivePanel(null);
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
    language: text.language,
    pay: 'HouseHelp Pay',
    rewards: language === 'vi' ? 'Ưu đãi của tôi' : 'My Rewards',
  }[activePanel || 'rewards'];

  const renderPanelContent = () => {
    if (activePanel === 'rewards') {
      return (
        <>
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>0 points</Text>
            <Text style={styles.panelCardText}>{text.rewardsEmpty}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)')} style={styles.panelPrimaryButton}>
            <Text style={styles.panelPrimaryText}>{language === 'vi' ? 'Đặt dịch vụ' : 'Book a service'}</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activePanel === 'pay') {
      return (
        <>
          <View style={styles.panelCard}>
            <Text style={styles.panelCardTitle}>{language === 'vi' ? 'Thanh toán tiền mặt đang bật' : 'Cash payment is enabled'}</Text>
            <Text style={styles.panelCardText}>{language === 'vi' ? 'HouseHelp Pay sẽ theo dõi các thanh toán đã xác nhận trong Activity.' : 'HouseHelp Pay tracks confirmed payments in Activity.'}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(customer)/bookings')} style={styles.panelPrimaryButton}>
            <Text style={styles.panelPrimaryText}>{language === 'vi' ? 'Xem thanh toán' : 'View payments'}</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (activePanel === 'language') {
      return (
        <View>
          <Text style={styles.languageHint}>{text.languageHint}</Text>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => handleLanguageSelect('vi')}
            style={[styles.languageOption, language === 'vi' && styles.languageOptionActive]}
          >
            <View>
              <Text style={[styles.languageOptionTitle, language === 'vi' && styles.languageOptionTitleActive]}>Tiếng Việt</Text>
              <Text style={styles.languageOptionSubtitle}>Vietnamese</Text>
            </View>
            {language === 'vi' ? <Ionicons color="#ff8128" name="checkmark-circle" size={24} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() => handleLanguageSelect('en')}
            style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
          >
            <View>
              <Text style={[styles.languageOptionTitle, language === 'en' && styles.languageOptionTitleActive]}>English</Text>
              <Text style={styles.languageOptionSubtitle}>Tiếng Anh</Text>
            </View>
            {language === 'en' ? <Ionicons color="#ff8128" name="checkmark-circle" size={24} /> : null}
          </TouchableOpacity>
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
            <Text style={styles.backText}>{text.account}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{text.editProfile}</Text>
          <Text style={styles.subtitle}>{form.email}</Text>

          {isHousekeeperAccount ? (
            <View style={[styles.verificationBox, isIdentityVerified && styles.verificationBoxApproved]}>
              <View style={styles.verificationTextWrap}>
                <Text style={styles.verificationTitle}>
                  {isIdentityVerified
                    ? (language === 'vi' ? 'Đã xác thực danh tính' : 'Identity verified')
                    : (language === 'vi' ? 'Chưa xác thực danh tính' : 'Identity not verified')}
                </Text>
                <Text style={styles.verificationText}>
                  {isIdentityVerified
                    ? (language === 'vi' ? 'Hồ sơ của bạn đã được admin duyệt.' : 'Your profile has been approved by admin.')
                    : (language === 'vi' ? 'Cung cấp CCCD hai mặt và ảnh selfie để admin xét duyệt.' : 'Provide both ID card sides and a selfie for admin review.')}
                </Text>
              </View>
              {!isIdentityVerified ? (
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => router.push('/(housekeeper)/verification')}
                  style={styles.verifyButton}
                >
                  <Ionicons color="#fff" name="shield-checkmark-outline" size={18} />
                  <Text style={styles.verifyButtonText}>{language === 'vi' ? 'Xác thực danh tính' : 'Verify identity'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.label}>{text.fullName}</Text>
          <TextInput onChangeText={(value) => updateField('fullName', value)} style={styles.input} value={form.fullName || ''} />

          <Text style={styles.label}>{text.phone}</Text>
          <TextInput keyboardType="phone-pad" onChangeText={(value) => updateField('phone', value)} style={styles.input} value={form.phone || ''} />

          <Text style={styles.label}>{language === 'vi' ? 'Địa chỉ' : 'Address'}</Text>
          <TextInput
            onChangeText={(value) => {
              setSelectedLocation(null);
              updateField('address', value);
            }}
            style={styles.input}
            value={form.address || ''}
          />
          <TouchableOpacity activeOpacity={0.86} onPress={openMapPicker} style={styles.mapButton}>
            <Ionicons color="#ff8128" name="map-outline" size={18} />
            <Text style={styles.mapButtonText}>{text.chooseAddress}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>{language === 'vi' ? 'Giới thiệu' : 'Bio'}</Text>
          <TextInput multiline onChangeText={(value) => updateField('bio', value)} style={[styles.input, styles.multiline]} value={form.bio || ''} />

          <TouchableOpacity disabled={isSaving} onPress={handleSave} style={styles.primaryButton}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{text.saveProfile}</Text>}
          </TouchableOpacity>

          <Modal animationType="slide" onRequestClose={() => setIsMapVisible(false)} visible={isMapVisible}>
            <View style={[styles.mapScreen, { paddingTop: Math.max(insets.top, 12) }]}>
              <View style={styles.mapHeader}>
                <TouchableOpacity onPress={() => setIsMapVisible(false)} style={styles.mapHeaderButton}>
                  <Text style={styles.mapHeaderButtonText}>{text.close}</Text>
                </TouchableOpacity>
                <View style={styles.mapHeaderTextWrap}>
                  <Text style={styles.mapTitle}>{text.chooseAddressTitle}</Text>
                  <Text style={styles.mapSubtitle}>{text.chooseAddressSubtitle}</Text>
                </View>
              </View>

              <View style={styles.mapSearchBox}>
                <TextInput
                  onChangeText={setMapQuery}
                  onSubmitEditing={searchAddressOnMap}
                  placeholder={language === 'vi' ? 'Nhập địa chỉ để tìm...' : 'Search for an address...'}
                  returnKeyType="search"
                  style={styles.mapSearchInput}
                  value={mapQuery}
                />
                <TouchableOpacity activeOpacity={0.84} onPress={searchAddressOnMap} style={styles.mapSearchButton}>
                  <Text style={styles.mapSearchButtonText}>{language === 'vi' ? 'Tìm' : 'Search'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.84} onPress={centerOnDeviceLocation} style={styles.mapLocationButton}>
                <Text style={styles.mapLocationButtonText}>{text.useCurrentLocation}</Text>
              </TouchableOpacity>

              <MapView
                initialRegion={mapRegion}
                onPress={handleMapPress}
                onRegionChangeComplete={setMapRegion}
                region={mapRegion}
                style={styles.map}
              >
                {selectedLocation ? (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                    }}
                    draggable
                    onDragEnd={(event) => {
                      const { latitude, longitude } = event.nativeEvent.coordinate;
                      chooseCoordinate(latitude, longitude);
                    }}
                    title={language === 'vi' ? 'Địa chỉ hồ sơ' : 'Profile address'}
                  />
                ) : null}
              </MapView>

              <View style={[styles.mapFooter, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
                {isMapLoading ? <ActivityIndicator color="#ff8128" /> : null}
                {selectedLocation ? (
                  <TextInput
                    multiline
                    onChangeText={(value) => {
                      setSelectedLocation((current) => current ? { ...current, address: value } : current);
                      updateField('address', value);
                    }}
                    placeholder={language === 'vi' ? 'Bổ sung số nhà, tầng, tòa nhà...' : 'Add house number, floor, building...'}
                    style={styles.mapAddressInput}
                    value={selectedLocation.address || form.address || ''}
                  />
                ) : null}
                <Text numberOfLines={2} style={styles.mapAddress}>
                  {selectedLocation ? selectedLocation.address : (language === 'vi' ? 'Hãy tìm địa chỉ hoặc chạm vào vị trí trên bản đồ.' : 'Search for an address or tap a position on the map.')}
                </Text>
                <TouchableOpacity
                  disabled={!selectedLocation}
                  onPress={confirmSelectedAddress}
                  style={[styles.confirmMapButton, !selectedLocation && styles.confirmMapButtonDisabled]}
                >
                  <Text style={styles.confirmMapText}>{text.doneAddress}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
          {isHousekeeperAccount ? (
            <TouchableOpacity onPress={goBackToRoleHome} style={styles.backButton}>
              <Ionicons color="#15803d" name="chevron-back" size={22} />
              <Text style={[styles.backText, styles.housekeeperBackText]}>{text.dashboard}</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.title}>{text.account}</Text>

          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(form.fullName)}</Text>
            </View>
            <View style={styles.identityInfo}>
              <Text numberOfLines={2} style={styles.name}>{form.fullName || 'HouseHelp User'}</Text>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setActivePanel('rewards')} style={styles.memberPill}>
                <Text style={styles.memberText}>{text.memberTier}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{text.account}</Text>
            {accountRows.map((row) => (
              <AccountRow
                icon={row.icon}
                key={row.action}
                label={row.label[language]}
                onPress={() => handleAccountAction(row.action as AccountAction)}
              />
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{language === 'vi' ? 'Tiện ích' : 'Utilities'}</Text>
            {utilityRows.map((row) => (
              <AccountRow
                icon={row.icon}
                key={row.action}
                label={row.label[language]}
                onPress={() => handleAccountAction(row.action as AccountAction)}
              />
            ))}
          </View>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons color="#ef4444" name="log-out-outline" size={20} />
            <Text style={styles.logoutText}>{text.logout}</Text>
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
        {isHousekeeperAccount ? null : <CustomerBottomNav />}
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
  housekeeperBackText: {
    color: '#15803d',
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
  confirmMapButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmMapButtonDisabled: {
    backgroundColor: '#f3c09d',
  },
  confirmMapText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 7,
  },
  languageHint: {
    color: '#687386',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 14,
  },
  languageOption: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#eceef2',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 14,
  },
  languageOptionActive: {
    backgroundColor: '#fff1e8',
    borderColor: '#ff8128',
  },
  languageOptionSubtitle: {
    color: '#687386',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  languageOptionTitle: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
  languageOptionTitleActive: {
    color: '#ff8128',
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
    fontSize: 16,
    fontWeight: '900',
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  map: {
    flex: 1,
  },
  mapAddress: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  mapAddressInput: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    fontSize: 14,
    minHeight: 66,
    padding: 12,
    textAlignVertical: 'top',
  },
  mapButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff1e8',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: -4,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  mapButtonText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  mapFooter: {
    backgroundColor: '#fff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    gap: 12,
    padding: 16,
    paddingBottom: 24,
  },
  mapHeader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapHeaderButton: {
    borderColor: '#fed7aa',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  mapHeaderButtonText: {
    color: '#ff8128',
    fontSize: 14,
    fontWeight: '900',
  },
  mapHeaderTextWrap: {
    flex: 1,
  },
  mapLocationButton: {
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  mapLocationButtonText: {
    color: '#c2410c',
    fontSize: 14,
    fontWeight: '900',
  },
  mapScreen: {
    backgroundColor: '#fff',
    flex: 1,
  },
  mapSearchBox: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mapSearchButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mapSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  mapSearchInput: {
    backgroundColor: '#f7f8fa',
    borderColor: '#d8dde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#111827',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  mapSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  mapTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
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
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 29,
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
  verificationBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 18,
    padding: 14,
  },
  verificationBoxApproved: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  verificationText: {
    color: '#687386',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  verificationTextWrap: {
    gap: 4,
  },
  verificationTitle: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '900',
  },
  verifyButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ff8128',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
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
    fontSize: 17,
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
    fontSize: 22,
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
    fontSize: 28,
    fontWeight: '900',
  },
});
