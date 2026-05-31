import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import './IncomingCallListener.css';

const SOCKET_URL = 'http://localhost:5000';
const JITSI_BASE_URL = (import.meta.env.VITE_JITSI_URL || 'https://meet.ffmuc.net').replace(/\/+$/, '');

function safeRoomName(roomName) {
  return String(roomName || 'househelp-call')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem('househelp_user');
    return raw && raw !== 'null' && raw !== 'undefined' ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function IncomingCallListener() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    const activeUser = user?.id ? user : readStoredUser();

    if ((!isAuthenticated && !activeUser?.id) || !activeUser?.id) {
      setIncomingCall(null);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[IncomingCallListener] connected', socket.id, activeUser.id);
      socket.emit('join', {
        role: activeUser.role,
        userId: activeUser.id,
        userName: activeUser.fullName || activeUser.email,
      });
    });

    socket.on('connect_error', (error) => {
      console.error('[IncomingCallListener] connect_error', error.message);
    });

    socket.on('incoming_call', (payload) => {
      console.log('[IncomingCallListener] incoming_call', payload);
      if (!payload?.roomName) {
        return;
      }

      setIncomingCall({
        bookingId: payload.bookingId,
        callerId: payload.callerId,
        callerName: payload.callerName || 'Khach hang',
        callType: payload.callType || 'video',
        roomName: payload.roomName,
      });
    });

    socket.on('call_ended', () => {
      setIncomingCall(null);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.email, user?.fullName, user?.id, user?.role]);

  useEffect(() => {
    if (!incomingCall) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      socketRef.current?.emit('call_rejected', {
        bookingId: incomingCall.bookingId,
        roomName: incomingCall.roomName,
        targetUserId: incomingCall.callerId,
      });
      setIncomingCall(null);
    }, 45000);

    return () => window.clearTimeout(timerId);
  }, [incomingCall]);

  if (!incomingCall) {
    return null;
  }

  const acceptCall = () => {
    const roomName = safeRoomName(incomingCall.roomName);

    socketRef.current?.emit('call_accepted', {
      bookingId: incomingCall.bookingId,
      roomName: incomingCall.roomName,
      targetUserId: incomingCall.callerId,
    });

    window.open(`${JITSI_BASE_URL}/${roomName}`, '_blank', 'noopener,noreferrer');
    setIncomingCall(null);
  };

  const rejectCall = () => {
    socketRef.current?.emit('call_rejected', {
      bookingId: incomingCall.bookingId,
      roomName: incomingCall.roomName,
      targetUserId: incomingCall.callerId,
    });
    setIncomingCall(null);
  };

  return (
    <div className="incoming-call">
      <div className="incoming-call__ring" aria-hidden="true">CALL</div>
      <div className="incoming-call__content">
        <p className="incoming-call__eyebrow">Cuoc goi video</p>
        <h3>{incomingCall.callerName} dang goi cho ban</h3>
        {incomingCall.bookingId ? <p>Booking #{incomingCall.bookingId}</p> : null}
      </div>
      <div className="incoming-call__actions">
        <button className="incoming-call__accept" type="button" onClick={acceptCall}>
          Nghe may
        </button>
        <button className="incoming-call__reject" type="button" onClick={rejectCall}>
          Tu choi
        </button>
      </div>
    </div>
  );
}
