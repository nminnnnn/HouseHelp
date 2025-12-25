import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useBooking } from "../contexts/BookingContext";
import QuickBookingForm from "../components/QuickBooking/QuickBookingForm";
import QuickBookingResult from "../components/QuickBooking/QuickBookingResult";
import "./QuickBookingPage.css";

export default function QuickBookingPage() {
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const { createBooking, findMatchingHousekeepers: findMatches, createQuickBooking } = useBooking();
  
  const [currentStep, setCurrentStep] = useState("form"); // form, searching, results
  const [bookingData, setBookingData] = useState(null);
  const [matchedHousekeepers, setMatchedHousekeepers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check authentication
  React.useEffect(() => {
    if (!requireAuth()) {
      navigate("/login");
    }
  }, [requireAuth, navigate]);

  // Quick booking matching algorithm using API
  const findMatchingHousekeepers = async (formData) => {
    try {
      setLoading(true);
      setCurrentStep("searching");

      // Simulate search delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('🔍 Searching for housekeepers with criteria:', formData);

      // Use the BookingContext method to find matches
      const matches = await findMatches({
        service: formData.service,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        location: formData.location,
        maxPrice: formData.maxPrice,
        urgency: formData.urgency,
        customerId: formData.customerId
      });

      console.log('✅ Found matches:', matches);
      
      // Nếu tìm được ít nhất 1 người giúp việc phù hợp, tự động chuyển sang trang booking
      if (matches && matches.length > 0) {
        const bestMatch = matches[0]; // Lấy người phù hợp nhất
        console.log('🚀 Auto-redirecting to booking page for:', bestMatch.fullName);
        
        // Lưu thông tin đã điền vào localStorage để trang booking có thể đọc
        const quickBookingData = {
          service: formData.service,
          date: formData.date,
          time: formData.time,
          duration: formData.duration,
          location: formData.location,
          notes: formData.notes || '',
          maxPrice: formData.maxPrice,
          urgency: formData.urgency,
          isQuickBooking: true
        };
        localStorage.setItem('quickBookingData', JSON.stringify(quickBookingData));
        
        // Navigate đến trang booking của housekeeper được chọn
        navigate(`/booking/${bestMatch.id}`, {
          state: { quickBookingData }
        });
        return;
      }
      
      // Nếu không tìm được ai, hiện kết quả trống
      setMatchedHousekeepers(matches);
      setCurrentStep("results");
      
    } catch (error) {
      console.error('❌ Error finding housekeepers:', error);
      setMatchedHousekeepers([]);
      setCurrentStep("results");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    console.log('Quick booking form submitted:', formData);
    setBookingData(formData);
    await findMatchingHousekeepers(formData);
  };

  const handleConfirmBooking = async (selectedHousekeeper, bookingData) => {
    try {
      console.log('⚡ Confirming quick booking with:', selectedHousekeeper.fullName);
      
      // Use the specialized quick booking method
      const booking = await createQuickBooking(bookingData, selectedHousekeeper);
      console.log('✅ Quick booking created:', booking);
      
      // Navigate to booking status page
      navigate('/booking-status');
      
    } catch (error) {
      console.error('❌ Error creating quick booking:', error);
      // Error handling is done in BookingContext
    }
  };

  const calculateTotalPrice = (housekeeper, bookingData) => {
    const basePrice = housekeeper.price * bookingData.duration;
    const platformFee = 5.00;
    const serviceFee = 5.00;
    return basePrice + platformFee + serviceFee;
  };

  const handleBackToForm = () => {
    setCurrentStep("form");
    setMatchedHousekeepers([]);
    setBookingData(null);
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "form":
        return (
          <QuickBookingForm 
            onSubmit={handleFormSubmit}
            loading={loading}
          />
        );
      
      case "searching":
      case "results":
        return (
          <QuickBookingResult
            matchedHousekeepers={matchedHousekeepers}
            bookingData={bookingData}
            onConfirmBooking={handleConfirmBooking}
            onBack={handleBackToForm}
            loading={currentStep === "searching"}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="quick-booking-page">
      <div className="page-header">
        <button 
          onClick={() => navigate("/")} 
          className="home-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"/>
          </svg>
          Trang chủ
        </button>
        <div className="progress-indicator">
          <div className={`step ${currentStep === "form" ? "active" : currentStep !== "form" ? "completed" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">Yêu cầu</span>
          </div>
          <div className="step-line"></div>
          <div className={`step ${currentStep === "searching" || currentStep === "results" ? "active" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">Kết quả</span>
          </div>
        </div>
      </div>

      <div className="page-content">
        {renderCurrentStep()}
      </div>
    </div>
  );
}
