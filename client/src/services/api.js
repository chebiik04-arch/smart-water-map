import axios from "axios";
import { buildAuthSession, clearAuthSession, readAuthSession, writeAuthSession } from "../utils/authSession";

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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest?._retry || originalRequest?.url?.includes("/auth/")) {
      if (error.response?.status === 401) redirectToLogin();
      return Promise.reject(error);
    }

    const session = readAuthSession();
    if (!session.refreshToken || isExpired(session.refreshExpiresAt)) {
      redirectToLogin();
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: session.refreshToken });
      const nextSession = writeAuthSession(buildAuthSession(data, session.rememberMe));
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextSession.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

function readPersistedToken() {
  return readAuthSession().token;
}

function isExpired(value) {
  return value && Number(value) <= Date.now();
}

function redirectToLogin() {
  clearAuthSession();
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export const endpoints = {
  login: (payload) => api.post("/auth/login", payload),
  register: (payload) => api.post("/auth/register", payload),
  summary: () => api.get("/dashboard/summary"),
  dashboardSummary: (params) => api.get("/dashboard/summary", { params }),
  districts: () => api.get("/districts"),
  districtStatus: (id) => api.get(`/districts/${id}/status`),
  waterSources: (params) => api.get("/water-sources", { params }),
  waterSource: (id) => api.get(`/water-sources/${id}`),
  waterSourceReadings: (id, params) => api.get(`/water-sources/${id}/readings`, { params }),
  createWaterSource: (payload) => api.post("/water-sources", payload),
  updateWaterSource: (id, payload) => api.patch(`/water-sources/${id}`, payload),
  deleteWaterSource: (id) => api.delete(`/water-sources/${id}`),
  createWaterSourceReading: (id, payload) => api.post(`/water-sources/${id}/reading`, payload),
  droughtHeatmap: (params) => api.get("/map/drought-heatmap", { params }),
  ndviSeries: (districtId, params) => api.get(`/ndvi/${districtId}`, { params }),
  rainfallSeries: (districtId, params) => api.get(`/rainfall/${districtId}`, { params }),
  groundwaterSeries: (districtId, params) => api.get(`/groundwater/${districtId}`, { params }),
  latestForecast: (districtId) => api.get(`/forecasts/${districtId}/latest`),
  weatherCurrent: (params) => api.get("/weather/current", { params }),
  exportReport: (params) => api.get("/reports/export", { params }),
  sensors: (params) => api.get("/sensors", { params }),
  sensorSummary: () => api.get("/sensors/summary"),
  sensor: (id) => api.get(`/sensors/${id}`),
  createSensor: (payload) => api.post("/sensors", payload),
  sensorHealth: (params) => api.get("/sensors/operations/health", { params }),
  maintenanceTickets: () => api.get("/sensors/operations/tickets"),
  updateTicketStatus: (id, payload) => api.post(`/sensors/operations/tickets/${id}/status`, payload),
  sensorReadings: (id) => api.get(`/sensors/${id}/readings`),
  satellite: (districtId) => api.get(`/satellite/${districtId}`),
  alerts: (params) => api.get("/alerts", { params }),
  resolveAlert: (id) => api.post(`/alerts/${id}/resolve`),
  escalateAlert: (id) => api.post(`/alerts/${id}/escalate`),
  communityReports: (params) => api.get("/community/reports", { params }),
  communityReportDetail: (id) => api.get(`/community/reports/${id}`),
  communityReport: (payload) => api.post("/community/report", payload),
  communityReportUpload: (payload) => api.post("/community/report/upload", payload, { headers: { "Content-Type": "multipart/form-data" } }),
  moderateReport: (id, payload) => api.post(`/community/reports/${id}/moderate`, payload),
  verifyReport: (id) => api.post(`/community/reports/${id}/verify`),
  leaderboard: () => api.get("/community/leaderboard"),
  forecasts: (districtId) => api.get(`/forecasts/${districtId}`),
  droughtTimeline: () => api.get("/map-layers/drought-timeline"),
  boreholes: () => api.get("/map-layers/boreholes"),
  conflictRisks: () => api.get("/map-layers/conflict-risks"),
  hydroEvents: () => api.get("/map-layers/hydro-events"),
  runGroundwaterSimulation: (payload) => api.post("/simulations/groundwater", payload),
  simulations: () => api.get("/simulations"),
  developerPortal: () => api.get("/developer/portal"),
  apiKeys: () => api.get("/developer/api-keys"),
  createApiKey: (payload) => api.post("/developer/api-keys", payload),
  apiUsage: () => api.get("/developer/usage"),
  createIrrigationSchedule: (payload) => api.post("/advisory/irrigation/schedule", payload),
  irrigationSchedules: () => api.get("/advisory/irrigation/schedules"),
  cropRecommendations: (districtId) => api.get(`/advisory/crops/recommendations/${districtId}`),
  marketPrices: () => api.get("/advisory/market/prices"),
  livestockWaterStress: () => api.get("/advisory/livestock/water-stress"),
  aois: () => api.get("/aois"),
  aoi: (id) => api.get(`/aois/${id}`),
  createAoi: (payload) => api.post("/aois", payload, { headers: { "Content-Type": "multipart/form-data" } }),
  tenants: () => api.get("/tenants"),
  createTenant: (payload) => api.post("/tenants", payload),
  updateTenant: (id, payload) => api.patch(`/tenants/${id}`, payload),
  tenantUsers: (id) => api.get(`/tenants/${id}/users`),
  createTenantUser: (id, payload) => api.post(`/tenants/${id}/users`, payload),
  updateTenantUser: (tenantId, userId, payload) => api.patch(`/tenants/${tenantId}/users/${userId}`, payload),
  deactivateTenantUser: (tenantId, userId) => api.post(`/tenants/${tenantId}/users/${userId}/deactivate`),
  signedUploadUrl: (payload) => api.post("/uploads/signed-url", payload),
  currentSettings: () => api.get("/settings/current"),
  updateCurrentSettings: (payload) => api.patch("/settings/current", payload)
};
