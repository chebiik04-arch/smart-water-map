import { Link, NavLink } from "react-router-dom";
import { AlertTriangle, Binary, CloudRain, Droplet, FileText, Gauge, Map, RadioTower, Settings, Sprout, Users } from "lucide-react";
import { WeatherWidget } from "./WeatherWidget";
import { canAccessView } from "../../utils/accessControl";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, view: "dashboard" },
  { to: "/water-map", label: "Water Map", icon: Map, view: "waterMap" },
  { to: "/water-sources", label: "Water Sources", icon: Droplet, view: "waterSources" },
  { to: "/sensors", label: "Sensors", icon: RadioTower, view: "sensors" },
  { to: "/operations", label: "Rainfall", icon: CloudRain, view: "rainfall" },
  { to: "/forecasts", label: "Vegetation (NDVI)", icon: Sprout, view: "vegetation" },
  { to: "/simulations", label: "Drought Forecast", icon: Binary, view: "droughtForecast" },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle, badge: "12", view: "alerts" },
  { to: "/reports", label: "Community Reports", icon: Users, view: "communityReports" },
  { to: "/developers", label: "Reports", icon: FileText, view: "reports" },
  { to: "/admin/users", label: "Users", icon: Users, view: "users" },
  { to: "/settings", label: "Settings", icon: Settings, view: "settings" }
];

export function Sidebar({ user, districtId }) {
  const visibleLinks = links.filter((link) => canAccessView(user?.role, link.view));
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[190px] bg-[#1B4D3E] text-white lg:flex lg:flex-col">
      <Link to="/dashboard" className="flex h-20 items-center gap-2 px-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
          <Droplet className="fill-blue-400 text-blue-400" size={25} />
        </span>
        <span>
          <span className="block text-lg font-bold leading-tight">Smart Water</span>
          <span className="block text-xs text-white/85">Intelligence Platform</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {visibleLinks.map(({ to, label, icon: Icon, badge, disabled }) => (
          disabled ? (
            <div key={to} className="flex items-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium text-white/80">
              <Icon size={16} /> <span className="flex-1">{label}</span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium transition ${isActive ? "bg-emerald-500/80 text-white" : "text-white/90 hover:bg-white/10"}`}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
            </NavLink>
          )
        ))}
      </nav>
      <div className="mx-4 mb-5">
        <WeatherWidget districtId={districtId} />
      </div>
    </aside>
  );
}
