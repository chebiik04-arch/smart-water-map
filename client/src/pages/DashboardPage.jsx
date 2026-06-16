import { useEffect, useState } from "react";
import { AlertTriangle, FileText, MapPinned, RadioTower } from "lucide-react";
import { endpoints } from "../services/api";

export function DashboardPage() {
  const [summary, setSummary] = useState({ activeAlerts: 0, sensorsOnline: 0, districtsAtRisk: 0, recentCommunityReports: [] });

  useEffect(() => {
    endpoints.summary().then(({ data }) => setSummary(data)).catch(() => {});
  }, []);

  const cards = [
    { label: "Active alerts", value: summary.activeAlerts, icon: AlertTriangle, tone: "text-danger" },
    { label: "Sensors online", value: summary.sensorsOnline, icon: RadioTower, tone: "text-safe" },
    { label: "Districts at risk", value: summary.districtsAtRisk, icon: MapPinned, tone: "text-warning" },
    { label: "Recent reports", value: summary.recentCommunityReports?.length || 0, icon: FileText, tone: "text-primary" }
  ];

  return (
    <section className="p-4 lg:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="rounded-lg border border-black/10 bg-white p-5 shadow-panel">
            <Icon className={tone} size={22} />
            <p className="mt-5 text-3xl font-semibold">{value}</p>
            <p className="text-sm text-black/60">{label}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

