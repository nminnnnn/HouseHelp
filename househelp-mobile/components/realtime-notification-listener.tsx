import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { authService, type AuthUser } from '../lib/auth';
import { notificationService } from '../lib/notifications';
import { disconnectSocket, getSocket } from '../lib/socket';

type RealtimeNotification = {
  id?: number | string;
  type?: string;
  title?: string;
  message?: string;
  bookingId?: number | string | null;
  booking?: {
    id?: number | string;
    customerName?: string;
    housekeeperName?: string;
    service?: string;
  };
  data?: unknown;
};

export function RealtimeNotificationListener() {
  const router = useRouter();
  const currentUserRef = useRef<AuthUser | null>(null);
  const displayedNotificationIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const socket = getSocket();
    let isActive = true;

    const joinCurrentUser = () => {
      const user = currentUserRef.current;
      if (!user) return;
      socket.emit('join', {
        role: user.role,
        userId: user.id,
        userName: user.fullName || user.email,
      });
    };

    const syncAuthenticatedUser = async () => {
      const user = await authService.checkAuthStatus();
      if (!isActive) return;

      const previousUserId = currentUserRef.current?.id;
      currentUserRef.current = user;

      if (!user) {
        if (socket.connected) disconnectSocket();
        return;
      }

      if (!socket.connected) socket.connect();
      if (previousUserId !== user.id) {
        if (socket.connected) joinCurrentUser();

        const savedNotifications = await notificationService.getForUser(user.id).catch(() => []);
        if (!isActive) return;
        const relevantNotification = savedNotifications.find((item) => (
          item.read !== true
          && item.read_status !== 1
          && ((user.role === 'housekeeper' && item.type === 'new_booking')
            || (user.role === 'customer' && item.type === 'booking_confirmed'))
        ));
        if (relevantNotification) {
          const booking = relevantNotification.data && typeof relevantNotification.data === 'object'
            ? relevantNotification.data as RealtimeNotification['booking']
            : undefined;
          handleNotification({ ...relevantNotification, booking });
        }
      }
    };

    const handleNotification = (notification: RealtimeNotification) => {
      const user = currentUserRef.current;
      if (!user) return;

      const notificationKey = String(notification.id || `${notification.type}-${notification.bookingId || Date.now()}`);
      if (displayedNotificationIdsRef.current.has(notificationKey)) return;

      const isNewBooking = user.role === 'housekeeper' && notification.type === 'new_booking';
      const isAcceptedBooking = user.role === 'customer' && notification.type === 'booking_confirmed';
      if (!isNewBooking && !isAcceptedBooking) return;

      displayedNotificationIdsRef.current.add(notificationKey);
      if (typeof notification.id === 'number') {
        notificationService.markRead(notification.id).catch(() => undefined);
      }
      const bookingId = notification.bookingId || notification.booking?.id;

      if (isNewBooking) {
        const customerName = notification.booking?.customerName || 'Khách hàng';
        const service = notification.booking?.service || 'dịch vụ gia đình';
        Alert.alert('Đơn hàng mới', `${customerName} vừa đặt ${service}.`, [
          { text: 'Để sau', style: 'cancel' },
          {
            text: 'Xem đơn',
            onPress: () => {
              if (bookingId) router.push(`/(housekeeper)/job/${bookingId}`);
            },
          },
        ]);
        return;
      }

      const housekeeperName = notification.booking?.housekeeperName || 'Housekeeper';
      Alert.alert('Housekeeper đã nhận đơn', `${housekeeperName} đã xác nhận booking của bạn.`, [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Xem booking',
          onPress: () => router.push(`/(customer)/bookings?refresh=${Date.now()}`),
        },
      ]);
    };

    socket.on('connect', joinCurrentUser);
    socket.on('notification', handleNotification);
    syncAuthenticatedUser();
    const syncInterval = setInterval(syncAuthenticatedUser, 1000);

    return () => {
      isActive = false;
      clearInterval(syncInterval);
      socket.off('connect', joinCurrentUser);
      socket.off('notification', handleNotification);
    };
  }, [router]);

  return null;
}
