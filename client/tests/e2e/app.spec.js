import { expect, test } from "@playwright/test";

const token = "e2e-token";
const user = { id: "user-1", tenantId: "tenant-1", name: "Admin", email: "admin@example.com", role: "admin" };
const districtId = "11111111-1111-4111-8111-111111111111";
const mainSidebarRoutes = [
  ["/dashboard", "Dashboard"],
  ["/water-map", "Water Map"],
  ["/water-sources", "Water Sources"],
  ["/sensors", "Sensors"],
  ["/operations", "Rainfall Analysis"],
  ["/forecasts", "Vegetation Health"],
  ["/simulations", "Drought Forecast"],
  ["/alerts", "Early Warning System"],
  ["/reports", "Community Reports"],
  ["/location-settings", "Location Settings"],
  ["/developers", "Reports"],
  ["/admin/users", "Users"],
  ["/settings", "Settings"]
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/login") return route.fulfill({ json: { user, token, accessToken: token, refreshToken: "refresh-token" } });
    if (path === "/settings/current") return route.fulfill({ json: platformSettings() });
    if (path === "/weather/current") return route.fulfill({ json: { temperature: 26, condition: "Clear", humidity: 45 } });
    if (path === "/dashboard/summary") return route.fulfill({ json: dashboardSummary() });
    if (path === "/districts") return route.fulfill({ json: districtFeatureCollection() });
    if (path === `/districts/${districtId}/status`) return route.fulfill({ json: { district: districtFeatureCollection().features[0].properties, sensorCount: 0, pendingCommunityReports: 0 } });
    if (path === "/aois") return route.fulfill({ json: aois() });
    if (path.startsWith("/aois/")) return route.fulfill({ json: aois()[0] });
    if (path === "/water-sources") return route.fulfill({ json: featureCollection([]) });
    if (path === "/map/drought-heatmap") return route.fulfill({ json: [] });
    if (path.startsWith("/ndvi/")) return route.fulfill({ json: series("value") });
    if (path.startsWith("/rainfall/")) return route.fulfill({ json: series("mmTotal") });
    if (path.startsWith("/groundwater/")) return route.fulfill({ json: series("avgDepth") });
    if (path === "/sensors") return route.fulfill({ json: [] });
    if (path === "/sensors/summary") return route.fulfill({ json: { total: 0, online: 0, offline: 0, maintenance: 0, health_pct: 0 } });
    if (path === "/sensors/operations/health") return route.fulfill({ json: { sensors: [], stale: [] } });
    if (path === "/sensors/operations/tickets") return route.fulfill({ json: [] });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/community/reports") return route.fulfill({ json: [] });
    if (path === "/community/leaderboard") return route.fulfill({ json: [] });
    if (path.startsWith("/forecasts/") && path.endsWith("/latest")) return route.fulfill({ json: { riskScore: 0.2, riskLabel: "Low", drivers: [] } });
    if (path.startsWith("/forecasts/")) return route.fulfill({ json: [] });
    if (path.startsWith("/satellite/")) return route.fulfill({ json: [] });
    if (path === "/map-layers/drought-timeline") return route.fulfill({ json: [] });
    if (path === "/map-layers/boreholes") return route.fulfill({ json: [] });
    if (path === "/map-layers/conflict-risks") return route.fulfill({ json: featureCollection([]) });
    if (path === "/map-layers/hydro-events") return route.fulfill({ json: featureCollection([]) });
    if (path === "/advisory/livestock/water-stress") return route.fulfill({ json: { waterPoints: [], pasture: [] } });
    if (path === "/advisory/market/prices") return route.fulfill({ json: { external: [], stored: [] } });
    if (path === "/advisory/irrigation/schedules") return route.fulfill({ json: [] });
    if (path.startsWith("/advisory/crops/recommendations/")) return route.fulfill({ json: { recommendations: [] } });
    if (path === "/simulations") return route.fulfill({ json: [] });
    if (path === "/developer/portal") return route.fulfill({ json: { title: "Research API", endpoints: [] } });
    if (path === "/developer/api-keys") return route.fulfill({ json: [] });
    if (path === "/developer/usage") return route.fulfill({ json: [] });
    if (path === "/reports/export") return route.fulfill({ json: { summary: dashboardSummary(), rainfall: [] } });
    if (path === "/tenants") return route.fulfill({ json: [{ id: "tenant-1", name: "Pilot Tenant", _count: { users: 0, districts: 1, apiKeys: 0 } }] });
    if (path === "/tenants/tenant-1/users") return route.fulfill({ json: [] });
    if (path === "/community/report" && route.request().method() === "POST") return route.fulfill({ status: 201, json: { id: "report-1" } });
    return route.fulfill({ json: {} });
  });
});

test("protects app routes and logs in", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Active Sensors").first()).toBeVisible();
});

test("renders map layers with mocked GIS APIs", async ({ page }) => {
  await loginByStorage(page, "/map");
  await expect(page.locator("#map-page-root")).toBeVisible();
  await expect(page.getByText("Boreholes")).toBeVisible();
  await expect(page.getByText("Conflict zones")).toBeVisible();
});

test("renders every main sidebar route", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await loginByStorage(page, "/dashboard");

  for (const [path, heading] of mainSidebarRoutes) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});

test("collapses and expands the dashboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await loginByStorage(page, "/dashboard");
  const sidebar = page.getByTestId("desktop-sidebar");
  await expect(sidebar).toHaveCSS("width", "220px");

  await page.getByRole("button", { name: "Collapse navigation" }).first().click();
  await expect(sidebar).toHaveCSS("width", "76px");
  await expect(sidebar.getByText("Water Sources")).toBeHidden();

  await page.getByRole("button", { name: "Expand navigation" }).first().click();
  await expect(sidebar).toHaveCSS("width", "220px");
  await expect(sidebar.getByText("Water Sources")).toBeVisible();
});

test("queues a report when offline", async ({ page, context }) => {
  await loginByStorage(page, "/reports");
  await context.setOffline(true);
  await page.getByRole("button", { name: /add report/i }).click();
  await page.getByPlaceholder("Latitude").fill("-1.8");
  await page.getByPlaceholder("Longitude").fill("37.6");
  await page.getByPlaceholder(/water level/i).fill("22");
  await page.getByPlaceholder(/description/i).fill("Borehole is low");
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/queued|saved offline/i)).toBeVisible();
});

async function loginByStorage(page, targetPath) {
  await page.goto("/login");
  await page.evaluate(({ user, token }) => {
    window.localStorage.clear();
    window.localStorage.setItem("smart-water-map-auth", JSON.stringify({ state: { user, token }, version: 0 }));
  }, { user, token });
  await page.goto(targetPath);
}

function districtFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      id: districtId,
      geometry: { type: "Polygon", coordinates: [[[37, -2], [38, -2], [38, -1], [37, -1], [37, -2]]] },
      properties: { name: "Makueni", droughtRiskLevel: "WATCH" }
    }]
  };
}

function featureCollection(features) {
  return { type: "FeatureCollection", features };
}

function aois() {
  return [{
    id: "1",
    name: "Makueni",
    type: "county",
    geometry: districtFeatureCollection().features[0].geometry,
    createdAt: "2026-01-01T00:00:00.000Z"
  }];
}

function dashboardSummary() {
  return {
    activeAlerts: 1,
    sensorsOnline: 2,
    districtsAtRisk: 1,
    recentCommunityReports: [],
    waterSources: { total: 0, active: 0 },
    sensors: { total: 0, online: 0 }
  };
}

function platformSettings() {
  return {
    organizationName: "Smart Water",
    country: "Kenya",
    slug: "kenya-pilot",
    general: { defaultDistrict: "Makueni", temperatureUnit: "Celsius" },
    map: { defaultZoom: 9, defaultBasemap: "OpenStreetMap" }
  };
}

function series(key) {
  return [
    { month: "Jan", [key]: 10 },
    { month: "Feb", [key]: 12 }
  ];
}
