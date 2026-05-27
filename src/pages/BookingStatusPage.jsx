import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBooking } from "../contexts/BookingContext";
import MobileBottomNav from "../components/MobileBottomNav";
import BookingPending from "../views/Booking/BookingPending";
import "./BookingStatusPage.css";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

export default function BookingStatusPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    selectedHousekeeper,
    bookingDetails,
    currentStage,
    resetBooking
  } = useBooking();

  const handleCancel = () => {
    resetBooking();
    navigate("/");
  };

  useEffect(() => {
    if (!isMobile && (!bookingDetails || !selectedHousekeeper)) {
      navigate("/");
    }
  }, [bookingDetails, isMobile, navigate, selectedHousekeeper]);

  if (!bookingDetails || !selectedHousekeeper) {
    if (!isMobile) return null;

    return (
      <div className="activity-page">
        <main className="activity-content">
          <div className="activity-header">
            <h1>Activity</h1>
            <button type="button" onClick={() => navigate("/customer/dashboard")}>
              History
            </button>
          </div>

          <div className="activity-tabs" role="tablist" aria-label="Activity filters">
            <button type="button" className="active">Upcoming</button>
            <button type="button">Schedule</button>
            <button type="button">Monthly</button>
          </div>

          <section className="activity-empty">
            <div className="activity-empty-illustration" aria-hidden="true">
              <svg viewBox="0 0 240 180">
                <rect x="78" y="22" width="54" height="70" rx="4" />
                <path d="M98 122c16-12 34-12 52 0l-12 36h-28l-12-36Z" />
                <circle cx="124" cy="82" r="18" />
                <path d="M72 135c12-24 31-36 56-36s44 12 56 36" />
                <path d="M92 126h64" />
              </svg>
            </div>
            <p>Enjoy life in a crystal clean house.</p>
            <button type="button" onClick={() => navigate("/quick-booking")}>
              Post your task now
            </button>
          </section>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="booking-status-page with-mobile-nav">
      <div className="status-header">
        <button onClick={() => navigate("/")} className="home-btn">
          Back home
        </button>

        {bookingDetails.isQuickBooking && (
          <div className="quick-booking-badge">
            Quick booking
          </div>
        )}
      </div>

      <div className="status-content">
        {currentStage === "pending" ? (
          <BookingPending
            booking={bookingDetails}
            housekeeper={selectedHousekeeper}
            onCancel={handleCancel}
          />
        ) : (
          <div className="booking-completed">
            <div className="success-icon">OK</div>
            <h2>Booking completed</h2>
            <p>Thanks for using HouseHelp.</p>
            <button onClick={() => navigate("/")} className="home-button">
              Back home
            </button>
          </div>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}
