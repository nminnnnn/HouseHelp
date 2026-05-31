import React, { useEffect, useMemo, useState } from "react";
import ProfileEdit from "./Profile/ProfileEdit";
import { authHeaders } from "../api/userApi";

function ProfileView({ user, profileData, loading, editing, onEdit, onCancel, onSave }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  useEffect(() => {
    if (!user?.id || (activeTab !== "booking" && activeTab !== "statistics")) return;

    let isMounted = true;

    async function loadBookings() {
      try {
        setBookingsLoading(true);
        setBookingsError("");
        const response = await fetch(`http://localhost:5000/api/bookings/user/${user.id}`, {
          headers: authHeaders()
        });

        if (!response.ok) throw new Error("Could not load bookings");

        const data = await response.json();
        if (isMounted) setBookings(Array.isArray(data) ? data : []);
      } catch (error) {
        if (isMounted) setBookingsError(error.message || "Could not load bookings");
      } finally {
        if (isMounted) setBookingsLoading(false);
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [activeTab, user?.id]);

  const bookingStats = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const cancelled = bookings.filter((booking) => ["cancelled", "rejected"].includes(booking.status)).length;
    const revenue = bookings
      .filter((booking) => booking.status === "completed")
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);

    return { total, completed, pending, cancelled, revenue };
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Đang tải thông tin profile...</div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-red-500">Không thể tải thông tin profile</div>
      </div>
    );
  }

  if (editing) {
    return (
      <ProfileEdit
        user={user}
        profileData={profileData}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("vi-VN");
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return amount.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
  };

  const statusClass = (status) => {
    const classes = {
      completed: "bg-green-100 text-green-800",
      confirmed: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      rejected: "bg-red-100 text-red-800",
      in_progress: "bg-purple-100 text-purple-800"
    };

    return classes[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      <style>{`
        .profile-container .text-gray-600,
        .profile-container .text-sm.text-gray-600,
        .profile-container span.text-gray-600,
        .profile-container span.text-sm {
          color: #000000 !important;
          font-weight: 600 !important;
          background: transparent !important;
        }
        .profile-container .space-y-3 span {
          color: #000000 !important;
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 py-8 profile-container">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 p-6">
              {/* Avatar and Name */}
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  {getInitials(profileData.fullName)}
                </div>
                <h2 className="text-xl font-bold text-gray-900">{profileData.fullName || "N/A"}</h2>
                <div className="text-center mt-2">
                  {user.role === "housekeeper" && (
                    <span className="text-sm text-blue-600 font-medium">
                      Professional Housekeeper
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">{user.email || "N/A"}</span>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm">{profileData.phone || "N/A"}</span>
                </div>

                <div className="flex items-center gap-3 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">{[profileData.address, profileData.city].filter(Boolean).join(', ') || "N/A"}</span>
                </div>
              </div>

              {/* Edit Profile Button */}
              <button
                onClick={onEdit}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium mb-6"
              >
                Edit Profile
              </button>

              {/* Quick Stats - Only for Housekeeper */}
              {user.role === "housekeeper" && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{color: '#000000', fontWeight: '600'}}>Rating</span>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-semibold">{profileData?.housekeeper?.rating || '0.0'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{color: '#000000', fontWeight: '600'}}>Jobs Completed</span>
                      <span className="text-sm font-semibold">{profileData?.housekeeper?.completedJobs || 0}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm" style={{color: '#000000', fontWeight: '600'}}>Hourly Rate</span>
                      <span className="text-sm font-semibold text-green-600">
                        ${profileData?.housekeeper?.price || 25}/hr
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab("personal")}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "personal"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Personal Info
                  </button>
                  <button
                    onClick={() => setActiveTab("booking")}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "booking"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Booking History
                  </button>
                  {user.role === "housekeeper" && (
                    <button
                      onClick={() => setActiveTab("statistics")}
                      className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === "statistics"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      Statistics
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "personal" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <div className="text-gray-900">{profileData.fullName || "N/A"}</div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <div className="text-gray-900">{user.email || "N/A"}</div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <div className="text-gray-900">{profileData.phone || "N/A"}</div>
                      </div>

                      {user.role === "housekeeper" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                          <div className="text-green-600 font-semibold">
                            ${profileData?.housekeeper?.price || 25}/hr
                          </div>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <div className="text-gray-900">
                          {[profileData.address, profileData.district, profileData.city]
                            .filter(Boolean)
                            .join(', ') || "N/A"}
                        </div>
                      </div>

                      {profileData.bio && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                          <div className="text-gray-900">{profileData.bio}</div>
                        </div>
                      )}

                      {user.role === "housekeeper" && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Services Offered</label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {profileData.housekeeper?.services ? (
                              profileData.housekeeper.services.split(',').map((service, index) => (
                                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                                  {service.trim()}
                                </span>
                              ))
                            ) : (
                              <>
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                                  Cleaning
                                </span>
                                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                                  Cooking
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                                  Laundry
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "booking" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Booking History</h3>
                    {bookingsLoading && <div className="text-gray-500">Loading bookings...</div>}
                    {bookingsError && <div className="text-red-600">{bookingsError}</div>}
                    {!bookingsLoading && !bookingsError && bookings.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p>No bookings yet.</p>
                      </div>
                    )}
                    <div className="space-y-4">
                      {bookings.map((booking) => (
                        <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-gray-900">{booking.service || "HouseHelp service"}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                {user.role === "housekeeper"
                                  ? `Customer: ${booking.customerName || booking.customerId || "N/A"}`
                                  : `Housekeeper: ${booking.housekeeperName || booking.housekeeperId || "N/A"}`}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {formatDate(booking.startDate)} {booking.time ? `- ${booking.time}` : ""}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{booking.location || booking.customerAddress || "No address"}</div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusClass(booking.status)}`}>
                                {booking.status || "pending"}
                              </span>
                              <div className="text-sm font-semibold text-green-700 mt-3">{formatCurrency(booking.totalPrice)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "statistics" && user.role === "housekeeper" && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Statistics</h3>
                    {bookingsLoading && <div className="text-gray-500">Loading statistics...</div>}
                    {bookingsError && <div className="text-red-600">{bookingsError}</div>}
                    {!bookingsLoading && !bookingsError && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Total bookings</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">{bookingStats.total}</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Completed jobs</div>
                          <div className="text-2xl font-bold text-green-700 mt-1">{bookingStats.completed}</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Pending requests</div>
                          <div className="text-2xl font-bold text-yellow-700 mt-1">{bookingStats.pending}</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Completed revenue</div>
                          <div className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(bookingStats.revenue)}</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Cancelled or rejected</div>
                          <div className="text-2xl font-bold text-red-700 mt-1">{bookingStats.cancelled}</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="text-sm text-gray-600">Average rating</div>
                          <div className="text-2xl font-bold text-gray-900 mt-1">{profileData?.housekeeper?.rating || "0.0"}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

export default ProfileView; 
