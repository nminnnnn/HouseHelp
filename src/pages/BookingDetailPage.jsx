import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../hooks/useAuth";
import { useBooking } from "../contexts/BookingContext";
import { getHousekeeperById } from "../api/housekeeperApi";
import translations from "../locales/translations";
import BookingDetailView from "../views/Booking/BookingDetailView";
import "./BookingDetailPage.css";

export default function BookingDetailPage() {
  const { housekeeperId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { isAuthenticated, requireAuth } = useAuth();
  const {
    selectedHousekeeper,
    bookingDetails,
    currentStage,
    setHousekeeper,
    createBooking,
    calculateTotalPrice,
    resetBooking
  } = useBooking();
  const t = translations[language];

  const [loading, setLoading] = useState(true);
  const [localHousekeeper, setLocalHousekeeper] = useState(null);
  
  // Đọc quickBookingData từ navigation state hoặc localStorage
  const [quickBookingData, setQuickBookingData] = useState(null);
  
  useEffect(() => {
    // Kiểm tra nếu có dữ liệu từ Quick Booking
    let data = location.state?.quickBookingData;
    
    // Nếu không có trong state, thử đọc từ localStorage
    if (!data) {
      try {
        const storedData = localStorage.getItem('quickBookingData');
        if (storedData) {
          data = JSON.parse(storedData);
          // Xóa sau khi đọc để không ảnh hưởng lần sau
          localStorage.removeItem('quickBookingData');
        }
      } catch (e) {
        console.error('Error reading quickBookingData from localStorage:', e);
      }
    }
    
    if (data) {
      console.log('📋 Quick Booking data loaded:', data);
      setQuickBookingData(data);
    }
  }, [location.state]);

  useEffect(() => {
    if (!requireAuth()) return;
    
    console.log("BookingDetailPage mounted for ID:", housekeeperId);
    console.log("selectedHousekeeper from context:", selectedHousekeeper);
    
    // If housekeeper is already in context, use it
    if (selectedHousekeeper && selectedHousekeeper.id == housekeeperId) {
      console.log("Using housekeeper from context");
      setLocalHousekeeper(selectedHousekeeper);
      setLoading(false);
    } else {
      console.log("Fetching housekeeper data for ID:", housekeeperId);
      fetchHousekeeperData();
    }
    
    // Reset booking when component unmounts - commented out for debugging
    // return () => {
    //   resetBooking();
    // };
  }, [housekeeperId, selectedHousekeeper]); // Include selectedHousekeeper in deps

  const fetchHousekeeperData = async () => {
    try {
      console.log("Fetching housekeeper with ID:", housekeeperId);
      
      // Try to get housekeeper by ID from API
      let housekeeperData = null;
      
      try {
        housekeeperData = await getHousekeeperById(housekeeperId);
        console.log("API response for housekeeper:", housekeeperData);
      } catch (apiError) {
        console.warn("Could not fetch from API, trying to find from stored data:", apiError);
        
        // Fallback: Try to get from localStorage or fetch all housekeepers
        try {
          const response = await fetch("http://localhost:5000/api/housekeepers");
          const allHousekeepers = await response.json();
          
          // Find housekeeper by ID or name
          housekeeperData = allHousekeepers.find(hk => 
            hk.id === housekeeperId || 
            hk.housekeeperId === housekeeperId ||
            hk.fullName?.replace(/\s+/g, '-').toLowerCase() === housekeeperId
          );
        } catch (fallbackError) {
          console.error("Fallback fetch failed:", fallbackError);
        }
      }

      if (housekeeperData) {
        // Process the data to ensure all required fields
        const processedHousekeeper = {
          id: housekeeperData.id || housekeeperData.housekeeperId || housekeeperId,
          fullName: housekeeperData.fullName || housekeeperData.name || "Unknown Housekeeper",
          rating: parseFloat(housekeeperData.rating) || 4.5,
          reviewCount: parseInt(housekeeperData.reviewCount) || 0,
          price: parseFloat(housekeeperData.price) || 25,
          services: Array.isArray(housekeeperData.services) 
            ? housekeeperData.services 
            : (housekeeperData.services || "").split(",").map(s => s.trim()).filter(Boolean),
          avatar: housekeeperData.avatar || getInitials(housekeeperData.fullName || housekeeperData.name),
          experience: housekeeperData.experience || "Professional housekeeper",
          backgroundChecked: housekeeperData.backgroundChecked !== false,
          insured: housekeeperData.insured !== false,
          location: housekeeperData.location || housekeeperData.address || "Location not specified",
          bio: housekeeperData.bio || housekeeperData.description || "Professional housekeeper with experience.",
          phone: housekeeperData.phone || housekeeperData.phoneNumber || "+1 (555) 123-4567",
          availability: housekeeperData.availability || "Available today"
        };
        
        setHousekeeper(processedHousekeeper);
        setLocalHousekeeper(processedHousekeeper); // Also set local state
        console.log("Successfully set housekeeper in context and local state:", processedHousekeeper);
      } else {
        console.error("Housekeeper not found");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching housekeeper:", error);
      setLoading(false);
    }
  };

  // Helper function to get initials from name
  const getInitials = (name) => {
    if (!name) return "HK";
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleBookingSubmit = async (bookingData, appliedCoupon = null) => {
    try {
      await createBooking(bookingData, appliedCoupon);
    } catch (error) {
      console.error("Booking error:", error);
      // Error is handled in BookingContext
    }
  };

  const handleBackToHome = () => {
    resetBooking();
    navigate("/");
  };

  const displayHousekeeper = localHousekeeper || selectedHousekeeper;
  
  console.log("Current displayHousekeeper:", displayHousekeeper);
  console.log("Loading state:", loading);

  // Show loading while fetching
  if (loading) {
    console.log("Showing loading state");
    return (
      <div className="booking-page-loading">
        <div className="loading-spinner"></div>
        <p>{t.loading || "Loading..."}</p>
      </div>
    );
  }

  // Show error only if definitely no housekeeper after loading
  if (!displayHousekeeper) {
    console.log("No housekeeper after loading, showing error page");
    return (
      <div className="booking-page-error">
        <p>{t.housekeeperNotFound || "Housekeeper not found"}</p>
        <button onClick={handleBackToHome} className="back-home-btn">
          {t.backToHome || "Back to Home"}
        </button>
      </div>
    );
  }

  // Show booking detail
  console.log("Rendering BookingDetailView with housekeeper:", displayHousekeeper.fullName);
  console.log("Quick booking data to prefill:", quickBookingData);
  return (
    <div className="booking-detail-page">
      <BookingDetailView
        housekeeper={displayHousekeeper}
        booking={bookingDetails}
        bookingStage={currentStage}
        onBookingSubmit={handleBookingSubmit}
        onBack={handleBackToHome}
        calculateTotalPrice={(details) => calculateTotalPrice(details, displayHousekeeper)}
        prefillData={quickBookingData}
      />
    </div>
  );
}
