import { useState } from "react";
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
  Mail,
  Map,
  Menu,
  X,
  RadioTower,
  Settings,
  Sprout,
  Users
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useLanguageStore } from "../stores/languageStore";
import { languages } from "../i18n/translations";
import { WeatherWidget } from "../components/layout/WeatherWidget";
import { endpoints } from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

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
  "/forecasts": "Vegetation (NDVI)",
  "/advisory": "Water Sources",
  "/simulations": "Drought Forecast",
  "/developers": "Reports",
  "/admin/users": "Users",
  "/settings": "Settings"
};

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: districts } = useQuery({ queryKey: ["layout-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const { data: settings } = usePlatformSettings();
  const visibleLinks = links.filter((link) => !link.admin || user?.role === "admin");
  const title = pageTitles[location.pathname] || "Dashboard";
  const districtName = settings?.general?.defaultDistrict || districts?.features?.[0]?.properties?.name || user?.district || "Selected area";
  const organizationName = settings?.organizationName || "Smart Water";
  const country = settings?.country || "Kenya";
  const displayName = user?.name || user?.email || "User";
  const role = user?.role ? user.role.replace("_", " ") : "County Officer";

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-[#17201d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[220px] bg-gradient-to-b from-[#006B58] to-[#003A32] text-white lg:flex lg:flex-col">
        <Link to="/dashboard" className="flex h-[72px] items-center gap-2 px-4 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <Droplet className="fill-blue-400 text-blue-400" size={23} />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight">{organizationName}</span>
            <span className="block text-[10px] text-white/85">Intelligence Platform</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1.5 px-3">
          {visibleLinks.map(({ to, label, icon: Icon, badge, disabled }) => (
            disabled ? (
              <div key={to} className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-white/80">
                <Icon size={17} /> <span className="flex-1 leading-snug">{label}</span>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-emerald-500/80 text-white shadow-sm" : "text-white/90 hover:bg-white/10"
                  }`
                }
              >
                <Icon size={17} />
                <span className="flex-1 leading-snug">{label}</span>
                {badge && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
              </NavLink>
            )
          ))}
        </nav>

        <div className="mx-4 mb-5">
          <WeatherWidget locationName={districtName} unit={settings?.general?.temperatureUnit} />
        </div>
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

      <main className="lg:pl-[220px]">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-black/10 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="grid h-10 w-10 place-items-center rounded-md text-black/65 hover:bg-black/5" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={21} />
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="hidden text-xs text-black/55 sm:block">{districtName}, {country}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="hidden rounded-md border border-black/10 bg-white px-2 py-1.5 text-xs md:block" aria-label="Language">
              {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <TopIcon icon={Bell} badge="12" label="Notifications" />
            <TopIcon icon={Mail} badge="5" label="Messages" />
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

function TopIcon({ icon: Icon, badge, label }) {
  return (
    <button className="relative grid h-10 w-10 place-items-center rounded-md text-black/70 hover:bg-black/5" aria-label={label} title={label}>
      <Icon size={19} />
      <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span>
    </button>
  );
}
