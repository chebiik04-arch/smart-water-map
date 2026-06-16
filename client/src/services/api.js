import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1"
});

api.interceptors.request.use((config) => {
  const token = readPersistedToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function readPersistedToken() {
  try {
    const persisted = JSON.parse(localStorage.getItem("smart-water-map-auth") || "{}");
    return persisted?.state?.token;
  } catch {
    return null;
  }
}

export const endpoints = {
  login: (payload) => api.post("/auth/login", payload),
  register: (payload) => api.post("/auth/register", payload),
  summary: () => api.get("/dashboard/summary"),
  districts: () => api.get("/districts"),
  districtStatus: (id) => api.get(`/districts/${id}/status`),
  sensors: (params) => api.get("/sensors", { params }),
  sensorReadings: (id) => api.get(`/sensors/${id}/readings`),
  satellite: (districtId) => api.get(`/satellite/${districtId}`),
  alerts: () => api.get("/alerts"),
  resolveAlert: (id) => api.post(`/alerts/${id}/resolve`),
  communityReports: () => api.get("/community/reports"),
  communityReport: (payload) => api.post("/community/report", payload),
  forecasts: (districtId) => api.get(`/forecasts/${districtId}`)
};
