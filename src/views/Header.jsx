import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import translations from "../locales/translations";
import NotificationBell from "../components/NotificationBell";

export default function Header({ keyword, setKeyword, onSearch }) {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const { language } = useLanguage();
  const t = translations[language];

  const handleLogin = () => navigate("/login");
  const handleRegister = () => navigate("/register");
  const handleLogout = () => {
    // Show a brief loading state
    const logoutBtn = document.querySelector('.dropdown-item.logout');
    if (logoutBtn) {
      logoutBtn.innerHTML = '<span class="dropdown-icon">⏳</span>Đang đăng xuất...';
      logoutBtn.disabled = true;
    }
    
    logout();
    setShowDropdown(false);
  };

  const handleProfile = () => {
    navigate("/profile");
    setShowDropdown(false);
  };

  const handleSettings = () => {
    navigate("/settings/language");
    setShowDropdown(false);
  };

  const handleMessages = () => {
    navigate("/chat");
    setShowDropdown(false);
  };

  const getUserInitials = (fullName) => {
    if (!fullName) return "U";
    return fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="main-header">
      <div className="header-left">
        <span className="logo-text">HouseHelp</span>
      </div>
      <div className="header-center">
        <input
          className="search-input"
          placeholder={t.searchPlaceholder}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSearch(); }}
        />
        <button className="search-btn" onClick={onSearch}>{t.search}</button>
        
        {/* Quick Booking Button - Only show for authenticated customers */}
        {isAuthenticated && user?.role === 'customer' && (
          <button 
            className="quick-booking-btn"
            onClick={() => navigate("/quick-booking")}
            title="Đặt dịch vụ nhanh - Hệ thống tự động tìm người giúp việc phù hợp"
          >
            ⚡ Đặt nhanh
          </button>
        )}
      </div>
      <div className="header-right">
        {isAuthenticated ? (
          <div className="header-user-section" ref={dropdownRef}>
            <button
              className="header-message-btn"
              onClick={handleMessages}
              aria-label="Tin nhắn"
              title="Tin nhắn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </button>
            <NotificationBell />
            <div 
              className="header-avatar" 
              title={user?.fullName}
              onClick={() => setShowDropdown(!showDropdown)}
              style={{ cursor: 'pointer' }}
            >
              {getUserInitials(user?.fullName)}
            </div>
            
            {showDropdown && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    {getUserInitials(user?.fullName)}
                  </div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-name">{user?.fullName}</div>
                    <div className="dropdown-role">
                      {user?.role === 'housekeeper' ? t.housekeeper : 
                       user?.role === 'admin' ? 'Admin' : t.customer}
                    </div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleProfile}>
                  <span className="dropdown-icon">👤</span>
                  {t.profile}
                </button>
                <button className="dropdown-item" onClick={handleMessages}>
                  <span className="dropdown-icon">💬</span>
                  Tin nhắn
                </button>
                {user?.role === 'housekeeper' && (
                  <button className="dropdown-item" onClick={() => { navigate("/housekeeper/dashboard"); setShowDropdown(false); }}>
                    <span className="dropdown-icon">📋</span>
                    Dashboard
                  </button>
                )}
                {user?.role === 'customer' && (
                  <button className="dropdown-item" onClick={() => { navigate("/customer/dashboard"); setShowDropdown(false); }}>
                    <span className="dropdown-icon">📋</span>
                    Dashboard
                  </button>
                )}
                {user?.role === 'admin' && (
                  <button className="dropdown-item" onClick={() => { navigate("/admin/dashboard"); setShowDropdown(false); }}>
                    <span className="dropdown-icon">👑</span>
                    Admin Dashboard
                  </button>
                )}
                <button className="dropdown-item" onClick={handleSettings}>
                  <span className="dropdown-icon">⚙️</span>
                  {t.settings}
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item logout" onClick={handleLogout}>
                  <span className="dropdown-icon">🚪</span>
                  {t.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button className="header-login" onClick={handleLogin}>{t.login || "Login"}</button>
            <button className="header-register" onClick={handleRegister}>{t.register || "Register"}</button>
          </>
        )}
      </div>
    </header>
  );
}
