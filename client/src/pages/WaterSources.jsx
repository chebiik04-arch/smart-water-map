import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { DroughtMap } from "../components/map/DroughtMap";
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
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Name</th><th>Type</th><th>District</th><th>Status</th><th>Depth</th><th>Yield</th><th>Last Inspected</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((source) => <tr key={source.id} className={`border-t border-black/10 ${selected?.id === source.id ? "bg-emerald-50" : ""}`} onClick={() => setSelected(source)}><td className="p-3 font-medium">{source.name}</td><td><Badge>{source.type}</Badge></td><td>{source.districtName}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[source.status]}`}>{source.status}</span></td><td>{source.depth ?? "-"}</td><td>{source.yield ?? "-"}</td><td>{source.lastInspected ? new Date(source.lastInspected).toLocaleDateString() : "-"}</td><td><button className="text-emerald-700">View</button></td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="h-[520px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <DroughtMap onWaterSourceClick={setSelected} />
        </div>
      </div>
    </section>
  );
}

function Badge({ children }) {
  return <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{children}</span>;
}
