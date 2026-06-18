import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DroughtMap } from "../components/map/DroughtMap";
import { TimeSeriesChart } from "../components/TimeSeriesChart";
import { endpoints } from "../services/api";

export function WaterMap() {
  const [selectedSource, setSelectedSource] = useState(null);
  const { data: sources } = useQuery({
    queryKey: ["water-map-sources"],
    queryFn: () => endpoints.waterSources().then((res) => res.data)
  });
  const rows = useMemo(() => (sources?.features || []).map((feature) => feature.properties), [sources]);

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="h-[470px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <DroughtMap allLayers showLayerPanel={false} showLegend onWaterSourceClick={setSelectedSource} />
      </div>
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <h2 className="text-sm font-bold">Water Points ({rows.length || 124})</h2>
          <a href="/water-sources" className="text-xs font-medium text-blue-600">View all</a>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-background"><tr><th className="p-3">Name</th><th>Type</th><th>Sub-county</th><th>Status</th><th>Water Level</th><th>Last Updated</th></tr></thead>
          <tbody>
            {(rows.length ? rows : fallbackRows).slice(0, 6).map((source) => (
              <tr key={source.id || source.name} className="border-t border-black/10">
                <td className="p-3 font-medium">{source.name}</td>
                <td>{source.type}</td>
                <td>{source.districtName || source.subCounty}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${source.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : source.status === "DRY" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{source.status}</span></td>
                <td>{source.latestLevel ?? source.waterLevel ?? "-"} m</td>
                <td>{source.lastInspected ? new Date(source.lastInspected).toLocaleTimeString() : source.updated || "12 mins ago"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedSource && (
        <aside className="fixed right-0 top-0 z-[700] h-full w-96 max-w-full border-l border-black/10 bg-white p-4 shadow-panel">
          <button className="mb-4 text-sm text-black/60" onClick={() => setSelectedSource(null)}>Close</button>
          <h1 className="text-xl font-bold">{selectedSource.name}</h1>
          <p className="mt-1 text-sm text-black/60">{selectedSource.type} · {selectedSource.status}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Depth" value={selectedSource.depth ?? "n/a"} />
            <Metric label="Yield" value={selectedSource.yield ?? "n/a"} />
            <Metric label="Latest level" value={selectedSource.latestLevel ?? "n/a"} />
            <Metric label="Last inspected" value={selectedSource.lastInspected ? new Date(selectedSource.lastInspected).toLocaleDateString() : "n/a"} />
          </div>
          <div className="mt-4"><TimeSeriesChart data={[]} height={220} /></div>
          <button className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Edit source</button>
        </aside>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-background p-3"><p className="text-xs text-black/50">{label}</p><p className="font-semibold">{value}</p></div>;
}

const fallbackRows = [
  { name: "Kibwezi Borehole 04", type: "Borehole", subCounty: "Kibwezi West", status: "ACTIVE", waterLevel: "18.4", updated: "5 mins ago" },
  { name: "Mbooni Borehole 02", type: "Borehole", subCounty: "Mbooni", status: "ACTIVE", waterLevel: "21.7", updated: "12 mins ago" },
  { name: "Kilome Dam", type: "Surface Water", subCounty: "Kilome", status: "UNDER_REPAIR", waterLevel: "4.2", updated: "30 mins ago" },
  { name: "Kaiti Water Point", type: "Water Point", subCounty: "Kaiti", status: "ACTIVE", waterLevel: "-", updated: "1 hour ago" }
];
