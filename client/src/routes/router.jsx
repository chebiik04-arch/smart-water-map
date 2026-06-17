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

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/map", element: <MapPage /> },
          { path: "/districts/:id", element: <DistrictDetailPage /> },
          { path: "/sensors", element: <SensorsPage /> },
          { path: "/operations", element: <OperationsPage /> },
          { path: "/alerts", element: <AlertsPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/forecasts", element: <ForecastsPage /> },
          { path: "/advisory", element: <AdvisoryPage /> },
          { path: "/simulations", element: <SimulationsPage /> }
        ]
      }
    ]
  },
  {
    element: <ProtectedRoute roles={["admin"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/developers", element: <DeveloperPortalPage /> },
          { path: "/admin/users", element: <AdminUsersPage /> }
        ]
      }
    ]
  }
]);
