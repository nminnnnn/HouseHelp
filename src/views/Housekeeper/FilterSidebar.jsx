import React, { useEffect, useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import translations from "../../locales/translations";
import QuickBookingButton from "../../components/QuickBooking/QuickBookingButton";

export default function FilterSidebar({ onFilterChange }) {
  const { language } = useLanguage();
  const { isAuthenticated, user } = useAuth();
  const t = translations[language];

  const [services, setServices] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [priceRange, setPriceRange] = useState({ min_price: 0, max_price: 100 });
  const [filter, setFilter] = useState({
    services: [],
    exactRating: null,
    minPrice: null,
    maxPrice: null,
    available: null,
  });

  // Generate unique ID for this component instance
  const [componentId] = useState(() => Date.now() + Math.random());

  useEffect(() => {
    fetch("http://localhost:5000/api/filters/services").then(res => res.json()).then(setServices);
    fetch("http://localhost:5000/api/filters/ratings").then(res => res.json()).then(setRatings);
    fetch("http://localhost:5000/api/filters/price-range").then(res => res.json()).then(setPriceRange);
  }, []);

  useEffect(() => {
    if (onFilterChange) onFilterChange(filter);
  }, [filter, onFilterChange]);

  const handleService = s => {
    setFilter(f => ({
      ...f,
      services: f.services.includes(s)
        ? f.services.filter(x => x !== s)
        : [...f.services, s],
    }));
  };
  const handleRating = r => setFilter(f => ({ ...f, exactRating: r.value }));
  const handlePrice = e => setFilter(f => ({ ...f, maxPrice: Number(e.target.value) }));
  const handleAvailable = e => setFilter(f => ({ ...f, available: e.target.checked ? 1 : null }));
  const handleClear = () => setFilter({ services: [], exactRating: null, minPrice: null, maxPrice: null, available: null });

  return (
    <div className="filter-sidebar">
      <h3>{t.filters || "Filters"}</h3>
      <div className="filter-section">
        <div className="filter-label">{t.services || "Services"}</div>
        <div className="filter-services-list">
          {services.map((s, idx) => (
            <label className="filter-service-tag" key={`service-${componentId}-${idx}`}>
              <input type="checkbox" checked={filter.services.includes(s)} onChange={() => handleService(s)} /> {s}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-section">
        <div className="filter-label">{t.exactRating || "Rating"}</div>
        <div className="filter-rating-list">
          {ratings.map((r, idx) => (
            <label className="filter-rating-tag" key={`rating-${componentId}-${idx}`}>
              <input type="radio" name={`exactRating-${componentId}`} checked={filter.exactRating === r.value} onChange={() => handleRating(r)} />
              <span className="filter-stars">{"★".repeat(r.stars)}<span className="filter-stars-empty">{"☆".repeat(5 - r.stars)}</span></span>
              {r.label === "Any rating" ? t.anyRating || "Any rating" : r.label}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-section">
        <div className="filter-label">
          {t.priceRange || "Price Range"} ({Number(priceRange.min_price || 0).toLocaleString("vi-VN")}đ - {Number(priceRange.max_price || 0).toLocaleString("vi-VN")}đ)
        </div>
        <input type="range" min={priceRange.min_price} max={priceRange.max_price} value={filter.maxPrice || priceRange.max_price} onChange={handlePrice} className="filter-slider" />
      </div>
      <div className="filter-section">
        <div className="filter-label">{t.availability || "Availability"}</div>
        <label className="filter-checkbox">
          <input type="checkbox" checked={!!filter.available} onChange={handleAvailable} /> {t.availableToday || "Available today"}
        </label>
      </div>
      <button className="btn clear-filters" onClick={handleClear}>{t.clearAllFilters || "Clear All Filters"}</button>
      
      {/* Quick Booking Button - Only show for authenticated customers */}
      {isAuthenticated && user?.role === 'customer' && (
        <div className="filter-section">
          <QuickBookingButton />
        </div>
      )}
    </div>
  );
}
