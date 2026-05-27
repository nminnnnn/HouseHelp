import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import FilterSidebar from "./Housekeeper/FilterSidebar";
import HousekeeperList from "./Housekeeper/HousekeeperList";
import QuickInfo from "./Housekeeper/QuickInfo";
import SpecialOffer from "./Housekeeper/SpecialOffer";
import Header from "./Header";
import { useAuth } from "../hooks/useAuth";
import MobileBottomNav from "../components/MobileBottomNav";

const serviceGroups = [
  { title: "Cleaning", subtitle: "on-demand", icon: "broom", filter: "Cleaning" },
  { title: "Cleaning", subtitle: "monthly", icon: "calendar", filter: "Cleaning" },
  { title: "Deep", subtitle: "Cleaning", icon: "home", filter: "Deep Cleaning" },
  { title: "A/C Cleaning", subtitle: "", icon: "snow", filter: "A/C Cleaning" },
  { title: "Cooking", subtitle: "", icon: "pot", filter: "Cooking" },
  { title: "Laundry", subtitle: "", icon: "shirt", filter: "Laundry" },
  { title: "Elderly Care", subtitle: "", icon: "care", filter: "Elder Care" },
  { title: "More", subtitle: "services", icon: "plus", filter: "" }
];

const featuredServices = [
  { title: "Wellness Office", badge: "NEW", icon: "wellness" },
  { title: "Pet Care", badge: "NEW", icon: "heart" },
  { title: "Patient Care", badge: "NEW", icon: "patient" },
  { title: "Home Moving", badge: "", icon: "truck" }
];

function ServiceIcon({ name }) {
  const paths = {
    broom: "M14 4 5 13M4 14l6 6M7 11l6 6M13 5l6 6M12 20l8-8",
    calendar: "M7 3v4M17 3v4M4 8h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2ZM9 13h2M13 13h2M9 17h2",
    home: "M3 11.5 12 4l9 7.5V20H4v-8.5ZM9 20v-6h6v6",
    snow: "M12 3v18M5 7l14 10M19 7 5 17M8 4l4 3 4-3M8 20l4-3 4 3",
    pot: "M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7ZM8 10V7a4 4 0 0 1 8 0v3",
    shirt: "M8 4 4 7l3 4 2-1v10h6V10l2 1 3-4-4-3-2 3h-4L8 4Z",
    care: "M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z",
    plus: "M12 5v14M5 12h14",
    wellness: "M6 18c7 0 11-5 12-12-7 1-12 5-12 12ZM6 18c0-5 2-8 6-10",
    heart: "M20.5 8.8c0 5.1-8.5 10.2-8.5 10.2S3.5 13.9 3.5 8.8A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 1.6Z",
    patient: "M12 21a7 7 0 0 0 7-7V7l-7-4-7 4v7a7 7 0 0 0 7 7ZM9 12h6M12 9v6",
    truck: "M3 7h11v10H3V7ZM14 11h4l3 3v3h-7v-6ZM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

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
    setFilter({ ...(filter || {}), keyword });
  };

  const handleServicePick = (service) => {
    if (!service) {
      setFilter({});
      setKeyword("");
      return;
    }

    setFilter({ services: [service], keyword: service });
    setKeyword(service);
  };

  // Tự động reload đề xuất khi người dùng xóa hết text trong search box
  useEffect(() => {
    if (keyword === "") {
      // Xóa keyword khỏi filter để reload lại các đề xuất ban đầu
      setFilter(prevFilter => {
        if (!prevFilter) return {};
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
          <h2>Chào mừng trở lại, {user.fullName}!</h2>
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

      <section className="customer-hero">
        <div className="customer-hero-inner">
          <div>
            <p className="hero-kicker">HouseHelp</p>
            <h1>Hi {user?.fullName?.split(" ")[0] || "ban"}</h1>
            <p>Dat dich vu cham soc nha cua nhanh, ro gia va de theo doi.</p>
          </div>
          <button type="button" className="hero-chat-btn" onClick={() => window.location.href = "/chat"} aria-label="Messages">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            </svg>
          </button>
        </div>

        <div className="recent-task-card">
          <div>
            <strong>Cleaning</strong>
            <span>{user?.address || "Them dia chi de dat lich nhanh hon"}</span>
          </div>
          <button type="button" onClick={() => window.location.href = "/quick-booking"}>Book again</button>
          <div className="reward-strip">
            <span>0 d</span>
            <span>0 points</span>
          </div>
        </div>
      </section>

      <section className="service-shell">
        <div className="section-heading">
          <h2>Service</h2>
          <button type="button" onClick={() => handleServicePick("")}>See all</button>
        </div>

        <div className="featured-service-row">
          {featuredServices.map((service) => (
            <button key={service.title} type="button" className="featured-service">
              <span>{service.badge}</span>
              <ServiceIcon name={service.icon} />
              <strong>{service.title}</strong>
            </button>
          ))}
        </div>

        <div className="service-grid-mobile">
          {serviceGroups.map((service) => (
            <button key={`${service.title}-${service.subtitle}`} type="button" onClick={() => handleServicePick(service.filter)}>
              <ServiceIcon name={service.icon} />
              <strong>{service.title}</strong>
              {service.subtitle && <span>{service.subtitle}</span>}
            </button>
          ))}
        </div>
      </section>
      
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
      <MobileBottomNav />
    </div>
  );
} 
