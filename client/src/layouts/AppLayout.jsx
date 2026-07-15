import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Binary,
  CloudRain,
  Droplet,
  FileText,
  Gauge,
  LogOut,
  Map,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  RadioTower,
  Settings,
  Sprout,
  Users
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { WeatherWidget } from "../components/layout/WeatherWidget";
import { endpoints } from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { selectedAoiEventName, selectedAoiStorageKey } from "../hooks/useAoiSelection";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/water-map", label: "Water Map", icon: Map },
  { to: "/water-sources", label: "Water Sources", icon: Droplet },
  { to: "/sensors", label: "Sensors", icon: RadioTower },
  { to: "/operations", label: "Rainfall", icon: CloudRain },
  { to: "/forecasts", label: "Vegetation (NDVI)", icon: Sprout },
  { to: "/simulations", label: "Drought Forecast", icon: Binary },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle, badge: "12" },
  { to: "/reports", label: "Community Reports", icon: Users },
  { to: "/location-settings", label: "Location Settings", icon: MapPin },
  { to: "/developers", label: "Reports", icon: FileText, admin: true },
  { to: "/admin/users", label: "Users", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings }
];

const pageTitles = {
  "/dashboard": "Dashboard",
  "/water-map": "Water Map",
  "/water-sources": "Water Sources",
  "/map": "Water Map",
  "/sensors": "Sensors",
  "/operations": "Rainfall",
  "/alerts": "Alerts",
  "/reports": "Community Reports",
  "/location-settings": "Location Settings",
  "/forecasts": "Vegetation (NDVI)",
  "/advisory": "Water Sources",
  "/simulations": "Drought Forecast",
  "/developers": "Reports",
  "/admin/users": "Users",
  "/settings": "Settings"
};

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("smart-water-map-sidebar") === "collapsed");
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
  const [selectedAoiId, setSelectedAoiId] = useState(() => localStorage.getItem(selectedAoiStorageKey) || "");
  const { data: districts } = useQuery({ queryKey: ["layout-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const { data: aois = [] } = useQuery({ queryKey: ["aois"], queryFn: () => endpoints.aois().then((res) => res.data) });
  const { data: notificationData } = useQuery({ queryKey: ["layout-notifications"], queryFn: () => endpoints.alerts({ limit: 5, status: "ACTIVE" }).then((res) => res.data) });
  const { data: settings } = usePlatformSettings();
  const visibleLinks = links.filter((link) => !link.admin || user?.role === "admin");
  const title = pageTitles[location.pathname] || "Dashboard";
  const selectedDistrict = districts?.features?.find((feature) => feature.id === selectedDistrictId);
  const selectedAoi = aois.find((aoi) => String(aoi.id) === String(selectedAoiId));
  const districtName = selectedAoi?.name || selectedDistrict?.properties?.name || settings?.general?.defaultDistrict || districts?.features?.[0]?.properties?.name || user?.district || "Selected area";
  const organizationName = settings?.organizationName || "Smart Water";
  const country = settings?.country || "Kenya";
  const displayName = user?.name || user?.email || "User";
  const role = user?.role ? user.role.replace("_", " ") : "County Officer";
  const notifications = Array.isArray(notificationData) ? notificationData : [];

  useEffect(() => {
    function handleDistrictChange(event) {
      setSelectedDistrictId(event.detail?.districtId || localStorage.getItem(selectedDistrictStorageKey) || "");
    }

    window.addEventListener(selectedDistrictEventName, handleDistrictChange);
    window.addEventListener("storage", handleDistrictChange);
    return () => {
      window.removeEventListener(selectedDistrictEventName, handleDistrictChange);
      window.removeEventListener("storage", handleDistrictChange);
    };
  }, []);

  useEffect(() => {
    function handleAoiChange(event) {
      setSelectedAoiId(event.detail?.aoiId || localStorage.getItem(selectedAoiStorageKey) || "");
    }

    window.addEventListener(selectedAoiEventName, handleAoiChange);
    window.addEventListener("storage", handleAoiChange);
    return () => {
      window.removeEventListener(selectedAoiEventName, handleAoiChange);
      window.removeEventListener("storage", handleAoiChange);
    };
  }, []);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("smart-water-map-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-[#17201d]">
      <aside data-testid="desktop-sidebar" className={`fixed inset-y-0 left-0 z-20 hidden bg-gradient-to-b from-[#006B58] to-[#003A32] text-white transition-[width] duration-200 lg:flex lg:flex-col ${sidebarCollapsed ? "w-[76px]" : "w-[220px]"}`}>
        <div className={`flex h-[72px] items-center ${sidebarCollapsed ? "justify-center px-3" : "gap-2 px-4"} py-4`}>
          <Link to="/dashboard" className={`flex min-w-0 items-center ${sidebarCollapsed ? "justify-center" : "gap-2"}`} title={organizationName}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10">
              <Droplet className="fill-blue-400 text-blue-400" size={23} />
            </span>
            {!sidebarCollapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight">{organizationName}</span>
                <span className="block text-[10px] text-white/85">Intelligence Platform</span>
              </span>
            )}
          </Link>
        </div>

        <button
          type="button"
          onClick={toggleSidebar}
          className={`mx-3 mb-3 hidden h-9 items-center rounded-md border border-white/15 bg-white/5 text-sm font-medium text-white/90 hover:bg-white/10 lg:flex ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-3"}`}
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {!sidebarCollapsed && <span>Collapse</span>}
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>

        <nav className={`flex-1 space-y-1.5 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {visibleLinks.map(({ to, label, icon: Icon, badge, disabled }) => (
            disabled ? (
              <div key={to} className={`flex items-center rounded-md py-2.5 text-sm font-medium text-white/80 ${sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3"}`} title={label}>
                <Icon size={17} /> {!sidebarCollapsed && <span className="flex-1 leading-snug">{label}</span>}
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `relative flex items-center rounded-md py-2.5 text-sm font-medium transition ${sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3"} ${
                    isActive ? "bg-emerald-500/80 text-white shadow-sm" : "text-white/90 hover:bg-white/10"
                  }`
                }
              >
                <Icon size={17} />
                {!sidebarCollapsed && <span className="flex-1 leading-snug">{label}</span>}
                {badge && <span className={`${sidebarCollapsed ? "absolute right-1 top-1" : ""} rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white`}>{badge}</span>}
              </NavLink>
            )
          ))}
        </nav>

        {!sidebarCollapsed && <div className="mx-4 mb-5">
          <WeatherWidget locationName={districtName} unit={settings?.general?.temperatureUnit} />
        </div>}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex h-full w-[18rem] flex-col bg-gradient-to-b from-[#006B58] to-[#003A32] text-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-4">
              <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                <Droplet className="fill-blue-400 text-blue-400" size={24} />
                <span className="text-sm font-bold">{organizationName}</span>
              </Link>
              <button className="grid h-10 w-10 place-items-center rounded-md hover:bg-white/10" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1.5 px-3">
              {visibleLinks.map(({ to, label, icon: Icon, badge, disabled }) => (
                disabled ? (
                  <div key={to} className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-white/75">
                    <Icon size={17} /><span className="flex-1">{label}</span>
                  </div>
                ) : (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${isActive ? "bg-emerald-500/80" : "hover:bg-white/10"}`}
                  >
                    <Icon size={17} />
                    <span className="flex-1">{label}</span>
                    {badge && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
                  </NavLink>
                )
              ))}
            </nav>
          </aside>
        </div>
      )}

      <main className={`transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[220px]"}`}>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-black/10 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="grid h-10 w-10 place-items-center rounded-md text-black/65 hover:bg-black/5"
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => {
                if (window.matchMedia("(min-width: 1024px)").matches) toggleSidebar();
                else setMobileMenuOpen(true);
              }}
            >
              <Menu size={21} />
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="hidden text-xs text-black/55 sm:block">{districtName}, {country}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationMenu
              open={notificationsOpen}
              onToggle={() => setNotificationsOpen((current) => !current)}
              notifications={notifications}
            />
            <div className="hidden items-center gap-3 border-l border-black/10 pl-3 sm:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#19324c] text-white">J</div>
              <div className="leading-tight">
                <p className="text-sm font-bold">{displayName}</p>
                <p className="text-xs capitalize text-black/55">{role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="grid h-10 w-10 place-items-center rounded-md text-black/60 hover:bg-black/5"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function NotificationMenu({ open, onToggle, notifications }) {
  const count = notifications.length;
  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid h-10 w-10 place-items-center rounded-md text-black/70 hover:bg-black/5"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Notifications"
        onClick={onToggle}
      >
        <Bell size={19} />
        {count > 0 && <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-lg border border-black/10 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <h2 className="text-sm font-bold">Notifications</h2>
            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-600">{count} active</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? notifications.map((item) => (
              <Link key={item.id} to="/alerts" className="block border-b border-black/5 px-4 py-3 hover:bg-black/[0.03]">
                <p className="line-clamp-2 text-sm font-semibold text-black/75">{item.message || item.title || "Active alert"}</p>
                <p className="mt-1 text-xs text-black/45">{item.district?.name || item.districtName || "Selected area"} · {formatNotificationTime(item.createdAt || item.triggeredAt)}</p>
              </Link>
            )) : (
              <div className="px-4 py-6 text-center text-sm text-black/50">No active notifications.</div>
            )}
          </div>
          <Link to="/alerts" className="block bg-[#F7FAF9] px-4 py-3 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50">
            View all alerts
          </Link>
        </div>
      )}
    </div>
  );
}

function formatNotificationTime(value) {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
