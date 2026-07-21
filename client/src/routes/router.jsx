import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { MapPage } from "../pages/MapPage";
import { DistrictDetailPage } from "../pages/DistrictDetailPage";
import { SensorsPage } from "../pages/SensorsPage";
import { AlertsPage } from "../pages/AlertsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { ForecastsPage } from "../pages/ForecastsPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { OperationsPage } from "../pages/OperationsPage";
import { SimulationsPage } from "../pages/SimulationsPage";
import { DeveloperPortalPage } from "../pages/DeveloperPortalPage";
import { AdvisoryPage } from "../pages/AdvisoryPage";
import { WaterMap } from "../pages/WaterMap";
import { WaterSources } from "../pages/WaterSources";
import { SettingsPage } from "../pages/SettingsPage";
import { LocationSettingsPage } from "../pages/LocationSettingsPage";
import { RouteErrorBoundary } from "../components/RouteErrorBoundary";
import { canAccessView } from "../utils/accessControl";
import { useAuthStore } from "../stores/authStore";

function ViewRoute({ view, children }) {
  const { user } = useAuthStore();
  if (!canAccessView(user?.role, view)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function view(view, element) {
  return <ViewRoute view={view}>{element}</ViewRoute>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: view("dashboard", <DashboardPage />) },
          { path: "/map", element: view("waterMap", <MapPage />) },
          { path: "/water-map", element: view("waterMap", <WaterMap />) },
          { path: "/water-sources", element: view("waterSources", <WaterSources />) },
          { path: "/districts/:id", element: view("dashboard", <DistrictDetailPage />) },
          { path: "/sensors", element: view("sensors", <SensorsPage />) },
          { path: "/operations", element: view("rainfall", <OperationsPage />) },
          { path: "/alerts", element: view("alerts", <AlertsPage />) },
          { path: "/reports", element: view("communityReports", <ReportsPage />) },
          { path: "/forecasts", element: view("vegetation", <ForecastsPage />) },
          { path: "/advisory", element: view("waterSources", <AdvisoryPage />) },
          { path: "/simulations", element: view("droughtForecast", <SimulationsPage />) },
          { path: "/location-settings", element: view("locationSettings", <LocationSettingsPage />) },
          { path: "/settings", element: view("settings", <SettingsPage />) }
        ]
      }
    ]
  },
  {
    element: <ProtectedRoute roles={["admin"]} />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          { path: "/developers", element: view("reports", <DeveloperPortalPage />) },
          { path: "/admin/users", element: view("users", <AdminUsersPage />) }
        ]
      }
    ]
  }
]);
