import React, { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authHeaders } from '../api/userApi';
import ConversationsList from '../components/Chat/ConversationsList';
import ChatWindow from '../components/Chat/ChatWindow';
import './ChatPage.css';

const ChatPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const selectedBookingId = location.state?.bookingId || new URLSearchParams(location.search).get('bookingId');
  const directUser = location.state?.directUser;

  // Handle window resize for mobile detection
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectConversation = useCallback(async (conversation) => {
    console.log('🔍 Selected conversation:', conversation);
    console.log('🔍 BookingId type:', typeof conversation.bookingId, conversation.bookingId);
    
    // Đánh dấu đã đọc ngay khi click vào conversation
    if (user?.id) {
      try {
        const bookingIds = conversation.bookingIds?.length
          ? conversation.bookingIds
          : [conversation.bookingId].filter(Boolean);

        await Promise.all(bookingIds.map((bookingId) =>
          fetch(`http://localhost:5000/api/bookings/${bookingId}/mark-read`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ userId: user.id })
          })
        ));
        console.log('✅ Conversation marked as read on selection');
        // Trigger refresh để cập nhật unread count ngay lập tức
        setRefreshTrigger(prev => prev + 1);
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    }

    setSelectedConversation({
      bookingId: null,
      directUserId: conversation.otherUserId,
      otherUser: {
        id: conversation.otherUserId,
        fullName: conversation.otherUserName,
        role: conversation.otherUserRole
      },
      service: conversation.service,
      bookingStatus: conversation.bookingStatus
    });
  }, [user?.id]);

  const handleCloseChat = () => {
    setSelectedConversation(null);
  };

  React.useEffect(() => {
    if (directUser?.id) {
      setSelectedConversation({
        bookingId: null,
        directUserId: directUser.id,
        otherUser: {
          id: directUser.id,
          fullName: directUser.fullName || directUser.name || 'Người dùng',
          role: directUser.role || 'housekeeper'
        },
        service: 'Trao đổi trực tiếp',
        bookingStatus: 'direct'
      });
    }
  }, [directUser?.id, directUser?.fullName, directUser?.name, directUser?.role]);

  return (
    <div className="chat-page">
      <div className="chat-container">
               <div className={`chat-sidebar ${isMobile && selectedConversation ? 'hidden' : ''}`}>
                 <ConversationsList 
                   onSelectConversation={handleSelectConversation} 
                   refreshTrigger={refreshTrigger}
                   selectedBookingId={selectedBookingId}
                 />
               </div>
        
        <div className={`chat-main ${isMobile && selectedConversation ? 'active' : ''}`}>
          {selectedConversation ? (
            <div className="chat-window-container">
              <div className="chat-window-header">
                <button 
                  className="back-to-conversations"
                  onClick={handleCloseChat}
                >
                  ← Quay lại
                </button>
                <div className="chat-info">
                  <h3>{selectedConversation.otherUser.fullName}</h3>
                  <p>📋 {selectedConversation.service}</p>
                </div>
              </div>
              <div className="chat-window-wrapper">
                {console.log('🔍 ChatPage passing selectedConversation:', selectedConversation)}
                {console.log('🔍 selectedConversation.otherUserId:', selectedConversation?.otherUserId)}
                <ChatWindow
                  bookingId={selectedConversation.bookingId}
                  directUserId={selectedConversation.directUserId}
                  otherUser={selectedConversation.otherUser}
                  onClose={handleCloseChat}
                />
              </div>
            </div>
          ) : (
            <div className="chat-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">💬</div>
                <h2>Chọn một cuộc trò chuyện</h2>
                <p>Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu nhắn tin.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
