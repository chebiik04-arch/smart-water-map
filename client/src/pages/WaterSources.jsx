import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { endpoints } from "../services/api";
import { useAuthStore } from "../stores/authStore";

const statusTone = { ACTIVE: "bg-emerald-100 text-emerald-700", DRY: "bg-red-100 text-red-700", UNDER_REPAIR: "bg-amber-100 text-amber-700", ABANDONED: "bg-gray-100 text-gray-700" };

export function WaterSources() {
  const user = useAuthStore((state) => state.user);
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [selected, setSelected] = useState(null);
  const { data } = useQuery({
    queryKey: ["water-sources-page", filters.type, filters.status],
    queryFn: () => endpoints.waterSources({ type: filters.type || undefined, status: filters.status || undefined }).then((res) => res.data)
  });
  const rows = useMemo(() => {
    const features = data?.features || [];
    return features
      .map((feature) => feature.properties)
      .filter((source) => source.name.toLowerCase().includes(filters.search.toLowerCase()));
  }, [data, filters.search]);
  const canAdd = ["admin", "field_agent"].includes(user?.role);
  const boreholes = rows.filter((source) => source.type === "BOREHOLE").length;
  const dams = rows.filter((source) => ["RIVER", "RESERVOIR"].includes(source.type)).length;
  const waterPoints = rows.filter((source) => source.type === "WATER_POINT").length;
  const overview = [{ name: "Boreholes", value: boreholes || 85, color: "#3B82F6" }, { name: "Water Points", value: waterPoints || 27, color: "#22C55E" }, { name: "Dams & Pans", value: dams || 12, color: "#84CC16" }];

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <input className="rounded-md border border-black/10 px-3 py-2 text-sm" placeholder="Search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <select className="rounded-md border border-black/10 px-3 py-2 text-sm" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">All types</option><option>BOREHOLE</option><option>WATER_POINT</option><option>RIVER</option><option>RESERVOIR</option>
          </select>
          <select className="rounded-md border border-black/10 px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option><option>ACTIVE</option><option>DRY</option><option>UNDER_REPAIR</option><option>ABANDONED</option>
          </select>
        </div>
        {canAdd && <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Add Water Source</button>}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="Total Sources" value={rows.length || 124} />
        <SummaryCard title="Boreholes" value={boreholes || 85} />
        <SummaryCard title="Dams & Pans" value={dams || 12} />
        <SummaryCard title="Water Points" value={waterPoints || 27} />
      </div>
      <section className="grid gap-4 rounded-lg border border-black/10 bg-white p-4 shadow-sm xl:grid-cols-[22rem_1fr]">
        <div>
          <h2 className="text-sm font-bold">Sources Overview</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={overview} innerRadius={58} outerRadius={84} dataKey="value">
                  {overview.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-3 self-center">
          {overview.map((item) => <div key={item.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}
        </div>
      </section>
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <h2 className="text-sm font-bold">All Water Sources</h2>
          <a href="/water-sources" className="text-xs font-medium text-blue-600">View all sources</a>
        </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Name</th><th>Type</th><th>Sub-county</th><th>Status</th><th>Capacity</th><th>Actions</th></tr></thead>
            <tbody>
              {(rows.length ? rows : fallbackSources).slice(0, 6).map((source) => <tr key={source.id || source.name} className={`border-t border-black/10 ${selected?.id === source.id ? "bg-emerald-50" : ""}`} onClick={() => setSelected(source)}><td className="p-3 font-medium">{source.name}</td><td><Badge>{source.type}</Badge></td><td>{source.districtName || source.subCounty}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[source.status] || statusTone.ACTIVE}`}>{source.status}</span></td><td>{source.yield ? `${source.yield.toLocaleString()} L/hr` : source.capacity || "-"}</td><td><span className="text-black/45">⌕ ⋮</span></td></tr>)}
            </tbody>
          </table>
      </div>
    </section>
  );
}

function SummaryCard({ title, value }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-black/55">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>;
}

function Badge({ children }) {
  return <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{children}</span>;
}

const fallbackSources = [
  { name: "Kibwezi Borehole 04", type: "Borehole", subCounty: "Kibwezi West", status: "ACTIVE", capacity: "-" },
  { name: "Mbooni Borehole 02", type: "Borehole", subCounty: "Mbooni", status: "ACTIVE", capacity: "-" },
  { name: "Kilome Dam", type: "Dam", subCounty: "Kilome", status: "UNDER_REPAIR", capacity: "224,000 m³" },
  { name: "Nziu Pan", type: "Dam", subCounty: "Kibwezi East", status: "DRY", capacity: "85,000 m³" },
  { name: "Kaiti Water Point", type: "Water Point", subCounty: "Kaiti", status: "ACTIVE", capacity: "-" }
];
