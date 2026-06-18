import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudRain, Droplet } from "lucide-react";
import { endpoints } from "../../services/api";
import { createSocket } from "../../services/socket";
import { asArray } from "../../utils/apiData";

const alertConfig = {
  HIGH_DROUGHT_RISK: { icon: AlertTriangle, tone: "text-red-500" },
  LOW_WATER_LEVELS: { icon: Droplet, tone: "text-blue-500" },
  RAINFALL_DEFICIT: { icon: CloudRain, tone: "text-amber-500" },
  SENSOR_OFFLINE: { icon: AlertTriangle, tone: "text-orange-500" },
  COMMUNITY_REPORT: { icon: AlertTriangle, tone: "text-yellow-500" }
};

export function AlertsPanel({ districtId, limit = 5 }) {
  const { data } = useQuery({
    queryKey: ["alerts-feed", districtId, limit],
    queryFn: () => endpoints.alerts({ districtId, limit, status: "ACTIVE" }).then((res) => res.data)
  });
  const [items, setItems] = useState([]);

  useEffect(() => setItems(asArray(data)), [data]);
  useEffect(() => {
    const socket = createSocket();
    socket.on("alert:new", (alert) => setItems((current) => [alert, ...current].slice(0, limit)));
    return () => socket.disconnect();
  }, [limit]);

  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-red-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2"><AlertTriangle size={17} /><h2 className="font-bold">Latest Alerts</h2></div>
        <a href="/alerts" className="text-xs font-medium opacity-90">View all</a>
      </div>
      <div className="divide-y divide-black/10">
        {items.slice(0, limit).map((alert) => {
          const config = alertConfig[alert.alertType] || alertConfig.HIGH_DROUGHT_RISK;
          const Icon = config.icon;
          return (
            <div key={alert.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className={config.tone} size={18} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${config.tone}`}>{alert.message}</p>
                <p className="truncate text-xs text-black/55">{alert.subDistrict || alert.district?.name}</p>
              </div>
              <p className="text-[11px] text-black/45">{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleTimeString() : "-"}</p>
            </div>
          );
        })}
        {!items.length && <p className="px-4 py-6 text-sm text-black/50">No active alerts returned by the backend.</p>}
      </div>
    </section>
  );
}
