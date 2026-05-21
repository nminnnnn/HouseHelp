import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authHeaders } from '../../api/userApi';
import io from 'socket.io-client';
import './ConversationsList.css';

const ConversationsList = ({ onSelectConversation, refreshTrigger, selectedBookingId }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const autoSelectedBookingRef = useRef(null);
  const [deletingConversation, setDeletingConversation] = useState(null);

  const fetchConversations = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/users/${user.id}/conversations`, {
        headers: authHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        console.log(`📋 Loaded ${data.length} conversations`);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    
    // Refresh conversations every 10 seconds (faster)
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Refresh when refreshTrigger changes (when conversation is marked as read)
  useEffect(() => {
    if (refreshTrigger) {
      fetchConversations();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (!selectedBookingId || conversations.length === 0) return;
    if (String(autoSelectedBookingRef.current) === String(selectedBookingId)) return;

    const conversation = conversations.find(item => String(item.bookingId) === String(selectedBookingId));
    if (conversation) {
      autoSelectedBookingRef.current = selectedBookingId;
      onSelectConversation(conversation);
    }
  }, [selectedBookingId, conversations, onSelectConversation]);

  const handleDeleteConversation = async (bookingId, e) => {
    e.stopPropagation(); // Prevent conversation selection
    
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ cuộc trò chuyện này?')) {
      return;
    }
    
    setDeletingConversation(bookingId);
    
    try {
      const response = await fetch(`http://localhost:5000/api/conversations/${bookingId}`, {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Conversation deleted successfully:', result.message);
        // WebSocket sẽ tự động cập nhật UI
      } else {
        const error = await response.json();
        console.error('❌ Failed to delete conversation:', error);
        console.error('Response status:', response.status);
        alert(error.error || `Lỗi ${response.status}: Không thể xóa cuộc trò chuyện`);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Lỗi khi xóa cuộc trò chuyện');
    } finally {
      setDeletingConversation(null);
    }
  };

  // Setup WebSocket for real-time conversation updates
  useEffect(() => {
    if (!user?.id) return;

    socketRef.current = io('http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    
    // Join user to their room
    socketRef.current.emit('join', { 
      userId: user.id, 
      role: user.role 
    });

    socketRef.current.on('connect', () => {
      console.log('✅ ConversationsList WebSocket connected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ ConversationsList WebSocket error:', error);
    });
    
    socketRef.current.on('new_message', (data) => {
      console.log('🔔 New message received in conversations:', data);
      // Refresh conversations when new message arrives để cập nhật unread count
      setTimeout(fetchConversations, 500); // Small delay to ensure DB is updated
    });

    // Listen for conversation deletion
    socketRef.current.on('conversation_deleted', (data) => {
      console.log('🗑️ Conversation deleted:', data);
      // Remove conversation from list
      setConversations(prev => prev.filter(conv => conv.bookingId !== data.bookingId));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user?.id, user?.role]);

  const formatLastMessageTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
  };

  const truncateMessage = (message, maxLength = 50) => {
    if (!message) return 'Chưa có tin nhắn';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  const getBookingStatusBadge = (status) => {
    const statusMap = {
      'pending': { text: 'Chờ xác nhận', class: 'status-pending' },
      'confirmed': { text: 'Đã xác nhận', class: 'status-confirmed' },
      'in_progress': { text: 'Đang thực hiện', class: 'status-in-progress' },
      'completed': { text: 'Hoàn thành', class: 'status-completed' },
      'cancelled': { text: 'Đã hủy', class: 'status-cancelled' }
    };
    
    const statusInfo = statusMap[status] || { text: status, class: 'status-default' };
    return (
      <span className={`booking-status ${statusInfo.class}`}>
        {statusInfo.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="conversations-loading">
        <div className="loading-spinner"></div>
        <p>Đang tải cuộc trò chuyện...</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversations-empty">
        <div className="empty-icon">💬</div>
        <h3>Chưa có cuộc trò chuyện</h3>
        <p>Các cuộc trò chuyện sẽ xuất hiện khi bạn có booking với khách hàng hoặc người giúp việc.</p>
      </div>
    );
  }

  return (
    <div className="conversations-list">
      <div className="conversations-header">
        <h2>Tin nhắn</h2>
        <span className="conversations-count">({conversations.length})</span>
      </div>
      
      <div className="conversations-items">
        {conversations.map((conversation) => (
          <div
            key={conversation.bookingId}
            className="conversation-item"
            onClick={() => onSelectConversation(conversation)}
          >
            <div className="conversation-avatar">
              {conversation.otherUserName?.charAt(0) || '?'}
            </div>
            
            <div className="conversation-content">
              <div className="conversation-header">
                <h4 className="conversation-name">
                  {conversation.otherUserName}
                </h4>
                <div className="conversation-actions">
                  <span className="conversation-time">
                    {formatLastMessageTime(conversation.lastMessageTime)}
                  </span>
                  <button
                    className="delete-conversation-btn"
                    onClick={(e) => handleDeleteConversation(conversation.bookingId, e)}
                    disabled={deletingConversation === conversation.bookingId}
                    title="Xóa cuộc trò chuyện"
                  >
                    {deletingConversation === conversation.bookingId ? '⏳' : '🗑️'}
                  </button>
                </div>
              </div>
              
              <div className="conversation-details">
                <p className="conversation-service">
                  📋 {conversation.service}
                </p>
                {getBookingStatusBadge(conversation.bookingStatus)}
              </div>
              
              <div className="conversation-last-message">
                <p>{truncateMessage(conversation.lastMessage)}</p>
                {conversation.unreadCount > 0 && (
                  <span className="unread-badge">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationsList;
