import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  {
    label: "Home",
    path: "/",
    match: ["/", "/housekeepers"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />
      </svg>
    )
  },
  {
    label: "Activity",
    path: "/booking-status",
    match: ["/booking-status", "/customer/dashboard"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    )
  },
  {
    label: "AI",
    path: "/quick-booking",
    isCenter: true,
    match: ["/quick-booking"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 9h8a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4Z" />
        <path d="M9 9V6M15 9V6M9 14h.01M15 14h.01M10 17h4" />
      </svg>
    )
  },
  {
    label: "Community",
    path: "/chat",
    match: ["/chat"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a4 4 0 0 1 4-4h2M15 17h2a4 4 0 0 1 4 4M12 21a4 4 0 0 1 8 0" />
      </svg>
    )
  },
  {
    label: "Account",
    path: "/profile",
    match: ["/profile", "/settings/language"],
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
      </svg>
    )
  }
];

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav" aria-label="Customer navigation">
      {navItems.map((item) => {
        const active = item.match.some((path) =>
          path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
        );

        return (
          <button
            key={item.label}
            type="button"
            className={`mobile-nav-item ${active ? "active" : ""} ${item.isCenter ? "center-action" : ""}`}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
