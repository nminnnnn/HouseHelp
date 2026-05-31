import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileBottomNav from "../components/MobileBottomNav";
import { useAuth } from "../hooks/useAuth";

const accountItems = [
  { label: "Personal Profile", action: "edit", icon: "user" },
  { label: "Saved Addresses", panel: "addresses", icon: "pin" },
  { label: "Transaction history", path: "/customer/dashboard", icon: "clock" },
  { label: "My Rewards", panel: "rewards", icon: "gift" },
  { label: "Favorite Taskers", path: "/housekeepers", icon: "heart" },
  { label: "Block List", panel: "blockList", icon: "block" },
  { label: "Create a Business account", panel: "business", icon: "business" }
];

const utilityItems = [
  { label: "HouseHelp Pay", panel: "pay", icon: "wallet" },
  { label: "Language", path: "/settings/language", icon: "globe" },
  { label: "Help Center", path: "/chat", icon: "help" },
  { label: "Sign out", action: "logout", icon: "logout" }
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
    help: "M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.9.6-1.6 1.1-1.6 2.1M12 17h.01",
    logout: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
  };

  return (
    <span className="account-row-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}

function AccountRow({ item, onSelect }) {
  return (
    <button type="button" className="account-row" onClick={() => onSelect(item)}>
      <Icon name={item.icon} />
      <span>{item.label}</span>
      <svg className="account-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

function InfoPanel({ activePanel, profileData, onClose, onEdit, onNavigate }) {
  if (!activePanel) return null;

  const addressParts = [profileData?.address, profileData?.district, profileData?.city].filter(Boolean);
  const address = addressParts.join(", ");

  const panelContent = {
    addresses: {
      title: "Saved Addresses",
      body: (
        <>
          <div className="account-detail-card">
            <strong>Home</strong>
            <p>{address || "No saved address yet."}</p>
          </div>
          <button type="button" className="account-primary-action" onClick={onEdit}>
            Update address
          </button>
        </>
      )
    },
    rewards: {
      title: "My Rewards",
      body: (
        <>
          <div className="account-detail-card">
            <strong>0 points</strong>
            <p>Rewards will appear here after completed bookings and promotions.</p>
          </div>
          <button type="button" className="account-primary-action" onClick={() => onNavigate("/housekeepers")}>
            Book a service
          </button>
        </>
      )
    },
    blockList: {
      title: "Block List",
      body: (
        <div className="account-empty-state">
          <strong>No blocked taskers</strong>
          <p>When you block a tasker, they will be listed here.</p>
        </div>
      )
    },
    business: {
      title: "Business Account",
      body: (
        <>
          <div className="account-detail-card">
            <strong>Create a separate service provider account</strong>
            <p>Use this when you want to register as a housekeeper or manage service work.</p>
          </div>
          <button type="button" className="account-primary-action" onClick={() => onNavigate("/register")}>
            Start registration
          </button>
        </>
      )
    },
    pay: {
      title: "HouseHelp Pay",
      body: (
        <>
          <div className="account-detail-card">
            <strong>Cash payment enabled</strong>
            <p>Online wallet setup is not connected yet. Completed payments are tracked in your dashboard.</p>
          </div>
          <button type="button" className="account-primary-action" onClick={() => onNavigate("/customer/dashboard")}>
            View payments
          </button>
        </>
      )
    }
  };

  const content = panelContent[activePanel];
  if (!content) return null;

  return (
    <div className="account-panel-backdrop" role="presentation" onClick={onClose}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-label={content.title} onClick={(event) => event.stopPropagation()}>
        <div className="account-panel-header">
          <h2>{content.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">x</button>
        </div>
        {content.body}
      </section>
    </div>
  );
}

export default function CustomerAccountView({ user, profileData, loading, onEdit }) {
  const [activePanel, setActivePanel] = useState(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const displayName = profileData?.fullName || user?.fullName || "HouseHelp User";
  const initials = useMemo(() => (
    displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  ), [displayName]);

  const handleSelect = (item) => {
    if (item.action === "edit") {
      onEdit();
      return;
    }

    if (item.action === "logout") {
      logout();
      return;
    }

    if (item.panel) {
      setActivePanel(item.panel);
      return;
    }

    if (item.path) {
      navigate(item.path);
    }
  };

  const handleNavigate = (path) => {
    setActivePanel(null);
    navigate(path);
  };

  const handleEditFromPanel = () => {
    setActivePanel(null);
    onEdit();
  };

  return (
    <div className="mobile-account-page">
      <main className="mobile-account-content">
        <h1>Account</h1>

        <section className="account-identity">
          <div className="account-avatar">{initials}</div>
          <div>
            <h2>{loading ? "Loading..." : displayName}</h2>
            <button type="button" className="member-pill" onClick={() => setActivePanel("rewards")}>
              Member tier
            </button>
          </div>
        </section>

        <section className="account-section">
          <h3>Account</h3>
          {accountItems.map((item) => (
            <AccountRow key={item.label} item={item} onSelect={handleSelect} />
          ))}
        </section>

        <section className="account-section">
          <h3>Utilities</h3>
          {utilityItems.map((item) => (
            <AccountRow key={item.label} item={item} onSelect={handleSelect} />
          ))}
        </section>
      </main>

      <InfoPanel
        activePanel={activePanel}
        profileData={profileData}
        onClose={() => setActivePanel(null)}
        onEdit={handleEditFromPanel}
        onNavigate={handleNavigate}
      />

      <MobileBottomNav />
    </div>
  );
}
