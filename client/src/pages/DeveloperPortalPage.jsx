import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function DeveloperPortalPage() {
  const [tab, setTab] = useState("annual");
  const { data: districts } = useQuery({ queryKey: ["reports-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtId = districts?.features?.[0]?.id;
  const { data: report } = useQuery({
    queryKey: ["reports-export", districtId],
    queryFn: () => endpoints.exportReport(districtId ? { districtId } : undefined).then((res) => res.data),
    enabled: Boolean(districts)
  });

  const summary = report?.summary || {};
  const topWaterSources = asArray(report?.topWaterSources);
  const activeAlerts = asArray(report?.activeAlerts);
  const rainfall = asArray(report?.rainfall);
  const chartData = useMemo(() => [
    { name: "Water Sources", value: summary.waterSources?.total || 0 },
    { name: "Active", value: summary.waterSources?.active || 0 },
    { name: "Sensors", value: summary.sensors?.total || 0 },
    { name: "Online", value: summary.sensors?.online || 0 }
  ], [summary]);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report || {}, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `smart-water-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reports</h1>
          <p className="text-sm text-black/55">Makueni County summary exports</p>
        </div>
        <button onClick={downloadJson} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Download Report</button>
      </div>

      <div className="flex gap-2 rounded-lg border border-black/10 bg-white p-1 shadow-sm">
        <Tab active={tab === "annual"} onClick={() => setTab("annual")}>Annual Report</Tab>
        <Tab active={tab === "monthly"} onClick={() => setTab("monthly")}>Monthly Report</Tab>
        <Tab active={tab === "custom"} onClick={() => setTab("custom")}>Custom Date Range</Tab>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Water Sources" value={summary.waterSources?.total || 0} />
            <MiniStat label="Active Sources" value={summary.waterSources?.active || 0} />
            <MiniStat label="Sensors" value={summary.sensors?.total || 0} />
            <MiniStat label="Online" value={summary.sensors?.online || 0} />
          </div>
          <div className="mt-4 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <Bar dataKey="value" fill="#2D8CFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-black/10 p-4"><h2 className="text-sm font-bold">Detailed Report</h2></div>
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Category</th><th>Details</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {topWaterSources.map((source) => <tr key={source.id} className="border-t border-black/10"><td className="p-3 font-medium">{source.type}</td><td>{source.name}</td><td>{source.status}</td><td>{source.lastInspected ? new Date(source.lastInspected).toLocaleDateString() : "-"}</td></tr>)}
              {activeAlerts.map((alert) => <tr key={alert.id} className="border-t border-black/10"><td className="p-3 font-medium">Alert</td><td>{alert.message}</td><td>{alert.severity}</td><td>{alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleDateString() : "-"}</td></tr>)}
              {rainfall.map((row) => <tr key={row.id || row.month} className="border-t border-black/10"><td className="p-3 font-medium">Rainfall</td><td>{row.month}</td><td>{row.mmTotal} mm</td><td>-</td></tr>)}
              {!topWaterSources.length && !activeAlerts.length && !rainfall.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-black/50">No report rows returned by the backend.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

function Tab({ active, onClick, children }) {
  return <button onClick={onClick} className={`rounded-md px-4 py-2 text-sm font-semibold ${active ? "bg-emerald-700 text-white" : "text-black/65 hover:bg-black/[0.03]"}`}>{children}</button>;
}

function MiniStat({ label, value }) {
  return <div><p className="text-xs text-black/50">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}
