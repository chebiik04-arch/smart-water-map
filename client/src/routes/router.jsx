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
          { path: "/alerts", element: <AlertsPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/forecasts", element: <ForecastsPage /> }
        ]
      }
    ]
  },
  {
    element: <ProtectedRoute roles={["admin"]} />,
    children: [{ path: "/admin/users", element: <AppLayout />, children: [{ index: true, element: <AdminUsersPage /> }] }]
  }
]);
