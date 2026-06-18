import { expect, test } from "@playwright/test";

const token = "e2e-token";
const user = { id: "user-1", tenantId: "tenant-1", name: "Admin", email: "admin@example.com", role: "admin" };
const districtId = "11111111-1111-4111-8111-111111111111";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/login") return route.fulfill({ json: { user, token } });
    if (path === "/dashboard/summary") return route.fulfill({ json: { activeAlerts: 1, sensorsOnline: 2, districtsAtRisk: 1, recentCommunityReports: [] } });
    if (path === "/districts") return route.fulfill({ json: districtFeatureCollection() });
    if (path === "/sensors") return route.fulfill({ json: [] });
    if (path === "/alerts") return route.fulfill({ json: [] });
    if (path === "/community/reports") return route.fulfill({ json: [] });
    if (path === "/community/leaderboard") return route.fulfill({ json: [] });
    if (path === "/map-layers/drought-timeline") return route.fulfill({ json: [] });
    if (path === "/map-layers/boreholes") return route.fulfill({ json: [] });
    if (path === "/map-layers/conflict-risks") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    if (path === "/map-layers/hydro-events") return route.fulfill({ json: { type: "FeatureCollection", features: [] } });
    if (path === "/advisory/livestock/water-stress") return route.fulfill({ json: { waterPoints: [], pasture: [] } });
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
