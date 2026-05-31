import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authHeaders } from '../../api/userApi';
import io from 'socket.io-client';
import CallButton from '../Call/CallButton';
import CallWindow from '../Call/CallWindow';
import CallService from '../../services/CallService';
import './ChatWindow.css';

const JITSI_BASE_URL = (import.meta.env.VITE_JITSI_URL || 'https://meet.ffmuc.net').replace(/\/+$/, '');

function safeJitsiRoom(roomName) {
  return String(roomName || 'househelp-call')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
}

const ChatWindow = ({ bookingId, directUserId, otherUser, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCallWindow, setShowCallWindow] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callData, setCallData] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const isDirectChat = Boolean(directUserId) && !bookingId;

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when new messages arrive (but allow manual scroll up)
  useEffect(() => {
    // Only auto-scroll if user is near bottom
    const messagesContainer = messagesEndRef.current?.parentElement;
    if (messagesContainer) {
      const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages]);

  // Fetch existing messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const url = isDirectChat
          ? `http://localhost:5000/api/users/${user.id}/messages/${directUserId}`
          : `http://localhost:5000/api/bookings/${bookingId}/messages`;
        const response = await fetch(url, {
          headers: authHeaders()
        });
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    if ((isDirectChat && user?.id && directUserId) || bookingId) {
      fetchMessages();
    }
  }, [bookingId, directUserId, isDirectChat, user?.id]);

  // Setup WebSocket for real-time messages
  useEffect(() => {
    if (!user?.id || (!bookingId && !directUserId)) return;

    socketRef.current = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    // Join user to their room
    socketRef.current.emit('join', { 
      userId: user.id, 
      role: user.role 
    });

    // Initialize CallService
    const userName = user.fullName || `${user.firstName} ${user.lastName}` || 'Người dùng';
    CallService.connect(user.id, user.role, userName);
    
    console.log('🔌 Initialized CallService for user:', user.id, userName);
    
    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      socketRef.current.emit('join', {
        userId: user.id,
        role: user.role,
        userName: user.fullName || user.email,
      });
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });
    
    socketRef.current.on('new_message', (data) => {
      console.log('🔔 Received new message:', data);
      if (Number(data.senderId) === Number(user.id)) {
        return;
      }

      const isSameBooking = bookingId && data.bookingId === parseInt(bookingId);
      const isSameDirectUser = directUserId && (
        (Number(data.senderId) === Number(user.id) && Number(data.receiverId) === Number(directUserId)) ||
        (Number(data.receiverId) === Number(user.id) && Number(data.senderId) === Number(directUserId))
      );

      if (isSameBooking || isSameDirectUser) {
        // Add new message to the list
        const newMsg = {
          id: data.id || Date.now(),
          bookingId: data.bookingId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          message: data.message,
          messageType: data.messageType || 'text',
          createdAt: data.timestamp || new Date().toISOString(),
          senderName: data.senderName
        };
        
        setMessages(prev => {
          // Check if message already exists by ID (more reliable)
          const existsById = prev.some(msg => msg.id === newMsg.id);
          
          // Also check for recent similar messages (fallback)
          const existsByContent = prev.some(msg => 
            msg.message === newMsg.message && 
            msg.senderId === newMsg.senderId &&
            Math.abs(new Date(msg.createdAt) - new Date(newMsg.createdAt)) < 3000
          );
          
          if (!existsById && !existsByContent) {
            console.log('✅ Adding new message to chat via WebSocket');
            return [...prev, newMsg];
          } else {
            console.log('⚠️ Duplicate message detected, skipping');
            return prev;
          }
        });
      }
    });
    socketRef.current.on('incoming_call', (payload) => {
      console.log('[ChatWindow] incoming_call', payload);
      if (!payload?.roomName) {
        return;
      }

      setIncomingCall(payload);
    });

    // Listen for message deletion
    socketRef.current.on('message_deleted', (data) => {
      console.log('🗑️ Message deleted:', data);
      // Remove deleted message from UI
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
    });

    // Listen for conversation deletion
    socketRef.current.on('conversation_deleted', (data) => {
      console.log('🗑️ Conversation deleted:', data);
      if (data.bookingId === parseInt(bookingId)) {
        // Clear all messages if current conversation is deleted
        setMessages([]);
        // Optionally close the chat window or show a message
        if (onClose) {
          onClose();
        }
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [bookingId, directUserId, user?.id, user?.role]);

  const handleDeleteMessage = async (messageId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        console.log('✅ Message deleted successfully');
        // WebSocket sẽ tự động cập nhật UI
      } else {
        const error = await response.json();
        console.error('❌ Failed to delete message:', error.error);
        alert(error.error || 'Không thể xóa tin nhắn');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Lỗi khi xóa tin nhắn');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setSending(true);
    
    // Optimistically add message to UI immediately
    const optimisticMessage = {
      id: Date.now(),
      bookingId: bookingId ? parseInt(bookingId) : null,
      senderId: user.id,
      receiverId: otherUser.id,
      message: messageText,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      senderName: user.fullName,
      sending: true // Mark as sending
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage(''); // Clear input immediately
    
    try {
      const url = isDirectChat
        ? `http://localhost:5000/api/users/${user.id}/messages/${directUserId}`
        : `http://localhost:5000/api/bookings/${bookingId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(isDirectChat
          ? {
              message: messageText,
              messageType: 'text'
            }
          : {
              senderId: user.id,
              receiverId: otherUser.id,
              message: messageText,
              messageType: 'text'
            }),
      });

      if (response.ok) {
        const sentMessage = await response.json();
        
        // Replace optimistic message with real message from server
        setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? {
                ...sentMessage,
                id: sentMessage.id,
                sending: false
              }
            : msg
        ));
        
        console.log('✅ Message sent successfully');
      } else {
        console.error('Failed to send message');
        // Remove failed message
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        setNewMessage(messageText); // Restore message to input
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restore message to input
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hôm nay';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(message => {
      const date = new Date(message.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  // Call handlers
  const handleVoiceCall = async () => {
    try {
      console.log('🔥 Starting voice call to:', otherUser);
      console.log('🔍 otherUser.otherUserId:', otherUser?.otherUserId);
      console.log('🔍 otherUser.otherUserName:', otherUser?.otherUserName);
      console.log('🔍 otherUser keys available:', Object.keys(otherUser || {}));
      console.log('🔍 otherUser.id:', otherUser?.id);
      console.log('🔍 otherUser.customerId:', otherUser?.customerId);
      console.log('🔍 otherUser.housekeeperId:', otherUser?.housekeeperId);
      
      // Extract userId - có thể là nested object
      let targetUserId = null;
      let targetUserName = 'Người dùng';
      
      if (typeof otherUser === 'object' && otherUser !== null) {
        // Nếu otherUser có nested otherUser object (từ conversation)
        const actualUser = otherUser.otherUser || otherUser;
        
        // Thử các cách khác nhau để lấy userId
        targetUserId = actualUser.otherUserId || actualUser.id || actualUser.userId || otherUser.otherUserId || otherUser.housekeeperId || otherUser.customerId;
        targetUserName = actualUser.otherUserName || actualUser.fullName || actualUser.name || otherUser.otherUserName || otherUser.housekeeperName || otherUser.customerName;
        
        // Nếu không có userId, thử extract từ các field khác
        if (!targetUserId) {
          // Thử lấy từ customerId hoặc housekeeperId
          if (otherUser.customerId && otherUser.customerId !== user?.id) {
            targetUserId = otherUser.customerId;
            targetUserName = otherUser.customerName || 'Customer';
          } else if (otherUser.housekeeperId && otherUser.housekeeperId !== user?.id) {
            targetUserId = otherUser.housekeeperId;
            targetUserName = otherUser.housekeeperName || 'Housekeeper';
          } else if (otherUser.bookingId) {
            console.log('⚠️ No userId found, using bookingId as fallback:', otherUser.bookingId);
            targetUserId = `booking_${otherUser.bookingId}`; // Temporary ID
            targetUserName = `User from Booking ${otherUser.bookingId}`;
          }
        }
        
        // Nếu vẫn là object, thử deep access
        if (typeof targetUserId === 'object') {
          console.log('🔍 targetUserId is object:', targetUserId);
          targetUserId = targetUserId?.id || targetUserId?.otherUserId || targetUserId?.userId;
        }
        if (typeof targetUserName === 'object') {
          console.log('🔍 targetUserName is object:', targetUserName);
          targetUserName = targetUserName?.fullName || targetUserName?.name || 'Người dùng';
        }
      } else {
        targetUserId = otherUser;
      }
      
      console.log('🎯 Final targetUserId:', targetUserId, typeof targetUserId);
      console.log('🎯 Final targetUserName:', targetUserName);
      
      if (!targetUserId) {
        console.error('❌ Cannot extract targetUserId from:', otherUser);
        console.error('❌ Available keys:', Object.keys(otherUser || {}));
        console.error('❌ Available values:', Object.values(otherUser || {}));
        throw new Error('Invalid user data - missing user ID');
      }
      
      await CallService.startCall(targetUserId, false);
      setCallData({
        targetUserId: targetUserId,
        targetUserName: targetUserName,
        isVideoCall: false
      });
      setShowCallWindow(true);
    } catch (error) {
      console.error('Error starting voice call:', error);
      alert(`Không thể bắt đầu cuộc gọi: ${error.message}`);
    }
  };

  const handleVideoCall = async () => {
    try {
      console.log('🔥 Starting video call to:', otherUser);
      
      // Extract userId - có thể là nested object
      let targetUserId = null;
      let targetUserName = 'Người dùng';
      
      if (typeof otherUser === 'object' && otherUser !== null) {
        // Nếu otherUser có nested otherUser object (từ conversation)
        const actualUser = otherUser.otherUser || otherUser;
        
        targetUserId = actualUser.otherUserId || actualUser.id || actualUser.userId || otherUser.otherUserId || otherUser.housekeeperId || otherUser.customerId;
        targetUserName = actualUser.otherUserName || actualUser.fullName || actualUser.name || otherUser.otherUserName || otherUser.housekeeperName || otherUser.customerName;
        
        // Fallback với customerId/housekeeperId
        if (!targetUserId) {
          if (otherUser.customerId && otherUser.customerId !== user?.id) {
            targetUserId = otherUser.customerId;
            targetUserName = otherUser.customerName || 'Customer';
          } else if (otherUser.housekeeperId && otherUser.housekeeperId !== user?.id) {
            targetUserId = otherUser.housekeeperId;
            targetUserName = otherUser.housekeeperName || 'Housekeeper';
          } else if (otherUser.bookingId) {
            targetUserId = `booking_${otherUser.bookingId}`;
            targetUserName = `User from Booking ${otherUser.bookingId}`;
          }
        }
        
        if (typeof targetUserId === 'object') {
          targetUserId = targetUserId?.id || targetUserId?.otherUserId || targetUserId?.userId;
        }
        if (typeof targetUserName === 'object') {
          targetUserName = targetUserName?.fullName || targetUserName?.name || 'Người dùng';
        }
      } else {
        targetUserId = otherUser;
      }
      
      if (!targetUserId) {
        console.error('❌ Cannot extract targetUserId from:', otherUser);
        throw new Error('Invalid user data - missing user ID');
      }
      
      await CallService.startCall(targetUserId, true);
      setCallData({
        targetUserId: targetUserId,
        targetUserName: targetUserName,
        isVideoCall: true
      });
      setShowCallWindow(true);
    } catch (error) {
      console.error('Error starting video call:', error);
      alert(`Không thể bắt đầu cuộc gọi video: ${error.message}`);
    }
  };

  const handleAnswerCall = async (callData) => {
    try {
      await CallService.answerCall(callData);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error answering call:', error);
      alert('Không thể trả lời cuộc gọi. Vui lòng thử lại.');
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      CallService.rejectCall(incomingCall.callerId);
      setIncomingCall(null);
    }
  };

  const handleCloseCallWindow = () => {
    setShowCallWindow(false);
    setCallData(null);
    setIncomingCall(null);
  };

  const acceptJitsiCall = () => {
    if (!incomingCall?.roomName) return;

    socketRef.current?.emit('call_accepted', {
      bookingId: incomingCall.bookingId,
      roomName: incomingCall.roomName,
      targetUserId: incomingCall.callerId,
    });
    window.open(`${JITSI_BASE_URL}/${safeJitsiRoom(incomingCall.roomName)}`, '_blank', 'noopener,noreferrer');
    setIncomingCall(null);
  };

  const rejectJitsiCall = () => {
    if (!incomingCall) return;

    socketRef.current?.emit('call_rejected', {
      bookingId: incomingCall.bookingId,
      roomName: incomingCall.roomName,
      targetUserId: incomingCall.callerId,
    });
    setIncomingCall(null);
  };

  // Listen for incoming calls
  useEffect(() => {
    const handleCallEvent = (event, data) => {
      console.log('🎧 ChatWindow received call event:', event, data);
      if (event === 'incoming_call') {
        console.log('📞 Setting up incoming call popup:', data);
        setIncomingCall(data);
        setCallData(data);
        setShowCallWindow(true);
      }
    };

    CallService.addListener(handleCallEvent);

    return () => {
      CallService.removeListener(handleCallEvent);
    };
  }, []);

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="chat-window">
      {incomingCall?.roomName ? (
        <div className="incoming-call">
          <div className="incoming-call__ring" aria-hidden="true">CALL</div>
          <div className="incoming-call__content">
            <p className="incoming-call__eyebrow">Cuoc goi video</p>
            <h3>{incomingCall.callerName || 'Khach hang'} dang goi cho ban</h3>
            {incomingCall.bookingId ? <p>Booking #{incomingCall.bookingId}</p> : null}
          </div>
          <div className="incoming-call__actions">
            <button className="incoming-call__accept" type="button" onClick={acceptJitsiCall}>
              Nghe may
            </button>
            <button className="incoming-call__reject" type="button" onClick={rejectJitsiCall}>
              Tu choi
            </button>
          </div>
        </div>
      ) : null}

      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-user-info">
          <div className="user-avatar">
            {((otherUser?.otherUser?.fullName || otherUser?.otherUserName || otherUser?.fullName)?.[0]) || 'U'}
          </div>
          <div className="user-details">
            <h3>{otherUser?.otherUser?.fullName || otherUser?.otherUserName || otherUser?.fullName || 'Người dùng'}</h3>
            <span className="user-status">Đang hoạt động</span>
          </div>
        </div>
        <div className="chat-actions">
          <CallButton 
            onVoiceCall={handleVoiceCall}
            onVideoCall={handleVideoCall}
            otherUser={otherUser}
          />
          <button className="close-chat-btn" onClick={onClose}>×</button>
        </div>
      </div>
      <div 
        className="chat-messages"
        tabIndex={0}
        onKeyDown={(e) => {
          const container = e.currentTarget;
          if (e.key === 'ArrowUp') {
            container.scrollTop -= 50;
          } else if (e.key === 'ArrowDown') {
            container.scrollTop += 50;
          } else if (e.key === 'PageUp') {
            container.scrollTop -= container.clientHeight;
          } else if (e.key === 'PageDown') {
            container.scrollTop += container.clientHeight;
          }
        }}
      >
        {loading ? (
          <div className="chat-loading">
            <div className="loading-spinner"></div>
            <p>Đang tải tin nhắn...</p>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dayMessages]) => (
            <div key={date}>
              <div className="date-separator">
                <span>{formatDate(dayMessages[0].createdAt)}</span>
              </div>
              {dayMessages.map((message, index) => (
                <div
                  key={message.id || `msg-${index}`}
                  className={`message ${message.senderId === user.id ? 'sent' : 'received'} ${message.sending ? 'sending' : ''}`}
                >
                  <div className="message-content">
                    <p>{String(message.message || '')}</p>
                    <div className="message-footer">
                      <span className="message-time">
                        {formatTime(message.createdAt)}
                        {message.sending && <span className="sending-indicator"> ⏳</span>}
                      </span>
                      {message.senderId === user.id && !message.sending && (
                        <button
                          className="delete-message-btn"
                          onClick={() => handleDeleteMessage(message.id)}
                          title="Xóa tin nhắn"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div className="chat-input-container">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="chat-input"
            disabled={sending}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!newMessage.trim() || sending}
          >
            {sending ? '...' : '➤'}
          </button>
        </div>
      </form>

      {/* Call Window */}
      <CallWindow 
        isOpen={showCallWindow}
        onClose={handleCloseCallWindow}
        callData={callData}
        isIncoming={!!incomingCall}
        onAnswer={handleAnswerCall}
        onReject={handleRejectCall}
      />
    </div>
  );
};

export default ChatWindow;
