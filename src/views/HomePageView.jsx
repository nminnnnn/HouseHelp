import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import FilterSidebar from "./Housekeeper/FilterSidebar";
import HousekeeperList from "./Housekeeper/HousekeeperList";
import QuickInfo from "./Housekeeper/QuickInfo";
import SpecialOffer from "./Housekeeper/SpecialOffer";
import Header from "./Header";
import { useAuth } from "../hooks/useAuth";

// ...existing code...

function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-col">
        <div className="footer-title">Services</div>
        <div>House Cleaning</div>
        <div>Cooking</div>
        <div>Babysitting</div>
        <div>Elder Care</div>
      </div>
      <div className="footer-col">
        <div className="footer-title">Support</div>
        <div>Help Center</div>
        <div>Contact Us</div>
        <div>Insurance</div>
      </div>
      <div className="footer-col">
        <div className="footer-title">Company</div>
        <div>About Us</div>
        <div>Careers</div>
        <div>News</div>
      </div>
      <div className="footer-col">
        <div className="footer-title">Legal</div>
        <div>Terms of Service</div>
        <div>Privacy Policy</div>
        <div>Cookie Policy</div>
        <div>Refund Policy</div>
      </div>
      <div className="footer-social">
        <span>Facebook</span>
        <span>Twitter</span>
        <span>Instagram</span>
        <span>LinkedIn</span>
      </div>
      <div className="footer-copy">© 2024 HouseHelp. All rights reserved.</div>
    </footer>
  );
}

export default function HomePageView() {
  const [filter, setFilter] = useState(null);
  const [keyword, setKeyword] = useState("");
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  // Đọc URL parameters khi component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const filterParam = urlParams.get('filter');
    
    if (filterParam === 'top-rated') {
      setFilter({ topRated: true });
    }
  }, [location.search]);

  // Xử lý sự kiện tìm kiếm
  const handleSearch = () => {
    setFilter({ ...filter, keyword });
  };

  // Tự động reload đề xuất khi người dùng xóa hết text trong search box
  useEffect(() => {
    if (keyword === "") {
      // Xóa keyword khỏi filter để reload lại các đề xuất ban đầu
      setFilter(prevFilter => {
        const { keyword: _, ...restFilter } = prevFilter;
        return restFilter;
      });
    }
  }, [keyword]);

  // Hiển thị welcome message cho user đã đăng nhập
  const renderWelcomeSection = () => {
    if (!isAuthenticated || !user) return null;

    return (
      <div className="welcome-section">
        <div className="welcome-card">
          <h2>👋 Chào mừng trở lại, {user.fullName}!</h2>
          {user.role === 'customer' && (
            <p>Tìm kiếm người giúp việc phù hợp với nhu cầu của bạn</p>
          )}
          {user.role === 'housekeeper' && (
            <div>
              <p>Chào mừng bạn đến với HouseHelp! Bạn có thể quản lý công việc của mình tại dashboard.</p>
              <button 
                className="dashboard-btn"
                onClick={() => window.location.href = '/housekeeper/dashboard'}
              >
                📋 Đi tới Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="home-root">
      <Header
        keyword={keyword}
        setKeyword={setKeyword}
        onSearch={handleSearch}
      />
      
      {renderWelcomeSection()}
      
      <div className="home-layout">
        <aside className="sidebar">
          <FilterSidebar onFilterChange={setFilter} />
        </aside>
        <main className="main-content">
          <HousekeeperList filter={filter} />
        </main>
        <aside className="rightbar">
          <QuickInfo onFilterChange={setFilter} currentFilter={filter} />
          <SpecialOffer />
        </aside>
      </div>
      <Footer />
    </div>
  );
} 
