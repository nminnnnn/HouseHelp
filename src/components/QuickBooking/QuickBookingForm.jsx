import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import "./QuickBookingForm.css";

export default function QuickBookingForm({ onSubmit, loading = false }) {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    service: "",
    date: "",
    time: "",
    duration: 2,
    location: "",
    notes: "",
    maxPrice: 50, // Giá tối đa khách hàng sẵn sàng trả
    urgency: "normal" // normal, urgent, asap
  });

  const [errors, setErrors] = useState({});
  const [services, setServices] = useState([]);

  // Fetch services from API
  useEffect(() => {
    fetch('http://localhost:5000/api/filters/services')
      .then(res => res.json())
      .then(data => {
        console.log('📋 Loaded services for Quick Booking:', data);
        setServices(data);
      })
      .catch(error => {
        console.error('❌ Error loading services:', error);
        // Fallback to hardcoded services
        setServices([
          "Vệ sinh nhà cửa",
          "Giặt ủi quần áo", 
          "Nấu ăn",
          "Chăm sóc trẻ em",
          "Chăm sóc người già",
          "Làm vườn",
          "Vệ sinh công nghiệp"
        ]);
      });
  }, []);

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  const durationOptions = [
    { value: 1, label: "1 giờ" },
    { value: 2, label: "2 giờ" },
    { value: 3, label: "3 giờ" },
    { value: 4, label: "4 giờ" },
    { value: 6, label: "6 giờ" },
    { value: 8, label: "8 giờ" }
  ];

  const urgencyOptions = [
    { value: "normal", label: "Bình thường", description: "Trong vòng 24h" },
    { value: "urgent", label: "Khẩn cấp", description: "Trong vòng 6h" },
    { value: "asap", label: "Càng sớm càng tốt", description: "Trong vòng 2h" }
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
      newErrors.service = "Vui lòng chọn dịch vụ";
    }
    if (!formData.date) {
      newErrors.date = "Vui lòng chọn ngày";
    }
    if (!formData.time) {
      newErrors.time = "Vui lòng chọn giờ";
    }
    if (!formData.location.trim()) {
      newErrors.location = "Vui lòng nhập địa chỉ";
    }
    if (formData.maxPrice < 20) {
      newErrors.maxPrice = "Giá tối thiểu là $20/giờ";
    }

    // Check if date is not in the past
    if (formData.date) {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.date = "Không thể chọn ngày trong quá khứ";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      const quickBookingData = {
        ...formData,
        customerName: user?.fullName || (user?.firstName + " " + user?.lastName) || "Customer",
        customerEmail: user?.email || "",
        customerPhone: user?.phoneNumber || user?.phone || "",
        customerId: user?.id,
        isQuickBooking: true
      };
      
      onSubmit(quickBookingData);
    }
  };

  const estimatedPrice = formData.duration * 30 + 10; // Ước tính giá cơ bản

  return (
    <div className="quick-booking-form-container">
      <div className="quick-booking-header">
        <h2>⚡ Đặt Dịch Vụ Nhanh</h2>
        <p>Hệ thống sẽ tự động tìm người giúp việc phù hợp nhất cho bạn</p>
      </div>
      
      <form onSubmit={handleSubmit} className="quick-booking-form">
        {/* Service Selection */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Dịch vụ cần thuê</span>
            <span className="required">*</span>
          </label>
          <select
            value={formData.service}
            onChange={(e) => handleInputChange("service", e.target.value)}
            className={`form-select ${errors.service ? "error" : ""}`}
          >
            <option value="">Chọn dịch vụ</option>
            {services.map((service, index) => (
              <option key={index} value={service}>
                {service}
              </option>
            ))}
          </select>
          {errors.service && <span className="error-text">{errors.service}</span>}
        </div>

        {/* Date and Time Row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Ngày</span>
              <span className="required">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              className={`form-input ${errors.date ? "error" : ""}`}
              min={new Date().toISOString().split('T')[0]}
            />
            {errors.date && <span className="error-text">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-text">Giờ</span>
              <span className="required">*</span>
            </label>
            <select
              value={formData.time}
              onChange={(e) => handleInputChange("time", e.target.value)}
              className={`form-select ${errors.time ? "error" : ""}`}
            >
              <option value="">Chọn giờ</option>
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {errors.time && <span className="error-text">{errors.time}</span>}
          </div>
        </div>

        {/* Duration Selection */}
        <div className="form-group">
          <label className="form-label">Thời gian làm việc</label>
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

        {/* Urgency Level */}
        <div className="form-group">
          <label className="form-label">Mức độ khẩn cấp</label>
          <div className="urgency-options">
            {urgencyOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => handleInputChange("urgency", option.value)}
                className={`urgency-option ${formData.urgency === option.value ? "selected" : ""}`}
              >
                <div className="urgency-label">{option.label}</div>
                <div className="urgency-description">{option.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Max Price */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Giá tối đa sẵn sàng trả ($/giờ)</span>
            <span className="current-price">${formData.maxPrice}</span>
          </label>
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            value={formData.maxPrice}
            onChange={(e) => handleInputChange("maxPrice", parseInt(e.target.value))}
            className="price-slider"
          />
          <div className="price-range">
            <span>$20</span>
            <span>$100</span>
          </div>
          {errors.maxPrice && <span className="error-text">{errors.maxPrice}</span>}
        </div>

        {/* Location */}
        <div className="form-group">
          <label className="form-label">
            <span className="label-text">Địa chỉ</span>
            <span className="required">*</span>
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleInputChange("location", e.target.value)}
            placeholder="Nhập địa chỉ của bạn"
            className={`form-input ${errors.location ? "error" : ""}`}
          />
          {errors.location && <span className="error-text">{errors.location}</span>}
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Ghi chú đặc biệt (Tùy chọn)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Thêm yêu cầu đặc biệt..."
            className="form-textarea"
            rows="3"
          />
        </div>

        {/* Price Estimate */}
        <div className="price-estimate">
          <div className="estimate-header">
            <h3>Ước tính chi phí</h3>
            <div className="estimate-total">${estimatedPrice}</div>
          </div>
          <div className="estimate-breakdown">
            <div className="estimate-item">
              <span>Dịch vụ ({formData.duration}h × ~$30/h)</span>
              <span>${formData.duration * 30}</span>
            </div>
            <div className="estimate-item">
              <span>Phí dịch vụ</span>
              <span>$10</span>
            </div>
          </div>
          <div className="estimate-note">
            *Giá cuối cùng phụ thuộc vào người giúp việc được chọn
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit" 
          className="quick-booking-submit"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="loading-spinner"></div>
              Đang tìm người giúp việc...
            </>
          ) : (
            <>
              ⚡ Tìm Người Giúp Việc Ngay
            </>
          )}
        </button>
      </form>
    </div>
  );
}
