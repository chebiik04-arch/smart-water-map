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
  dashboardSummary: (params) => api.get("/dashboard/summary", { params }),
  districts: () => api.get("/districts"),
  districtStatus: (id) => api.get(`/districts/${id}/status`),
  waterSources: (params) => api.get("/water-sources", { params }),
  waterSource: (id) => api.get(`/water-sources/${id}`),
  waterSourceReadings: (id, params) => api.get(`/water-sources/${id}/readings`, { params }),
  createWaterSource: (payload) => api.post("/water-sources", payload),
  createWaterSourceReading: (id, payload) => api.post(`/water-sources/${id}/reading`, payload),
  droughtHeatmap: (params) => api.get("/map/drought-heatmap", { params }),
  ndviSeries: (districtId, params) => api.get(`/ndvi/${districtId}`, { params }),
  rainfallSeries: (districtId, params) => api.get(`/rainfall/${districtId}`, { params }),
  groundwaterSeries: (districtId, params) => api.get(`/groundwater/${districtId}`, { params }),
  latestForecast: (districtId) => api.get(`/forecasts/${districtId}/latest`),
  weatherCurrent: (params) => api.get("/weather/current", { params }),
  exportReport: (params) => api.get("/reports/export", { params }),
  sensors: (params) => api.get("/sensors", { params }),
  sensorHealth: (params) => api.get("/sensors/operations/health", { params }),
  maintenanceTickets: () => api.get("/sensors/operations/tickets"),
  updateTicketStatus: (id, payload) => api.post(`/sensors/operations/tickets/${id}/status`, payload),
  sensorReadings: (id) => api.get(`/sensors/${id}/readings`),
  satellite: (districtId) => api.get(`/satellite/${districtId}`),
  alerts: (params) => api.get("/alerts", { params }),
  resolveAlert: (id) => api.post(`/alerts/${id}/resolve`),
  communityReports: (params) => api.get("/community/reports", { params }),
  communityReport: (payload) => api.post("/community/report", payload),
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
  livestockWaterStress: () => api.get("/advisory/livestock/water-stress")
  ,
  tenants: () => api.get("/tenants"),
  createTenant: (payload) => api.post("/tenants", payload),
  updateTenant: (id, payload) => api.patch(`/tenants/${id}`, payload),
  tenantUsers: (id) => api.get(`/tenants/${id}/users`),
  createTenantUser: (id, payload) => api.post(`/tenants/${id}/users`, payload),
  signedUploadUrl: (payload) => api.post("/uploads/signed-url", payload)
};
