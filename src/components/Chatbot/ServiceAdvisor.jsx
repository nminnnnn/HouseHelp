import React, { useState, useEffect } from 'react';
import { authHeaders } from '../../api/userApi';
import './ServiceAdvisor.css';

const ServiceAdvisor = ({ onServiceSelect, onComboRecommend, userContext }) => {
  const [_services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [preferences, setPreferences] = useState({
    budget: '',
    frequency: 'weekly',
    duration: '',
    location: userContext?.location || 'TP.HCM'
  });
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Danh sách dịch vụ với thông tin chi tiết
  const serviceDetails = {
    'Vệ sinh nhà cửa': {
      icon: '🏠',
      description: 'Dọn dẹp, lau chùi, hút bụi toàn bộ ngôi nhà',
      priceRange: '60,000 - 100,000 VNĐ/giờ',
      duration: '2-4 giờ',
      suitable: ['Gia đình bận rộn', 'Nhà có diện tích lớn', 'Cần vệ sinh định kỳ']
    },
    'Nấu ăn': {
      icon: '👨‍🍳',
      description: 'Nấu các bữa ăn theo yêu cầu, mua sắm nguyên liệu',
      priceRange: '80,000 - 120,000 VNĐ/giờ',
      duration: '1-3 giờ',
      suitable: ['Gia đình có trẻ nhỏ', 'Người bận công việc', 'Cần bữa ăn dinh dưỡng']
    },
    'Trông trẻ': {
      icon: '👶',
      description: 'Chăm sóc, vui chơi, giáo dục trẻ em',
      priceRange: '50,000 - 80,000 VNĐ/giờ',
      duration: '4-8 giờ',
      suitable: ['Cha mẹ đi làm', 'Cần người chăm sóc chuyên nghiệp', 'Trẻ cần kỹ năng xã hội']
    },
    'Giặt ủi': {
      icon: '👔',
      description: 'Giặt, phơi, ủi quần áo và đồ vải',
      priceRange: '40,000 - 60,000 VNĐ/giờ',
      duration: '2-3 giờ',
      suitable: ['Gia đình đông người', 'Quần áo công sở', 'Tiết kiệm thời gian']
    },
    'Vệ sinh công nghiệp': {
      icon: '🏢',
      description: 'Vệ sinh văn phòng, nhà xưởng, công trình',
      priceRange: '70,000 - 150,000 VNĐ/giờ',
      duration: '3-6 giờ',
      suitable: ['Văn phòng', 'Nhà xưởng', 'Cửa hàng kinh doanh']
    },
    'Chăm sóc người già': {
      icon: '👴',
      description: 'Chăm sóc, đồng hành, hỗ trợ sinh hoạt',
      priceRange: '60,000 - 100,000 VNĐ/giờ',
      duration: '4-12 giờ',
      suitable: ['Người già cần hỗ trợ', 'Gia đình bận rộn', 'Chăm sóc y tế cơ bản']
    }
  };

  useEffect(() => {
    // Lấy danh sách dịch vụ từ API
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/filters/services');
      const data = await response.json();
      setServices(data);
    } catch (error) {
      console.error('Error fetching services:', error);
      // Fallback to predefined services
      setServices(Object.keys(serviceDetails));
    }
  };

  const handleServiceToggle = (service) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getRecommendations = async () => {
    if (selectedServices.length === 0) {
      alert('Vui lòng chọn ít nhất một dịch vụ');
      return;
    }

    setLoading(true);
    try {
      // Gọi API để lấy gợi ý combo
      const response = await fetch('http://localhost:5000/api/chatbot/combo-recommendations', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          services: selectedServices,
          frequency: preferences.frequency,
          budget: preferences.budget,
          location: preferences.location
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        
        // Gửi thông tin về parent component
        if (onComboRecommend) {
          onComboRecommend(data.recommendations, selectedServices, preferences);
        }
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedCost = (service) => {
    const details = serviceDetails[service];
    if (!details) return null;

    const priceRange = details.priceRange.match(/([0-9,]+)/g);
    if (!priceRange || priceRange.length < 2) return null;

    const minPrice = parseInt(priceRange[0].replace(/,/g, ''));
    const maxPrice = parseInt(priceRange[1].replace(/,/g, ''));
    const avgPrice = (minPrice + maxPrice) / 2;

    const duration = parseFloat(preferences.duration) || 3;
    const estimatedCost = avgPrice * duration;

    return {
      hourlyRate: avgPrice,
      totalCost: estimatedCost,
      formattedCost: new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(estimatedCost)
    };
  };

  return (
    <div className="service-advisor">
      <div className="advisor-header">
        <h3>🎯 Tư vấn dịch vụ phù hợp</h3>
        <p>Chọn dịch vụ và để chúng tôi gợi ý gói combo tốt nhất cho bạn</p>
      </div>

      {/* Service Selection */}
      <div className="service-selection">
        <h4>Chọn dịch vụ bạn quan tâm:</h4>
        <div className="services-grid">
          {Object.entries(serviceDetails).map(([service, details]) => (
            <div 
              key={service}
              className={`service-card ${selectedServices.includes(service) ? 'selected' : ''}`}
              onClick={() => handleServiceToggle(service)}
            >
              <div className="service-icon">{details.icon}</div>
              <div className="service-info">
                <h5>{service}</h5>
                <p className="service-description">{details.description}</p>
                <div className="service-price">{details.priceRange}</div>
                <div className="service-duration">⏱️ {details.duration}</div>
                
                {selectedServices.includes(service) && preferences.duration && (
                  <div className="estimated-cost">
                    {(() => {
                      const cost = calculateEstimatedCost(service);
                      return cost ? (
                        <span className="cost-estimate">
                          Dự kiến: {cost.formattedCost}
                        </span>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
              <div className="service-check">
                {selectedServices.includes(service) && '✓'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preferences */}
      {selectedServices.length > 0 && (
        <div className="preferences-section">
          <h4>Thông tin thêm:</h4>
          <div className="preferences-grid">
            <div className="preference-item">
              <label>Ngân sách mong muốn:</label>
              <select 
                value={preferences.budget} 
                onChange={(e) => handlePreferenceChange('budget', e.target.value)}
              >
                <option value="">Chọn ngân sách</option>
                <option value="under-500k">Dưới 500,000 VNĐ</option>
                <option value="500k-1m">500,000 - 1,000,000 VNĐ</option>
                <option value="1m-2m">1,000,000 - 2,000,000 VNĐ</option>
                <option value="over-2m">Trên 2,000,000 VNĐ</option>
              </select>
            </div>

            <div className="preference-item">
              <label>Tần suất sử dụng:</label>
              <select 
                value={preferences.frequency} 
                onChange={(e) => handlePreferenceChange('frequency', e.target.value)}
              >
                <option value="once">Một lần</option>
                <option value="weekly">Hàng tuần</option>
                <option value="biweekly">2 tuần/lần</option>
                <option value="monthly">Hàng tháng</option>
                <option value="daily">Hàng ngày</option>
              </select>
            </div>

            <div className="preference-item">
              <label>Thời gian dự kiến (giờ):</label>
              <input 
                type="number" 
                min="1" 
                max="12" 
                value={preferences.duration}
                onChange={(e) => handlePreferenceChange('duration', e.target.value)}
                placeholder="VD: 3"
              />
            </div>

            <div className="preference-item">
              <label>Khu vực:</label>
              <input 
                type="text" 
                value={preferences.location}
                onChange={(e) => handlePreferenceChange('location', e.target.value)}
                placeholder="VD: Quận 1, TP.HCM"
              />
            </div>
          </div>

          <button 
            className="get-recommendations-btn"
            onClick={getRecommendations}
            disabled={loading}
          >
            {loading ? '⏳ Đang phân tích...' : '🎯 Nhận gợi ý combo'}
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h4>💡 Gợi ý gói combo cho bạn:</h4>
          <div className="recommendations-list">
            {recommendations.map((combo, index) => (
              <div key={index} className="combo-card">
                <div className="combo-header">
                  <h5>{combo.name}</h5>
                  <span className="combo-discount">{combo.discount} OFF</span>
                </div>
                <div className="combo-services">
                  <strong>Bao gồm:</strong> {combo.services.join(', ')}
                </div>
                <div className="combo-frequency">
                  <strong>Tần suất:</strong> {combo.frequency}
                </div>
                <div className="combo-price">
                  <strong>Giá:</strong> {combo.monthlyPrice}/tháng
                </div>
                <button 
                  className="select-combo-btn"
                  onClick={() => onServiceSelect && onServiceSelect(combo)}
                >
                  Chọn gói này
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Details */}
      {selectedServices.length > 0 && (
        <div className="selected-services-summary">
          <h4>📋 Tóm tắt dịch vụ đã chọn:</h4>
          {selectedServices.map(service => {
            const details = serviceDetails[service];
            return (
              <div key={service} className="service-summary">
                <div className="summary-header">
                  <span className="summary-icon">{details.icon}</span>
                  <strong>{service}</strong>
                </div>
                <div className="summary-details">
                  <div>💰 {details.priceRange}</div>
                  <div>⏱️ {details.duration}</div>
                </div>
                <div className="suitable-for">
                  <strong>Phù hợp với:</strong>
                  <ul>
                    {details.suitable.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiceAdvisor;

