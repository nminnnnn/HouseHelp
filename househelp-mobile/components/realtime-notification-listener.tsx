import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { authService, type AuthUser } from '../lib/auth';
import { useLanguage } from '../lib/language';
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

type IncomingCallPayload = {
  bookingId?: number | string;
  callerId?: number | string;
  callerName?: string;
  callType?: 'audio' | 'video' | string;
  roomName?: string;
  timestamp?: string;
};

export function RealtimeNotificationListener() {
  const router = useRouter();
  const { language } = useLanguage();
  const currentUserRef = useRef<AuthUser | null>(null);
  const displayedNotificationIdsRef = useRef(new Set<string>());
  const displayedCallIdsRef = useRef(new Set<string>());

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
        const customerName = notification.booking?.customerName || (language === 'vi' ? 'Khách hàng' : 'A customer');
        const service = notification.booking?.service || (language === 'vi' ? 'dịch vụ gia đình' : 'a home service');
        const title = language === 'vi' ? 'Đơn hàng mới' : 'New booking';
        const message = language === 'vi' ? `${customerName} vừa đặt ${service}.` : `${customerName} just booked ${service}.`;
        Alert.alert(title, message, [
          { text: language === 'vi' ? 'Để sau' : 'Later', style: 'cancel' },
          {
            text: language === 'vi' ? 'Xem đơn' : 'View booking',
            onPress: () => {
              if (bookingId) router.push(`/(housekeeper)/job/${bookingId}`);
            },
          },
        ]);
        return;
      }

      const housekeeperName = notification.booking?.housekeeperName || 'Housekeeper';
      Alert.alert(
        language === 'vi' ? 'Housekeeper đã nhận đơn' : 'Booking accepted',
        language === 'vi' ? `${housekeeperName} đã xác nhận booking của bạn.` : `${housekeeperName} accepted your booking.`,
        [
        { text: language === 'vi' ? 'Đóng' : 'Close', style: 'cancel' },
        {
          text: language === 'vi' ? 'Xem booking' : 'View booking',
          onPress: () => router.push(`/(customer)/bookings?refresh=${Date.now()}`),
        },
      ]); 
    };

    const handleIncomingCall = (call: IncomingCallPayload) => {
      const user = currentUserRef.current;
      if (!user || !call.roomName || !call.callerId) return;

      const callKey = `${call.roomName}-${call.callerId}-${call.bookingId || 'direct'}`;
      if (displayedCallIdsRef.current.has(callKey)) return;
      displayedCallIdsRef.current.add(callKey);

      const callerId = Number(call.callerId);
      const callType = call.callType === 'audio' ? 'audio' : 'video';
      const callerName = call.callerName || (language === 'vi' ? 'Người dùng' : 'A user');
      const title = language === 'vi'
        ? (callType === 'audio' ? 'Cuộc gọi âm thanh' : 'Cuộc gọi video')
        : (callType === 'audio' ? 'Audio call' : 'Video call');
      const message = language === 'vi'
        ? `${callerName} đang gọi cho bạn.`
        : `${callerName} is calling you.`;

      Alert.alert(title, message, [
        {
          text: language === 'vi' ? 'Từ chối' : 'Reject',
          style: 'cancel',
          onPress: () => {
            socket.emit('call_rejected', {
              bookingId: call.bookingId,
              roomName: call.roomName,
              targetUserId: callerId,
            });
          },
        },
        {
          text: language === 'vi' ? 'Nghe máy' : 'Accept',
          onPress: () => {
            socket.emit('call_accepted', {
              bookingId: call.bookingId,
              roomName: call.roomName,
              targetUserId: callerId,
            });
            router.push({
              pathname: '/call/[roomId]',
              params: {
                bookingId: call.bookingId ? String(call.bookingId) : 'direct',
                roomId: call.roomName || 'househelp-call',
                targetUserId: String(callerId),
                title: callerName,
                type: callType,
              },
            });
          },
        },
      ]);
    };

    socket.on('connect', joinCurrentUser);
    socket.on('notification', handleNotification);
    socket.on('incoming_call', handleIncomingCall);
    syncAuthenticatedUser();
    const syncInterval = setInterval(syncAuthenticatedUser, 1000);

    return () => {
      isActive = false;
      clearInterval(syncInterval);
      socket.off('connect', joinCurrentUser);
      socket.off('notification', handleNotification);
      socket.off('incoming_call', handleIncomingCall);
    };
  }, [language, router]);

  return null;
}
