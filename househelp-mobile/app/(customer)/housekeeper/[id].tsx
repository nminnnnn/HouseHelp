import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { authService, type AuthUser } from '../../../lib/auth';
import { housekeeperPreferenceService } from '../../../lib/housekeeper-preferences';
import { housekeeperService, type Housekeeper } from '../../../lib/housekeepers';
import { useLanguage } from '../../../lib/language';
import type { AppLanguage } from '../../../lib/storage';

function formatPrice(price?: number | string, language: AppLanguage = 'vi') {
  const value = Number(price);
  if (!Number.isFinite(value)) {
    return language === 'vi' ? 'Liên hệ' : 'Contact';
  }

  return `${value.toLocaleString('vi-VN')} VND`;
}

function formatServices(services?: string, language: AppLanguage) {
  if (!services) {
    return [language === 'vi' ? 'Chưa cập nhật dịch vụ' : 'No services updated'];
  }

  const items = services
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : [language === 'vi' ? 'Chưa cập nhật dịch vụ' : 'No services updated'];
}

function listFromValue(value?: string[] | string) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);

  const raw = String(value).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall back to comma-separated values.
  }

  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function truthy(value?: number | boolean) {
  return value === true || value === 1;
}

function formatExperience(value?: number | string, language: AppLanguage) {
  const years = Number(value);
  if (Number.isFinite(years) && years > 0) {
    return language === 'vi' ? `${years} năm` : `${years} yr`;
  }

  return language === 'vi' ? 'Chưa cập nhật' : 'Not updated';
}

function formatPriceType(value: string | undefined, language: AppLanguage) {
  const labels: Record<string, Record<AppLanguage, string>> = {
    daily: { en: 'day', vi: 'ngày' },
    hourly: { en: 'hour', vi: 'giờ' },
    per_service: { en: 'service', vi: 'dịch vụ' },
  };

  return (labels[value || 'hourly'] || labels.hourly)[language];
}

function avatarSource(path?: string) {
  if (!path || path.length <= 2) return null;
  if (path.startsWith('http')) return { uri: path };

  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api\/?$/, '').replace(/\/$/, '');
  return baseUrl ? { uri: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` } : null;
}

const copy = {
  en: {
    about: 'About',
    available: 'Available',
    back: 'Back',
    block: 'Block',
    blockConfirm: 'Block housekeeper?',
    blockConfirmText: 'This person will no longer appear in your booking list.',
    blocked: 'Blocked',
    blockedBooking: 'This housekeeper is blocked',
    book: 'Book',
    cancel: 'Cancel',
    certifications: 'Verification & certificates',
    contact: 'Contact',
    customer: 'Customer',
    errorTitle: 'Could not load profile',
    favorite: 'Favorite',
    favorited: 'Favorited',
    introFallback: 'This profile has no description yet.',
    login: 'Log in',
    loginLater: 'Later',
    loginRequired: 'Login required',
    loginRequiredText: 'Please log in to use this feature.',
    messageSubtitle: 'Ask about availability, requirements, and service details.',
    messageTitle: 'Message housekeeper',
    noLocation: 'No service area updated',
    noRadius: 'No service radius updated',
    noWorkingDays: 'No working days updated',
    noWorkingHours: 'No working hours updated',
    pendingVerify: 'Pending verification',
    rating: 'Rating',
    rejectBlock: 'Block',
    response: 'Response',
    retry: 'Try again',
    reviews: 'Reviews',
    serviceArea: 'Service area',
    serviceRadius: (radius: number) => `Service radius ${radius} km`,
    services: 'Services',
    skills: 'Skills',
    statsJobs: 'Completed jobs',
    unavailable: 'Unavailable',
    unblock: 'Unblock',
    verified: 'Verified',
    verifiedAccount: 'This account has been verified by admin.',
    backgroundChecked: 'Background checked.',
    insured: 'Work insurance available.',
    workingSchedule: 'Availability',
    experience: 'Experience',
  },
  vi: {
    about: 'Giới thiệu',
    available: 'Nhận việc',
    back: 'Quay lại',
    block: 'Chặn',
    blockConfirm: 'Chặn housekeeper?',
    blockConfirmText: 'Người này sẽ không còn hiện trong danh sách đặt lịch của bạn.',
    blocked: 'Đã chặn',
    blockedBooking: 'Đã chặn housekeeper này',
    book: 'Đặt lịch',
    cancel: 'Hủy',
    certifications: 'Xác minh và chứng chỉ',
    contact: 'Liên hệ',
    customer: 'Khách hàng',
    errorTitle: 'Không tải được hồ sơ',
    favorite: 'Yêu thích',
    favorited: 'Đã yêu thích',
    introFallback: 'Hồ sơ chưa có mô tả.',
    login: 'Đăng nhập',
    loginLater: 'Để sau',
    loginRequired: 'Cần đăng nhập',
    loginRequiredText: 'Vui lòng đăng nhập để dùng tính năng này.',
    messageSubtitle: 'Hỏi lịch trống, trao đổi yêu cầu và thông tin dịch vụ.',
    messageTitle: 'Nhắn tin với housekeeper',
    noLocation: 'Chưa cập nhật khu vực',
    noRadius: 'Chưa cập nhật bán kính nhận việc',
    noWorkingDays: 'Chưa cập nhật ngày làm việc',
    noWorkingHours: 'Chưa cập nhật khung giờ làm việc',
    pendingVerify: 'Chờ xác minh',
    rating: 'Đánh giá',
    rejectBlock: 'Chặn',
    response: 'Phản hồi',
    retry: 'Thử lại',
    reviews: 'Nhận xét',
    serviceArea: 'Khu vực phục vụ',
    serviceRadius: (radius: number) => `Bán kính nhận việc ${radius} km`,
    services: 'Dịch vụ',
    skills: 'Kỹ năng',
    statsJobs: 'Job hoàn thành',
    unavailable: 'Tạm nghỉ',
    unblock: 'Bỏ chặn',
    verified: 'Đã xác minh',
    verifiedAccount: 'Tài khoản đã được admin xác minh.',
    backgroundChecked: 'Đã kiểm tra lý lịch.',
    insured: 'Có bảo hiểm công việc.',
    workingSchedule: 'Lịch rảnh',
    experience: 'Kinh nghiệm',
  },
} as const;

export default function HousekeeperDetailScreen() {
  const [error, setError] = useState<string | null>(null);
  const [housekeeper, setHousekeeper] = useState<Housekeeper | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const text = copy[language];

  const loadDetail = useCallback(async () => {
    if (!id) {
      setError(language === 'vi' ? 'Thiếu mã hồ sơ housekeeper.' : 'Missing housekeeper profile id.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [storedUser, data] = await Promise.all([
        authService.checkAuthStatus(),
        housekeeperService.getById(id),
      ]);
      setUser(storedUser);
      setHousekeeper(data);

      if (storedUser) {
        const [favorite, blocked] = await Promise.all([
          housekeeperPreferenceService.isFavorite(storedUser.id, data.id),
          housekeeperPreferenceService.isBlocked(storedUser.id, data.id),
        ]);
        setIsFavorite(favorite);
        setIsBlocked(blocked);
      }
    } catch (detailError: any) {
      setError(detailError.response?.data?.message || detailError.response?.data?.error || text.errorTitle);
    } finally {
      setIsLoading(false);
    }
  }, [id, language, text.errorTitle]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !housekeeper) {
    return (
      <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>{text.errorTitle}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadDetail} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{text.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{text.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const services = formatServices(housekeeper.services, language);
  const skills = listFromValue(housekeeper.skills);
  const certifications = listFromValue(housekeeper.certifications);
  const workingDays = listFromValue(housekeeper.workingDays);
  const completedJobs = Number(housekeeper.completedJobs || 0);
  const profileImage = avatarSource(housekeeper.avatar) || avatarSource(listFromValue(housekeeper.profileImages)[0]);
  const isVerified = truthy(housekeeper.isVerified) && truthy(housekeeper.isApproved);
  const isBackgroundChecked = truthy(housekeeper.backgroundChecked);
  const isInsured = truthy(housekeeper.insured) || truthy(housekeeper.hasInsurance);
  const priceType = formatPriceType(housekeeper.priceType, language);
  const serviceRadius = Number(housekeeper.serviceRadius || 0);

  const requireUser = () => {
    if (user) {
      return true;
    }

    Alert.alert(text.loginRequired, text.loginRequiredText, [
      { text: text.login, onPress: () => router.push('/(auth)/login') },
      { text: text.loginLater, style: 'cancel' },
    ]);
    return false;
  };

  const toggleFavorite = async () => {
    if (!requireUser()) return;
    const nextFavorite = await housekeeperPreferenceService.toggleFavorite(user!.id, housekeeper.id);
    setIsFavorite(nextFavorite);
    if (nextFavorite) {
      setIsBlocked(false);
    }
  };

  const toggleBlock = async () => {
    if (!requireUser()) return;

    if (isBlocked) {
      await housekeeperPreferenceService.unblock(user!.id, housekeeper.id);
      setIsBlocked(false);
      return;
    }

    Alert.alert(text.blockConfirm, text.blockConfirmText, [
      { text: text.cancel, style: 'cancel' },
      {
        text: text.rejectBlock,
        style: 'destructive',
        onPress: async () => {
          await housekeeperPreferenceService.block(user!.id, housekeeper.id);
          setIsBlocked(true);
          setIsFavorite(false);
        },
      },
    ]);
  };

  const openChat = () => {
    if (!housekeeper.userId) {
      return;
    }

    router.push({
      pathname: '/chat/[bookingId]',
      params: {
        bookingId: 'direct',
        receiverId: String(housekeeper.userId),
        receiverName: housekeeper.fullName || 'Housekeeper',
      },
    });
  };

  return (
    <SafeAreaView edges={[]} style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 44) }]}
        style={styles.screen}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{text.back}</Text>
        </TouchableOpacity>

        <View style={styles.profileHeader}>
          {profileImage ? (
            <Image source={profileImage} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {housekeeper.initials || housekeeper.fullName?.slice(0, 1) || 'H'}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{housekeeper.fullName}</Text>
          <Text style={styles.location}>{housekeeper.location || text.noLocation}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.verifyBadge, isVerified ? styles.verifiedBadge : styles.pendingBadge]}>
              <Ionicons color={isVerified ? '#15803d' : '#92400e'} name={isVerified ? 'checkmark-circle' : 'time-outline'} size={16} />
              <Text style={[styles.verifyText, isVerified ? styles.verifiedText : styles.pendingText]}>
                {isVerified ? text.verified : text.pendingVerify}
              </Text>
            </View>
            {isBackgroundChecked ? (
              <View style={styles.verifyBadge}>
                <Ionicons color="#15803d" name="shield-checkmark-outline" size={16} />
                <Text style={styles.verifiedText}>{text.backgroundChecked}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.status, housekeeper.available ? styles.available : styles.unavailable]}>
            {isBlocked ? text.blocked : housekeeper.available ? text.available : text.unavailable}
          </Text>
          <View style={styles.preferenceRow}>
            <TouchableOpacity activeOpacity={0.85} onPress={toggleFavorite} style={styles.preferenceButton}>
              <Ionicons color="#ff8128" name={isFavorite ? 'heart' : 'heart-outline'} size={20} />
              <Text style={styles.preferenceText}>{isFavorite ? text.favorited : text.favorite}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={toggleBlock} style={[styles.preferenceButton, isBlocked && styles.blockedButton]}>
              <Ionicons color={isBlocked ? '#fff' : '#ef4444'} name={isBlocked ? 'ban' : 'ban-outline'} size={20} />
              <Text style={[styles.preferenceText, isBlocked && styles.blockedButtonText]}>{isBlocked ? text.unblock : text.block}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{housekeeper.rating ?? housekeeper.avgRating ?? '0.0'}</Text>
            <Text style={styles.statLabel}>{text.rating}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedJobs}</Text>
            <Text style={styles.statLabel}>{text.statsJobs}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatPrice(housekeeper.price, language)}</Text>
            <Text style={styles.statLabel}>VND/{priceType}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{housekeeper.reviewCount ?? housekeeper.totalReviews ?? 0}</Text>
            <Text style={styles.statLabel}>{text.reviews}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatExperience(housekeeper.experience, language)}</Text>
            <Text style={styles.statLabel}>{text.experience}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{housekeeper.responseTime ? `${housekeeper.responseTime}p` : '--'}</Text>
            <Text style={styles.statLabel}>{text.response}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{text.about}</Text>
          <Text style={styles.bodyText}>
            {housekeeper.bio || housekeeper.description || housekeeper.experience || text.introFallback}
          </Text>
        </View>

        {skills.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{text.skills}</Text>
            <View style={styles.chips}>
              {skills.map((skill) => (
                <Text key={skill} style={styles.neutralChip}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {certifications.length || isInsured ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{text.certifications}</Text>
            <View style={styles.infoList}>
              {isVerified ? <Text style={styles.infoLine}>{text.verifiedAccount}</Text> : null}
              {isBackgroundChecked ? <Text style={styles.infoLine}>{text.backgroundChecked}</Text> : null}
              {isInsured ? <Text style={styles.infoLine}>{text.insured}</Text> : null}
              {certifications.map((item) => (
                <Text key={item} style={styles.infoLine}>{item}</Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{text.services}</Text>
          <View style={styles.chips}>
            {services.map((service) => (
              <Text key={service} style={styles.chip}>
                {service}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{text.workingSchedule}</Text>
          <Text style={styles.bodyText}>
            {workingDays.length ? workingDays.join(', ') : text.noWorkingDays}
          </Text>
          <Text style={styles.sectionSubText}>
            {housekeeper.workingHours || housekeeper.availability || text.noWorkingHours}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{text.serviceArea}</Text>
          <Text style={styles.bodyText}>{housekeeper.location || text.noLocation}</Text>
          <Text style={styles.sectionSubText}>
            {serviceRadius > 0 ? text.serviceRadius(serviceRadius) : text.noRadius}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{text.contact}</Text>
          <TouchableOpacity disabled={!housekeeper.userId} onPress={openChat} style={styles.chatButton}>
            <Ionicons color="#ff8128" name="chatbubble-ellipses-outline" size={22} />
            <View style={styles.chatCopy}>
              <Text style={styles.chatTitle}>{text.messageTitle}</Text>
              <Text style={styles.chatSubtitle}>{text.messageSubtitle}</Text>
            </View>
            <Ionicons color="#ff8128" name="chevron-forward" size={20} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          disabled={isBlocked}
          onPress={() => router.push(`/(customer)/booking/${housekeeper.id}`)}
          style={[styles.primaryButton, isBlocked && styles.disabledButton]}
        >
          <Text style={styles.primaryText}>{isBlocked ? text.blockedBooking : text.book}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  available: {
    backgroundColor: '#fff1e8',
    color: '#ff8128',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  avatarImage: {
    backgroundColor: '#fff1e8',
    borderRadius: 44,
    height: 88,
    width: 88,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  chip: {
    backgroundColor: '#fff1e8',
    borderRadius: 999,
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  chatCopy: {
    flex: 1,
  },
  chatSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  chatTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  divider: {
    backgroundColor: '#e5e7eb',
    width: 1,
  },
  blockedButton: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  blockedButtonText: {
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  errorText: {
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  location: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  name: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  neutralChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    color: '#374151',
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoLine: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  infoList: {
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  pendingText: {
    color: '#92400e',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#ff8128',
    borderRadius: 8,
    marginTop: 18,
    padding: 15,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  preferenceButton: {
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  preferenceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  preferenceText: {
    color: '#ff8128',
    fontSize: 13,
    fontWeight: '900',
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  screen: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  safeArea: {
    backgroundColor: '#f7f8fa',
    flex: 1,
  },
  secondaryButton: {
    marginTop: 16,
    padding: 8,
  },
  secondaryText: {
    color: '#ff8128',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionSubText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  stats: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    padding: 16,
  },
  statValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  status: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unavailable: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
  verifiedBadge: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  verifiedText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '900',
  },
  verifyBadge: {
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verifyText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
