import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  RadioTower,
  Settings,
  Sprout,
  Users
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useLanguageStore } from "../stores/languageStore";
import { languages } from "../i18n/translations";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/map", label: "Water Map", icon: Map },
  { to: "/advisory", label: "Water Sources", icon: Droplet },
  { to: "/sensors", label: "Sensors", icon: RadioTower },
  { to: "/operations", label: "Rainfall", icon: CloudRain },
  { to: "/forecasts", label: "Vegetation (NDVI)", icon: Sprout },
  { to: "/simulations", label: "Drought Forecast", icon: Binary },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle, badge: "12" },
  { to: "/reports", label: "Community Reports", icon: Users },
  { to: "/developers", label: "Reports", icon: FileText, admin: true },
  { to: "/admin/users", label: "Users", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings, disabled: true }
];

const pageTitles = {
  "/dashboard": "Dashboard",
  "/map": "Water Map",
  "/sensors": "Sensors",
  "/operations": "Rainfall",
  "/alerts": "Alerts",
  "/reports": "Community Reports",
  "/forecasts": "Vegetation (NDVI)",
  "/advisory": "Water Sources",
  "/simulations": "Drought Forecast",
  "/developers": "Reports",
  "/admin/users": "Users"
};

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleLinks = links.filter((link) => !link.admin || user?.role === "admin");
  const title = pageTitles[location.pathname] || "Dashboard";
  const displayName = user?.name || "Jane Mutua";
  const role = user?.role ? user.role.replace("_", " ") : "County Officer";

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-[#17201d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 bg-gradient-to-b from-[#006B58] to-[#003A32] text-white lg:flex lg:flex-col">
        <Link to="/dashboard" className="flex h-20 items-center gap-3 px-5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
            <Droplet className="fill-blue-400 text-blue-400" size={28} />
          </span>
          <span>
            <span className="block text-xl font-bold leading-tight">Smart Water</span>
            <span className="block text-sm text-white/85">Intelligence Platform</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          {visibleLinks.map(({ to, label, icon: Icon, badge, disabled }) => (
            disabled ? (
              <div key={to} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-white/80">
                <Icon size={18} /> <span className="flex-1">{label}</span>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
                    isActive ? "bg-emerald-500/80 text-white shadow-sm" : "text-white/90 hover:bg-white/10"
                  }`
                }
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
              </NavLink>
            )
          ))}
        </nav>

        <div className="mx-5 mb-6 border-t border-white/15 pt-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CloudRain size={22} className="text-sky-300" />
            Makueni Weather
          </div>
          <p className="mt-4 text-3xl font-bold">27°C</p>
          <p className="text-sm text-white/85">Cloudy</p>
          <p className="mt-3 text-sm text-white/85">Humidity: 54%</p>
          <p className="text-sm text-white/85">Wind: 18 km/h</p>
          <button className="mt-4 text-sm font-medium text-emerald-300">View full forecast</button>
        </div>
      </aside>

      <main className="lg:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/10 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="grid h-10 w-10 place-items-center rounded-md text-black/65 hover:bg-black/5" aria-label="Open menu">
              <Menu size={21} />
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="hidden text-sm text-black/55 sm:block">Makueni County, Kenya</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="hidden rounded-md border border-black/10 bg-white px-2 py-2 text-sm md:block"
              aria-label="Language"
            >
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
