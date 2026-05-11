const API_BASE_URL = "http://localhost:5000/api";

export async function createBooking(booking) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(booking)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error creating booking:", error);
    throw error;
  }
}

export async function getBookingsByUserId(userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/user/${userId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    throw error;
  }
}

export async function getBookingById(bookingId) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error fetching booking:", error);
    throw error;
  }
}

export async function updateBookingStatus(bookingId, status) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error updating booking status:", error);
    throw error;
  }
}

export async function cancelBooking(bookingId, reason = "") {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/cancel`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ reason })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
}

export async function rescheduleBooking(bookingId, newDate, newTime) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/reschedule`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ date: newDate, time: newTime })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error rescheduling booking:", error);
    throw error;
  }
}

export async function getHousekeeperAvailability(housekeeperId, date) {
  try {
    const res = await fetch(`${API_BASE_URL}/housekeepers/${housekeeperId}/availability?date=${date}`, {
      headers: {
        "Authorization": `Bearer ${getAuthToken()}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error fetching availability:", error);
    throw error;
  }
}

export async function submitBookingReview(bookingId, rating, comment) {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/review`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ rating, comment })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return res.json();
  } catch (error) {
    console.error("Error submitting review:", error);
    throw error;
  }
}

// Helper function to get auth token
function getAuthToken() {
  const tokenFromStorage = localStorage.getItem("househelp_access_token");
  if (tokenFromStorage) return tokenFromStorage;

  try {
    const userData = localStorage.getItem("househelp_user");
    if (userData && userData !== "null" && userData !== "undefined") {
      const user = JSON.parse(userData);
      return user.accessToken || user.token || "";
    }
  } catch (error) {
    console.error("Error getting auth token:", error);
  }

  return "";
} 