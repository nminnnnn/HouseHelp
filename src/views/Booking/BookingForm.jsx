import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import translations from "../../locales/translations";
import CouponInput from "../../components/Booking/CouponInput";
import "./BookingForm.css";

export default function BookingForm({ housekeeper, onSubmit, calculateTotalPrice, prefillData = null }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];

  const [formData, setFormData] = useState({
    service: housekeeper.services[0] || "",
    date: "",
    time: "",
    duration: 2,
    location: "",
    notes: ""
  });

  const [errors, setErrors] = useState({});
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Điền sẵn form nếu có prefillData từ Quick Booking
  useEffect(() => {
    if (prefillData) {
      console.log('📝 Prefilling form with Quick Booking data:', prefillData);
      setFormData(prev => ({
        ...prev,
        service: prefillData.service || prev.service,
        date: prefillData.date || prev.date,
        time: prefillData.time || prev.time,
        duration: prefillData.duration || prev.duration,
        location: prefillData.location || prev.location,
        notes: prefillData.notes || prev.notes
      }));
    }
  }, [prefillData]);

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  const durationOptions = [
    { value: 1, label: "1 hour" },
    { value: 2, label: "2 hours" },
    { value: 3, label: "3 hours" },
    { value: 4, label: "4 hours" },
    { value: 6, label: "6 hours" },
    { value: 8, label: "8 hours" }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.service) {
      newErrors.service = t.serviceRequired || "Service is required";
    }
    if (!formData.date) {
      newErrors.date = t.dateRequired || "Date is required";
    }
    if (!formData.time) {
      newErrors.time = t.timeRequired || "Time is required";
    }
    if (!formData.location.trim()) {
      newErrors.location = t.locationRequired || "Location is required";
    }

    // Check if date is not in the past
    if (formData.date) {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.date = t.dateCannotBePast || "Date cannot be in the past";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Include customer information in the booking data
      const bookingDataWithCustomer = {
        ...formData,
        customerId: user?.id,
        customerName: user?.fullName || (user?.firstName + " " + user?.lastName) || "Customer",
        customerEmail: user?.email || "",
        customerPhone: user?.phoneNumber || user?.phone || "",
        housekeeperName: housekeeper?.fullName || "",
        housekeeperId: housekeeper?.id || ""
      };
      
      onSubmit(bookingDataWithCustomer, appliedCoupon);
    }
  };

  const basePrice = calculateTotalPrice(formData);
  const totalPrice = appliedCoupon ? appliedCoupon.finalAmount : basePrice;

  const handleCouponApplied = (couponData) => {
    setAppliedCoupon(couponData);
  };

  return (
    <div className="booking-form-container">
      <h2 className="form-title">{t.bookingDetails || "Booking Details"}</h2>
      
      <form onSubmit={handleSubmit} className="booking-form">
        {/* Service Selection */}
        <div className="form-group">
          <label className="form-label">{t.service || "Service"}</label>
          <select
            value={formData.service}
            onChange={(e) => handleInputChange("service", e.target.value)}
            className={`form-select ${errors.service ? "error" : ""}`}
          >
            <option value="">{t.selectService || "Select a service"}</option>
            {housekeeper.services.map((service, index) => (
              <option key={index} value={service}>
                {service}
              </option>
            ))}
          </select>
          {errors.service && <span className="error-text">{errors.service}</span>}
        </div>

        {/* Date Selection */}
        <div className="form-group">
          <label className="form-label">{t.date || "Date"}</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange("date", e.target.value)}
            className={`form-input ${errors.date ? "error" : ""}`}
            min={new Date().toISOString().split('T')[0]}
          />
          {errors.date && <span className="error-text">{errors.date}</span>}
        </div>

        {/* Time Selection */}
        <div className="form-group">
          <label className="form-label">{t.time || "Time"}</label>
          <div className="time-slots-grid">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => handleInputChange("time", slot)}
                className={`time-slot ${formData.time === slot ? "selected" : ""}`}
              >
                {slot}
              </button>
            ))}
          </div>
          {errors.time && <span className="error-text">{errors.time}</span>}
        </div>

        {/* Duration Selection */}
        <div className="form-group">
          <label className="form-label">{t.duration || "Duration"}</label>
          <div className="duration-options">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleInputChange("duration", option.value)}
                className={`duration-option ${formData.duration === option.value ? "selected" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="form-group">
          <label className="form-label">{t.location || "Location"}</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleInputChange("location", e.target.value)}
            placeholder={t.enterYourAddress || "Enter your address"}
            className={`form-input ${errors.location ? "error" : ""}`}
          />
          {errors.location && <span className="error-text">{errors.location}</span>}
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">{t.specialInstructions || "Special Instructions"} ({t.optional || "Optional"})</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder={t.addSpecialInstructions || "Add any special instructions..."}
            className="form-textarea"
            rows="3"
          />
        </div>

        {/* Coupon Input */}
        <CouponInput 
          totalAmount={basePrice}
          onCouponApplied={handleCouponApplied}
        />

        {/* Price Breakdown */}
        <div className="price-breakdown">
          <h3>{t.priceBreakdown || "Price Breakdown"}</h3>
          <div className="price-item">
            <span>{t.service || "Service"} ({formData.duration} {formData.duration === 1 ? "hour" : "hours"} × ${housekeeper.price}/hr)</span>
            <span>${(housekeeper.price * formData.duration).toFixed(2)}</span>
          </div>
          <div className="price-item">
            <span>{t.platformFee || "Platform fee"}</span>
            <span>$5.00</span>
          </div>
          <div className="price-item">
            <span>{t.serviceFee || "Service fee"}</span>
            <span>$5.00</span>
          </div>
          
          {appliedCoupon && (
            <div className="price-item discount">
              <span>🎫 {appliedCoupon.coupon.description}</span>
              <span className="discount-amount">-${appliedCoupon.discountAmount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="price-total">
            <span>{t.total || "Total"}</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button type="submit" className="submit-button">
          {t.confirmBooking || "Confirm Booking"} - ${totalPrice.toFixed(2)}
        </button>
      </form>
    </div>
  );
}
