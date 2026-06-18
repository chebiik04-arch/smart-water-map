import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { RainfallChart } from "../components/charts/RainfallChart";
import { DroughtMap } from "../components/map/DroughtMap";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function OperationsPage() {
  const { data: districts } = useQuery({ queryKey: ["districts-rainfall"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtId = useMemo(() => districts?.features?.[0]?.id, [districts]);
  const { data } = useQuery({
    queryKey: ["rainfall-page", districtId],
    queryFn: () => endpoints.rainfallSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const rainfall = asArray(data);
  const districtName = districts?.features?.find((item) => item.id === districtId)?.properties?.name || "Selected district";
  const total = rainfall.reduce((sum, row) => sum + row.mmTotal, 0);
  const avg = rainfall.length ? total / rainfall.length : 0;
  const wettest = rainfall.reduce((max, row) => row.mmTotal > (max?.mmTotal || 0) ? row : max, null);
  const driest = rainfall.reduce((min, row) => row.mmTotal < (min?.mmTotal ?? Infinity) ? row : min, null);

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Rainfall Analysis</h1><p className="text-sm text-black/55">{districtName}, Kenya</p></div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>CHIRPS</option></select>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>Last 6 Months</option></select>
          <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Export</button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="h-[430px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <DroughtMap districtId={districtId} />
        </div>
        <div className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Rainfall (mm)</h2>
          <div className="mt-4 h-72 rounded-md bg-gradient-to-b from-blue-100 to-blue-500" />
          <div className="mt-3 flex justify-between text-xs text-black/60"><span>0</span><span>200</span></div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <RainfallChart districtId={districtId} />
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Monthly Statistics</h2>
          <Stat label="Total (6 Months)" value={`${total.toFixed(1)} mm`} />
          <Stat label="Average Monthly" value={`${avg.toFixed(1)} mm`} />
          <Stat label="Wettest Month" value={wettest ? `${wettest.month} (${wettest.mmTotal} mm)` : "-"} />
          <Stat label="Driest Month" value={driest ? `${driest.month} (${driest.mmTotal} mm)` : "-"} />
        </section>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return <div className="mt-4"><p className="text-xs text-black/50">{label}</p><p className="font-bold">{value}</p></div>;
}
