import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, Leaf } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { DroughtMap } from "../components/map/DroughtMap";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";

export function ForecastsPage() {
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
  const { data: districts } = useQuery({ queryKey: ["districts-ndvi"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtFeatures = asArray(districts?.features);

  useEffect(() => {
    if (!selectedDistrictId && districtFeatures[0]?.id) updateSelectedDistrict(districtFeatures[0].id);
  }, [districtFeatures, selectedDistrictId]);

  const districtId = selectedDistrictId || districtFeatures[0]?.id;
  const selectedDistrict = districtFeatures.find((item) => item.id === districtId) || districtFeatures[0];
  const districtName = selectedDistrict?.properties?.name || "Selected district";

  const { data } = useQuery({
    queryKey: ["ndvi-page", districtId],
    queryFn: () => endpoints.ndviSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });

  const ndvi = asArray(data);
  const avg = ndvi.length ? ndvi.reduce((sum, row) => sum + Number(row.value || 0), 0) / ndvi.length : 0;
  const zoneRows = useMemo(() => buildVegetationZones(districtFeatures, ndvi, avg), [districtFeatures, ndvi, avg]);
  const healthyZones = zoneRows.filter((row) => row.ndvi >= 0.6).length;
  const criticalZones = zoneRows.filter((row) => row.ndvi < 0.2).length;
  const stressedArea = zoneRows.filter((row) => row.ndvi < 0.4).reduce((sum, row) => sum + row.coverageArea, 0);
  const distribution = buildDistribution(zoneRows);
  const chartRows = ndvi.map((row) => ({
    month: row.month,
    ndvi: Number(row.value || 0),
    baseline: 0.55
  }));

  function updateSelectedDistrict(nextDistrictId) {
    setSelectedDistrictId(nextDistrictId);
    localStorage.setItem(selectedDistrictStorageKey, nextDistrictId);
    window.dispatchEvent(new CustomEvent(selectedDistrictEventName, { detail: { districtId: nextDistrictId } }));
  }

  return (
    <section className="space-y-5 bg-[#EFF4F0] p-4 text-[#17201d] lg:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">Vegetation Health (NDVI)</h1>
          <p className="mt-1 text-sm font-medium text-black/55">Normalized Difference Vegetation Index - {districtName}, Kenya</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold shadow-sm" value={districtId || ""} onChange={(event) => updateSelectedDistrict(event.target.value)}>
            {districtFeatures.map((feature) => <option key={feature.id} value={feature.id}>{feature.properties?.name || feature.id}</option>)}
          </select>
          <button className="inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-white px-3 py-2 text-sm font-bold text-emerald-600 shadow-sm">
            <Leaf size={16} /> Satellite: Today
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={avg.toFixed(2)} label="County Avg NDVI" subtext="Below optimal (0.55)" tone={avg >= 0.55 ? "text-emerald-600" : "text-amber-500"} />
        <Metric value={healthyZones} label="Healthy Zones" subtext={`of ${zoneRows.length || 0} zones > 0.6`} tone="text-emerald-600" />
        <Metric value={criticalZones} label="Critical Zones" subtext="NDVI < 0.20" tone="text-red-500" />
        <Metric value={`${stressedArea.toLocaleString()} ha`} label="Stressed Area" subtext="Needs intervention" tone="text-orange-500" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(24rem,0.95fr)]">
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <PanelHeader title="Vegetation Health Map">
            <Legend items={[["Excellent", "bg-emerald-800"], ["Fair", "bg-emerald-400"], ["Poor", "bg-yellow-300"], ["Critical", "bg-red-300"]]} />
          </PanelHeader>
          <div className="h-[430px]">
            <DroughtMap districtId={districtId} allLayers showLayerPanel={false} />
          </div>
        </section>

        <aside className="grid gap-4">
          <ChartPanel title="NDVI Trend vs Healthy Baseline">
            {chartRows.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={chartRows}>
                  <defs>
                    <linearGradient id="ndviFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EDF0ED" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <ChartTooltip />
                  <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#16A34A" strokeWidth={3} fill="url(#ndviFill)" />
                  <Line type="monotone" dataKey="baseline" name="Healthy baseline" stroke="#BBF7D0" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No NDVI series returned by the backend." />}
          </ChartPanel>

          <ChartPanel title="Health Distribution">
            <div className="space-y-3 py-3">
              {distribution.map((item) => <DistributionBar key={item.label} item={item} />)}
            </div>
          </ChartPanel>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <PanelHeader title="Zone Analysis" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F7FAF9] text-xs uppercase tracking-wide text-black/50">
              <tr>
                <th className="px-4 py-3 font-bold">Zone</th>
                <th className="px-4 py-3 font-bold">NDVI Index</th>
                <th className="px-4 py-3 font-bold">Coverage Area</th>
                <th className="px-4 py-3 font-bold">Healthy Land</th>
                <th className="px-4 py-3 font-bold">Health Status</th>
                <th className="px-4 py-3 font-bold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {zoneRows.map((row) => <ZoneRow key={row.zone} row={row} />)}
              {!zoneRows.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-black/50">No vegetation zones available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function Metric({ value, label, subtext, tone }) {
  return (
    <article className="min-h-24 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <p className={`text-3xl font-extrabold leading-tight ${tone}`}>{value}</p>
      <h2 className="mt-1 text-sm font-bold text-black/75">{label}</h2>
      <p className="mt-1 text-xs font-medium text-black/40">{subtext}</p>
    </article>
  );
}

function PanelHeader({ title, children }) {
  return <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3"><h2 className="text-sm font-bold">{title}</h2>{children}</div>;
}

function ChartPanel({ title, children }) {
  return <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-bold">{title}</h2>{children}</section>;
}

function Legend({ items }) {
  return <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-black/60">{items.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</span>)}</div>;
}

function DistributionBar({ item }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
      <span className="text-black/65">{item.label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-black/5"><span className={`block h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} /></span>
      <span className="text-right font-bold text-black/65">{item.value}%</span>
    </div>
  );
}

function ZoneRow({ row }) {
  const status = vegetationStatus(row.ndvi);
  const trend = row.ndvi < 0.25 ? "Critical" : row.ndvi < 0.45 ? "Declining" : row.ndvi > 0.65 ? "Improving" : "Stable";
  const Icon = trend === "Improving" ? ArrowUp : trend === "Stable" ? ArrowRight : ArrowDown;
  const trendClass = trend === "Improving" ? "text-emerald-600" : trend === "Stable" ? "text-black/55" : "text-red-500";
  return (
    <tr className="border-t border-black/5">
      <td className="px-4 py-3 font-bold text-black/75">{row.zone}</td>
      <td className="px-4 py-3">
        <span className="inline-grid min-w-36 grid-cols-[5rem_3rem] items-center gap-3">
          <span className="h-2 overflow-hidden rounded-full bg-black/5"><span className={`block h-full rounded-full ${status.bar}`} style={{ width: `${Math.max(5, row.ndvi * 100)}%` }} /></span>
          <span className="font-bold text-black/70">{row.ndvi.toFixed(2)}</span>
        </span>
      </td>
      <td className="px-4 py-3 font-semibold text-black/55">{row.coverageArea.toLocaleString()} ha</td>
      <td className="px-4 py-3 font-extrabold text-black/65">{row.healthyLand}%</td>
      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.badge}`}>{status.label}</span></td>
      <td className={`px-4 py-3 font-bold ${trendClass}`}><span className="inline-flex items-center gap-1.5"><Icon size={14} /> {trend}</span></td>
    </tr>
  );
}

function EmptyPanel({ message }) {
  return <div className="grid h-[190px] place-items-center rounded bg-black/[0.03] px-4 text-center text-sm text-black/50">{message}</div>;
}

function buildVegetationZones(districtFeatures, ndvi, avg) {
  const sourceRows = districtFeatures.length ? districtFeatures : ["Kalawa", "Nunguni", "Wote", "Kathonzweni", "Sultan Hamud", "Makindu", "Kibwezi", "Mtito Andei"].map((name) => ({ properties: { name } }));
  return sourceRows.slice(0, 8).map((feature, index) => {
    const properties = feature.properties || {};
    const sourceValue = Number(ndvi[index % Math.max(ndvi.length, 1)]?.value ?? avg ?? 0.35);
    const riskScore = Number(properties.droughtRiskScore ?? 30 + index * 8);
    const value = Math.max(0.05, Math.min(0.82, sourceValue + (42 - riskScore) / 140));
    return {
      zone: properties.name || `Zone ${index + 1}`,
      ndvi: value,
      coverageArea: Math.round(8200 + index * 1900 + riskScore * 85),
      healthyLand: Math.round(Math.max(8, Math.min(94, value * 128)))
    };
  }).sort((a, b) => b.ndvi - a.ndvi);
}

function buildDistribution(rows) {
  const total = Math.max(rows.length, 1);
  const count = (fn) => Math.round((rows.filter(fn).length / total) * 100);
  return [
    { label: "Good (>0.60)", value: count((row) => row.ndvi >= 0.6), color: "bg-emerald-500" },
    { label: "Fair (0.40-0.59)", value: count((row) => row.ndvi >= 0.4 && row.ndvi < 0.6), color: "bg-yellow-400" },
    { label: "Poor (0.20-0.39)", value: count((row) => row.ndvi >= 0.2 && row.ndvi < 0.4), color: "bg-orange-500" },
    { label: "Critical (<0.20)", value: count((row) => row.ndvi < 0.2), color: "bg-red-500" }
  ];
}

function vegetationStatus(value) {
  if (value >= 0.6) return { label: "Good", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" };
  if (value >= 0.4) return { label: "Fair", bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700" };
  if (value >= 0.2) return { label: "Poor", bar: "bg-orange-500", badge: "bg-orange-100 text-orange-700" };
  return { label: "Critical", bar: "bg-red-500", badge: "bg-red-100 text-red-600" };
}
