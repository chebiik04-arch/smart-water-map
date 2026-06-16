import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, Gauge, Layers, LogOut, Map, RadioTower, Users, FileText, CloudSun } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/map", label: "Map", icon: Map },
  { to: "/sensors", label: "Sensors", icon: RadioTower },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/forecasts", label: "Forecasts", icon: CloudSun },
  { to: "/admin/users", label: "Users", icon: Users, admin: true }
];

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const visibleLinks = links.filter((link) => !link.admin || user?.role === "admin");

  return (
    <div className="min-h-screen bg-background text-text">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-black/10 bg-white lg:block">
        <Link to="/dashboard" className="flex h-16 items-center gap-2 px-5 text-lg font-semibold text-primary">
          <Layers size={22} /> Smart Water Map
        </Link>
        <nav className="space-y-1 px-3">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-primary text-white" : "text-text hover:bg-background"
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/10 bg-white/95 px-4 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-primary">Drought operations</p>
            <p className="text-xs text-black/60">{user?.name} · {user?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="inline-flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm hover:bg-background"
          >
            <LogOut size={16} /> Sign out
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

