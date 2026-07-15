import { useState } from "react";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { Link } from "react-router-dom";

export function TopBar({ title = "Dashboard", subtitle = "Selected area", user }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const name = user?.name || user?.email || "User";
  const role = user?.role ? user.role.replace("_", " ") : "County Officer";
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-black/10 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <button className="grid h-10 w-10 place-items-center rounded-md text-black/65 hover:bg-black/5" aria-label="Open menu">
          <Menu size={21} />
        </button>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="hidden text-sm text-black/55 sm:block">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            className="relative grid h-10 w-10 place-items-center rounded-md text-black/70 hover:bg-black/5"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="menu"
            title="Notifications"
            onClick={() => setNotificationsOpen((current) => !current)}
          >
            <Bell size={19} />
            <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">12</span>
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-lg border border-black/10 bg-white shadow-xl">
              <div className="border-b border-black/10 px-4 py-3">
                <h2 className="text-sm font-bold">Notifications</h2>
                <p className="mt-1 text-xs text-black/45">Recent active alerts</p>
              </div>
              <Link to="/alerts" className="block px-4 py-3 text-sm font-semibold text-black/70 hover:bg-black/[0.03]">View drought and water alerts</Link>
              <Link to="/alerts" className="block bg-[#F7FAF9] px-4 py-3 text-center text-sm font-bold text-emerald-700 hover:bg-emerald-50">View all alerts</Link>
            </div>
          )}
        </div>
        <div className="hidden items-center gap-3 border-l border-black/10 pl-3 sm:flex">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#19324c] text-white">{name[0]}</div>
          <div className="leading-tight">
            <p className="text-sm font-bold">{name}</p>
            <p className="text-xs capitalize text-black/55">{role}</p>
          </div>
          <ChevronDown size={16} className="text-black/45" />
        </div>
      </div>
    </header>
  );
}
