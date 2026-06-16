import { useEffect, useState } from "react";
import { SeverityBadge } from "../components/SeverityBadge";
import { endpoints } from "../services/api";
import { useAuthStore } from "../stores/authStore";

export function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const user = useAuthStore((state) => state.user);
  useEffect(() => {
    endpoints.alerts().then(({ data }) => setAlerts(data)).catch(() => {});
  }, []);
  async function resolve(id) {
    await endpoints.resolveAlert(id);
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }
  return (
    <section className="p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-semibold">Alerts</h1>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-white p-4 shadow-panel">
            <div><p className="font-medium">{alert.message}</p><p className="text-sm text-black/60">{alert.district?.name}</p></div>
            <div className="flex items-center gap-3"><SeverityBadge level={alert.severity} />{user?.role === "admin" && <button onClick={() => resolve(alert.id)} className="rounded-md bg-primary px-3 py-2 text-sm text-white">Resolve</button>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

