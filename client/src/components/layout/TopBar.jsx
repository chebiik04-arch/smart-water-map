import { Bell, ChevronDown, Mail, Menu } from "lucide-react";

export function TopBar({ title = "Dashboard", subtitle = "Makueni County, Kenya", user }) {
  const name = user?.name || "Jane Mutua";
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
        <TopIcon icon={Bell} badge="12" label="Notifications" />
        <TopIcon icon={Mail} badge="5" label="Messages" />
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

function TopIcon({ icon: Icon, badge, label }) {
  return (
    <button className="relative grid h-10 w-10 place-items-center rounded-md text-black/70 hover:bg-black/5" aria-label={label} title={label}>
      <Icon size={19} />
      <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span>
    </button>
  );
}
