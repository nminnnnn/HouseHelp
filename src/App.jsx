import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./controllers/AuthPageController";
import HomePage from "./controllers/HomePageController";
import ProfilePage from "./pages/ProfilePage";
import BookingDetailPage from "./pages/BookingDetailPage";
import BookingViewPage from "./pages/BookingViewPage";
import QuickBookingPage from "./pages/QuickBookingPage";
import BookingStatusPage from "./pages/BookingStatusPage";
import HousekeeperDashboard from "./pages/HousekeeperDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ChatPage from "./pages/ChatPage";
import SettingLanguage from "./views/Setting/SettingLanguage";
import { LanguageProvider } from "./contexts/LanguageContext";
import { BookingProvider } from "./contexts/BookingContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import ToastContainer from "./components/ToastContainer";
import ChatbotButton from "./components/Chatbot/ChatbotButton";
import IncomingCallListener from "./components/Call/IncomingCallListener";
import './App.css';

// Component wrapper để handle admin redirect
function HomePageWrapper() {
  // Kiểm tra user từ localStorage
  const checkUserRole = () => {
    try {
      const userData = localStorage.getItem("househelp_user");
      if (userData && userData !== "null" && userData !== "undefined") {
        const parsedUser = JSON.parse(userData);
        return parsedUser.role;
      }
    } catch (error) {
      console.error("Error checking user role:", error);
    }
    return null;
  };

  const userRole = checkUserRole();
  
  // Nếu là admin, redirect đến admin dashboard
  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  // Nếu không phải admin, hiển thị trang chủ bình thường
  return <HomePage />;
}

export default function App() {
  return (
    <LanguageProvider>
      <BookingProvider>
        <Router>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/" element={<HomePageWrapper />} />
              <Route path="/housekeepers" element={<HomePageWrapper />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/booking/:housekeeperId" element={<BookingDetailPage />} />
              <Route path="/booking-detail/:bookingId" element={<BookingDetailPage />} />
              <Route path="/booking-view/:bookingId" element={<BookingViewPage />} />
              <Route path="/quick-booking" element={<QuickBookingPage />} />
              <Route path="/booking-status" element={<BookingStatusPage />} />
              <Route path="/housekeeper/dashboard" element={<HousekeeperDashboard />} />
              <Route path="/customer/dashboard" element={<CustomerDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/settings/language" element={<SettingLanguage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <IncomingCallListener />
            <ToastContainer />
            <ChatbotButton />
          </NotificationProvider>
        </Router>
      </BookingProvider>
    </LanguageProvider>
  );
}
