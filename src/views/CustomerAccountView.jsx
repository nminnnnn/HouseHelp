import React from "react";
import { useNavigate } from "react-router-dom";
import MobileBottomNav from "../components/MobileBottomNav";

const accountItems = [
  { label: "Personal Profile", path: "/profile?edit=1", icon: "user" },
  { label: "Saved Addresses", path: "/profile", icon: "pin" },
  { label: "Transaction history", path: "/customer/dashboard", icon: "clock" },
  { label: "My Rewards", path: "/profile", icon: "gift" },
  { label: "Favorite Taskers", path: "/housekeepers", icon: "heart" },
  { label: "Block List", path: "/profile", icon: "block" },
  { label: "Create a Business account", path: "/register", icon: "business" }
];

const utilityItems = [
  { label: "HouseHelp Pay", path: "/profile", icon: "wallet" },
  { label: "Language", path: "/settings/language", icon: "globe" },
  { label: "Help Center", path: "/chat", icon: "help" }
];

function Icon({ name }) {
  const paths = {
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
    pin: "M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    gift: "M20 12v8H4v-8M3 8h18v4H3V8ZM12 8v12M7.5 8A2.5 2.5 0 1 1 12 6v2M16.5 8A2.5 2.5 0 1 0 12 6v2",
    heart: "M20.5 8.8c0 5.1-8.5 10.2-8.5 10.2S3.5 13.9 3.5 8.8A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 1.6Z",
    block: "M6 6h12v14H6V6ZM9 3h6l1 3H8l1-3ZM9 11l6 6M15 11l-6 6",
    business: "M4 21V8h6v13M10 21V3h10v18M7 12h.01M7 16h.01M14 7h.01M17 7h.01M14 11h.01M17 11h.01M14 15h.01M17 15h.01",
    wallet: "M3 7a2 2 0 0 1 2-2h14v14H5a2 2 0 0 1-2-2V7ZM16 12h3",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
    help: "M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.9.6-1.6 1.1-1.6 2.1M12 17h.01"
  };

  return (
    <span className="account-row-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}

function AccountRow({ item }) {
  const navigate = useNavigate();

  return (
    <button type="button" className="account-row" onClick={() => navigate(item.path)}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
      <svg className="account-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

export default function CustomerAccountView({ user, profileData, loading, onEdit }) {
  const displayName = profileData?.fullName || user?.fullName || "HouseHelp User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mobile-account-page">
      <main className="mobile-account-content">
        <h1>Account</h1>

        <section className="account-identity">
          <div className="account-avatar">{initials}</div>
          <div>
            <h2>{loading ? "Loading..." : displayName}</h2>
            <button type="button" className="member-pill" onClick={onEdit}>
              Member tier
            </button>
          </div>
        </section>

        <section className="account-section">
          <h3>Account</h3>
          {accountItems.map((item) => (
            <AccountRow key={item.label} item={item} />
          ))}
        </section>

        <section className="account-section">
          <h3>Utilities</h3>
          {utilityItems.map((item) => (
            <AccountRow key={item.label} item={item} />
          ))}
        </section>
      </main>
      <MobileBottomNav />
    </div>
  );
}
