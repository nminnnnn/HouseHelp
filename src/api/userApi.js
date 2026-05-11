const API_BASE_URL = "http://localhost:5000/api";

export function getAccessToken() {
  return localStorage.getItem("househelp_access_token") || "";
}

export function authHeaders(extraHeaders = {}) {
  const token = getAccessToken();
  return token
    ? { ...extraHeaders, Authorization: `Bearer ${token}` }
    : extraHeaders;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

export async function register(user) {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user)
  });
  return res.json();
}

export async function getUserById(id) {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    headers: authHeaders()
  });
  return res.json();
}

export async function updateUserProfile(id, profileData) {
  console.log('🔥 API CALL: updateUserProfile');
  console.log('URL:', `${API_BASE_URL}/users/${id}/profile`);
  console.log('Data:', profileData);
  
  const res = await fetch(`${API_BASE_URL}/users/${id}/profile`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(profileData)
  });
  
  console.log('Response status:', res.status);
  const result = await res.json();
  console.log('Response data:', result);
  
  return result;
}

export async function getUserProfile(id) {
  console.log('🌐 API CALL: getUserProfile');
  console.log('URL:', `${API_BASE_URL}/users/${id}/profile`);
  
  const res = await fetch(`${API_BASE_URL}/users/${id}/profile`, {
    headers: authHeaders()
  });
  console.log('Response status:', res.status);
  
  const result = await res.json();
  console.log('📦 Profile data received:', result);
  
  return result;
}

export async function uploadAvatar(id, avatarFile) {
  const formData = new FormData();
  formData.append('avatar', avatarFile);
  
  const res = await fetch(`${API_BASE_URL}/users/${id}/avatar`, {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });
  return res.json();
}

export async function changePassword(id, currentPassword, newPassword) {
  const res = await fetch(`${API_BASE_URL}/users/${id}/password`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ currentPassword, newPassword })
  });
  return res.json();
}

export async function deleteUserAccount(id, password) {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: "DELETE",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ password })
  });
  return res.json();
} 