import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import translations from '../locales/translations';
import './NotificationBell.css';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = translations[language];
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.type === 'new_booking' || notification.type === 'quick_booking') {
      // If user is housekeeper, navigate to dashboard
      setIsOpen(false); // Close dropdown
      navigate('/housekeeper/dashboard');
    } else if (notification.type === 'booking_confirmed' || notification.type === 'booking_rejected') {
      // If user is customer, navigate to customer dashboard
      setIsOpen(false);
      navigate('/customer/dashboard');
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Vừa xong';
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} ngày trước`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_booking':
        return '📅';
      case 'booking_confirmed':
        return '✅';
      case 'booking_rejected':
        return '❌';
      case 'booking_cancelled':
        return '❌';
      case 'payment_received':
        return '💰';
      default:
        return '📬';
    }
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button 
        className="bell-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>{t.notifications || 'Thông báo'}</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-read"
                onClick={() => markAllAsRead()}
              >
                {t.markAllRead || 'Đánh dấu tất cả đã đọc'}
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>{t.noNotifications || 'Không có thông báo nào'}</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.read ? 'unread' : ''} ${['new_booking', 'quick_booking', 'booking_confirmed', 'booking_rejected'].includes(notification.type) ? 'clickable' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  style={{ cursor: ['new_booking', 'quick_booking', 'booking_confirmed', 'booking_rejected'].includes(notification.type) ? 'pointer' : 'default' }}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">
                      {notification.title}
                    </div>
                    <div className="notification-message">
                      {notification.message}
                    </div>
                    <div className="notification-time">
                      {formatTimeAgo(notification.timestamp)}
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="unread-dot"></div>
                  )}
                </div>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <div className="notification-footer">
              <button className="view-all-btn">
                {t.viewAllNotifications || 'Xem tất cả thông báo'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

