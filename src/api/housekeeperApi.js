const API_BASE_URL = "http://localhost:5000/api";

function getAccessToken() {
  return localStorage.getItem("househelp_access_token") || "";
}

function authHeaders(extraHeaders = {}) {
  const token = getAccessToken();
  return token
    ? { ...extraHeaders, Authorization: `Bearer ${token}` }
    : extraHeaders;
}

export async function getAllHousekeepers() {
  const res = await fetch(`${API_BASE_URL}/housekeepers`);
  return res.json();
}

export async function getHousekeeperById(id) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}`);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

export async function getHousekeeperProfile(id) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/profile`, {
    headers: authHeaders()
  });
  return res.json();
}

export async function updateHousekeeperProfile(id, profileData) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/profile`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(profileData)
  });
  return res.json();
}

export async function uploadPortfolioImages(id, images) {
  const formData = new FormData();
  images.forEach((image, index) => {
    formData.append(`portfolioImage${index}`, image);
  });
  
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/portfolio`, {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });
  return res.json();
}

export async function updateAvailability(id, isAvailable) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/availability`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ available: isAvailable })
  });
  return res.json();
}

export async function updatePricing(id, price, priceType) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/pricing`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ price, priceType })
  });
  return res.json();
}

export async function updateWorkingSchedule(id, workingDays, workingHours) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/schedule`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ workingDays, workingHours })
  });
  return res.json();
}

export async function getHousekeeperStats(id) {
  const res = await fetch(`${API_BASE_URL}/housekeepers/${id}/stats`, {
    headers: authHeaders()
  });
  return res.json();
} 