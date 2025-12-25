import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import translations from "../../locales/translations";
import BookingForm from "./BookingForm";
import BookingProcess from "./BookingProcess";
import BookingCompleted from "./BookingCompleted";
import BookingPending from "./BookingPending";
import RatingStars from "../Common/RatingStars";
import "./BookingDetailView.css";

export default function BookingDetailView({
  housekeeper,
  booking,
  bookingStage,
  onBookingSubmit,
  onBack,
  calculateTotalPrice,
  prefillData = null
}) {
  const { language } = useLanguage();
  const t = translations[language];

  const renderContent = () => {
    console.log('BookingDetailView renderContent, bookingStage:', bookingStage);
    console.log('BookingDetailView booking data:', booking);
    
    switch (bookingStage) {
      case "pending":
        console.log('Rendering BookingPending component');
        return (
          <BookingPending
            housekeeper={housekeeper}
            booking={booking}
            onCancel={onBack}
          />
        );
      case "processing":
        return (
          <BookingProcess
            housekeeper={housekeeper}
            booking={booking}
          />
        );
      case "completed":
        return (
          <BookingCompleted
            housekeeper={housekeeper}
            booking={booking}
            onBack={onBack}
          />
        );
      default:
        return (
          <div className="booking-detail-container">
            {/* Header */}
            <div className="booking-header">
              <button className="back-button" onClick={onBack}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h1 className="booking-title">{t.bookingDetails || "Booking Details"}</h1>
            </div>

            {/* Housekeeper Info */}
            <div className="housekeeper-info-section">
              <div className="housekeeper-card-booking">
                <div className="hk-avatar-large">{housekeeper.avatar}</div>
                <div className="hk-details">
                  <h2 className="hk-name">{housekeeper.fullName}</h2>
                  <div className="hk-rating">
                    <RatingStars rating={housekeeper.rating} />
                    <span className="rating-text">
                      {housekeeper.rating} ({housekeeper.reviewCount} {t.reviews})
                    </span>
                  </div>
                  <div className="hk-experience">{housekeeper.experience}</div>
                  <div className="hk-badges">
                    {housekeeper.backgroundChecked && (
                      <span className="badge verified">
                        ✓ {t.verifiedChecked || "Verified & Background Checked"}
                      </span>
                    )}
                    {housekeeper.insured && (
                      <span className="badge insured">
                        🛡️ {t.secureInsured || "Secure & Insured"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="hk-price-section">
                  <span className="price-amount">${housekeeper.price}</span>
                  <span className="price-unit">/hr</span>
                </div>
              </div>

              {/* Services */}
              <div className="services-section">
                <h3>{t.services || "Services"}</h3>
                <div className="services-grid">
                  {housekeeper.services.map((service, index) => (
                    <div key={index} className="service-item">
                      <span className="service-icon">🏠</span>
                      <span className="service-name">{service}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <BookingForm
              housekeeper={housekeeper}
              onSubmit={onBookingSubmit}
              calculateTotalPrice={calculateTotalPrice}
              prefillData={prefillData}
            />
          </div>
        );
    }
  };

  return (
    <div className="booking-detail-view">
      {renderContent()}
    </div>
  );
}

