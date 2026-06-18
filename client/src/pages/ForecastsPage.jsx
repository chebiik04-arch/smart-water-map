import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { NDVIChart } from "../components/charts/NDVIChart";
import { DroughtMap } from "../components/map/DroughtMap";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function ForecastsPage() {
  const { data: districts } = useQuery({ queryKey: ["districts-ndvi"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtId = useMemo(() => districts?.features?.[0]?.id, [districts]);
  const { data } = useQuery({
    queryKey: ["ndvi-page", districtId],
    queryFn: () => endpoints.ndviSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const ndvi = asArray(data);
  const districtName = districts?.features?.find((item) => item.id === districtId)?.properties?.name || "Selected district";
  const avg = ndvi.length ? ndvi.reduce((sum, row) => sum + row.value, 0) / ndvi.length : 0;
  const healthy = ndvi.length ? Math.min(100, Math.round(avg * 122)) : 0;
  const moderate = ndvi.length ? Math.max(0, Math.round((1 - avg) * 55)) : 0;
  const low = ndvi.length ? Math.max(0, 100 - healthy - moderate) : 0;

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Vegetation Health (NDVI)</h1><p className="text-sm text-black/55">{districtName}, Kenya</p></div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>Sentinel-2</option></select>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>Last 1 Month</option></select>
          <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Export</button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="h-[430px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <DroughtMap districtId={districtId} />
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">NDVI</h2>
          <div className="mt-4 h-72 rounded-md bg-gradient-to-b from-green-500 via-yellow-300 to-red-500" />
          <div className="mt-3 flex justify-between text-xs text-black/60"><span>-1.0</span><span>1.0</span></div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <NDVIChart districtId={districtId} />
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">NDVI Statistics</h2>
          <Stat label="Average NDVI" value={avg.toFixed(2)} tone="text-emerald-700" />
          <Stat label="Healthy Vegetation" value={`${healthy}%`} />
          <Stat label="Moderate Vegetation" value={`${moderate}%`} />
          <Stat label="Low Vegetation" value={`${low}%`} />
        </section>
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "" }) {
  return <div className="mt-4"><p className="text-xs text-black/50">{label}</p><p className={`font-bold ${tone}`}>{value}</p></div>;
}
