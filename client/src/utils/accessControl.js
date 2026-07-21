export const VIEW_ACCESS = {
  dashboard: ["admin", "field_agent", "community_user"],
  waterMap: ["admin", "field_agent"],
  waterSources: ["admin", "field_agent", "community_user"],
  sensors: ["admin", "field_agent"],
  rainfall: ["admin", "field_agent", "community_user"],
  vegetation: ["admin", "field_agent"],
  droughtForecast: ["admin", "field_agent", "community_user"],
  alerts: ["admin", "field_agent", "community_user"],
  communityReports: ["admin", "field_agent"],
  reports: ["admin"],
  users: ["admin"],
  locationSettings: ["admin"],
  settings: ["admin"]
};

export function canAccessView(role, view) {
  return VIEW_ACCESS[view]?.includes(role) || false;
}

