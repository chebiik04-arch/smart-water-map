import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Droplet, Sprout } from "lucide-react";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

const severityTone = {
  EMERGENCY: "text-red-600 bg-red-50",
  WARNING: "text-orange-600 bg-orange-50",
  WATCH: "text-yellow-700 bg-yellow-50"
};

export function AlertsPage() {
  const { data } = useQuery({
    queryKey: ["alerts-page"],
    queryFn: () => endpoints.alerts({ limit: 50, status: "ACTIVE" }).then((res) => res.data)
  });
  const { data: districts } = useQuery({ queryKey: ["alerts-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const rows = asArray(data);
  const districtName = districts?.features?.[0]?.properties?.name || "Selected area";
  const counts = {
    Critical: rows.filter((alert) => alert.severity === "EMERGENCY").length,
    High: rows.filter((alert) => alert.severity === "WARNING").length,
    Medium: rows.filter((alert) => alert.severity === "WATCH").length,
    Low: rows.filter((alert) => alert.severity === "NORMAL" || alert.severity === "LOW").length
  };

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Alerts</h1><p className="text-sm text-black/55">{districtName}, Kenya</p></div>
        <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>All Alerts</option></select>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <AlertMetric label="Critical" value={counts.Critical} tone="text-red-600" />
        <AlertMetric label="High" value={counts.High} tone="text-orange-600" />
        <AlertMetric label="Medium" value={counts.Medium} tone="text-yellow-600" />
        <AlertMetric label="Low" value={counts.Low} tone="text-blue-600" />
      </div>
      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 p-4"><h2 className="font-bold">Recent Alerts</h2></div>
        <table className="w-full text-left text-sm">
          <thead className="bg-background"><tr><th className="p-3">Alert</th><th>Severity</th><th>Location</th><th>Time</th></tr></thead>
          <tbody>
            {rows.map((alert, index) => {
              const Icon = iconFor(alert.alertType);
              return (
                <tr key={alert.id || index} className="border-t border-black/10">
                  <td className="p-3"><span className="flex items-center gap-2"><Icon size={16} className={toneFor(alert.alertType)} />{alert.message}</span></td>
                  <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityTone[alert.severity] || severityTone.WATCH}`}>{labelFor(alert.severity)}</span></td>
                  <td>{alert.subDistrict || alert.district?.name}</td>
                  <td>{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : "-"}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-black/50">No active alerts returned by the backend.</td></tr>}
          </tbody>
        </table>
        <div className="p-4 text-right"><a href="/alerts" className="text-sm font-medium text-blue-600">View all alerts</a></div>
      </section>
    </section>
  );
}

function AlertMetric({ label, value, tone }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 text-center shadow-sm"><p className={`text-sm font-semibold ${tone}`}>{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>;
}

function iconFor(type) {
  if (type === "LOW_WATER_LEVELS") return Droplet;
  if (type === "RAINFALL_DEFICIT") return AlertTriangle;
  if (type === "COMMUNITY_REPORT") return Sprout;
  return AlertTriangle;
}

function toneFor(type) {
  return type === "LOW_WATER_LEVELS" ? "text-blue-500" : type === "RAINFALL_DEFICIT" ? "text-amber-500" : "text-red-500";
}

function labelFor(severity) {
  return severity === "EMERGENCY" ? "Critical" : severity === "WARNING" ? "High" : "Medium";
}
