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

export async function createReview(reviewData) {
  const res = await fetch(`${API_BASE_URL}/reviews`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(reviewData),
  });
  return res.json();
}

export async function getReviewsByHousekeeperId(housekeeperId) {
  const res = await fetch(`${API_BASE_URL}/reviews/housekeeper/${housekeeperId}`);
  return res.json();
} 