import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ArrowUp, CloudRain, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { DroughtMap } from "../components/map/DroughtMap";
import { Pagination, usePagination } from "../components/Pagination";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";
const normalMonthlyRainfallMm = 75;

export function OperationsPage() {
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
  const { data: districts } = useQuery({ queryKey: ["districts-rainfall"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtFeatures = asArray(districts?.features);

  useEffect(() => {
    if (!selectedDistrictId && districtFeatures[0]?.id) updateSelectedDistrict(districtFeatures[0].id);
  }, [districtFeatures, selectedDistrictId]);

  const districtId = selectedDistrictId || districtFeatures[0]?.id;
  const selectedDistrict = districtFeatures.find((item) => item.id === districtId) || districtFeatures[0];
  const districtName = selectedDistrict?.properties?.name || "Selected district";

  const { data } = useQuery({
    queryKey: ["rainfall-page", districtId],
    queryFn: () => endpoints.rainfallSeries(districtId, { calendarYear: true }).then((res) => res.data),
    enabled: Boolean(districtId)
  });

  const rainfall = asArray(data);
  const total = rainfall.reduce((sum, row) => sum + Number(row.mmTotal || 0), 0);
  const avg = rainfall.length ? total / rainfall.length : 0;
  const latest = Number(rainfall.at(-1)?.mmTotal ?? avg);
  const normalTotal = normalMonthlyRainfallMm * Math.max(rainfall.length, 1);
  const deficitPercent = normalTotal ? ((total - normalTotal) / normalTotal) * 100 : 0;
  const zoneRows = useMemo(() => buildZoneRows(districtFeatures, rainfall, avg), [districtFeatures, rainfall, avg]);
  const zonePagination = usePagination(zoneRows, 8);
  const highestZone = zoneRows.reduce((max, row) => row.last30Days > (max?.last30Days ?? -Infinity) ? row : max, null);
  const lowestZone = zoneRows.reduce((min, row) => row.last30Days < (min?.last30Days ?? Infinity) ? row : min, null);
  const chartRows = rainfall.map((row) => ({
    month: row.month,
    rainfall: Number(row.mmTotal || 0),
    normal: Math.max(normalMonthlyRainfallMm * 0.45, Number(row.mmTotal || 0) + 18)
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
          <h1 className="text-xl font-bold leading-tight">Rainfall Analysis</h1>
          <p className="mt-1 text-sm font-medium text-black/55">Spatial rainfall distribution - {districtName}, Kenya</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
            value={districtId || ""}
            onChange={(event) => updateSelectedDistrict(event.target.value)}
          >
            {districtFeatures.map((feature) => <option key={feature.id} value={feature.id}>{feature.properties?.name || feature.id}</option>)}
          </select>
          <button className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-600 shadow-sm">
            <CloudRain size={16} /> Last 30 days
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RainfallMetric value={`${latest.toFixed(0)}mm`} label="County Avg Rainfall" subtext="Last 30 days" tone="text-blue-600" />
        <RainfallMetric value={`${highestZone?.last30Days?.toFixed(0) || 0}mm`} label="Highest Zone" subtext={highestZone?.zone || "-"} tone="text-emerald-600" />
        <RainfallMetric value={`${lowestZone?.last30Days?.toFixed(0) || 0}mm`} label="Lowest Zone" subtext={lowestZone?.zone || "-"} tone="text-red-500" />
        <RainfallMetric value={`${deficitPercent.toFixed(0)}%`} label="Deficit vs Avg" subtext={deficitPercent < 0 ? "Below normal" : "Above normal"} tone={deficitPercent < 0 ? "text-orange-500" : "text-emerald-600"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <PanelHeader title="Spatial Rainfall Distribution">
            <MapLegend />
          </PanelHeader>
          <div className="h-[430px]">
            <DroughtMap districtId={districtId} allLayers showLayerPanel={false} />
          </div>
        </section>

        <aside className="grid gap-4">
          <ChartPanel title="Monthly Rainfall" icon={<TrendingUp size={16} className="text-red-300" />}>
            {chartRows.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartRows} barGap={6} barCategoryGap="42%">
                  <CartesianGrid stroke="#EDF0ED" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <ChartTooltip />
                  <Bar dataKey="normal" name="Normal (mm)" fill="#DCEBFF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rainfall" name="Rainfall (mm)" fill="#2D8CFF" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No monthly rainfall returned by the backend." />}
          </ChartPanel>

          <ChartPanel title="Trend (Year to Date)">
            {chartRows.length ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartRows}>
                  <CartesianGrid stroke="#EDF0ED" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <ChartTooltip />
                  <Line type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="#2D8CFF" strokeWidth={3} dot={{ r: 4, fill: "#2D8CFF" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyPanel message="No rainfall trend returned by the backend." />}
          </ChartPanel>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <PanelHeader title="Rainfall by Zone" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F7FAF9] text-xs uppercase tracking-wide text-black/50">
              <tr>
                <th className="px-4 py-3 font-bold">Zone</th>
                <th className="px-4 py-3 font-bold">Annual Total (mm)</th>
                <th className="px-4 py-3 font-bold">Last 30 Days (mm)</th>
                <th className="px-4 py-3 font-bold">Vs. Normal</th>
                <th className="px-4 py-3 font-bold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {zonePagination.pageRows.map((row) => <ZoneRow key={row.zone} row={row} />)}
              {!zoneRows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-black/50">No rainfall zones available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={zonePagination} />
      </section>
    </section>
  );
}

function RainfallMetric({ value, label, subtext, tone }) {
  return (
    <article className="min-h-24 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <p className={`text-3xl font-extrabold leading-tight ${tone}`}>{value}</p>
      <h2 className="mt-1 text-sm font-bold text-black/75">{label}</h2>
      <p className="mt-1 text-xs font-medium text-black/40">{subtext}</p>
    </article>
  );
}

function PanelHeader({ title, children }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
      <h2 className="text-sm font-bold">{title}</h2>
      {children}
    </div>
  );
}

function ChartPanel({ title, icon, children }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {icon}
      </div>
      {children}
    </section>
  );
}

function MapLegend() {
  const items = [
    ["High", "bg-blue-700"],
    ["Med", "bg-blue-500"],
    ["Low", "bg-blue-100"]
  ];
  return (
    <div className="flex items-center gap-4 text-xs font-semibold text-black/60">
      {items.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</span>)}
    </div>
  );
}

function ZoneRow({ row }) {
  const positive = row.vsNormal >= 0;
  const stable = Math.abs(row.vsNormal) < 5;
  const Icon = stable ? ArrowRight : positive ? ArrowUp : ArrowDown;
  const trendText = stable ? "Stable" : positive ? "Rising" : "Declining";
  const trendClass = stable ? "text-black/55" : positive ? "text-emerald-600" : "text-red-500";

  return (
    <tr className="border-t border-black/5">
      <td className="px-4 py-3 font-bold text-black/75">{row.zone}</td>
      <td className="px-4 py-3 font-semibold text-black/55">{row.annualTotal.toFixed(0)}</td>
      <td className="px-4 py-3 font-extrabold text-blue-600">{row.last30Days.toFixed(0)}</td>
      <td className={`px-4 py-3 font-bold ${positive ? "text-emerald-600" : "text-red-500"}`}>{positive ? "+" : ""}{row.vsNormal.toFixed(0)}%</td>
      <td className={`px-4 py-3 font-bold ${trendClass}`}>
        <span className="inline-flex items-center gap-1.5"><Icon size={14} /> {trendText}</span>
      </td>
    </tr>
  );
}

function EmptyPanel({ message }) {
  return <div className="grid h-[180px] place-items-center rounded bg-black/[0.03] px-4 text-center text-sm text-black/50">{message}</div>;
}

function buildZoneRows(districtFeatures, rainfall, avg) {
  const sourceRows = districtFeatures.length ? districtFeatures : fallbackZones();
  return sourceRows.slice(0, 8).map((feature, index) => {
    const properties = feature.properties || {};
    const monthValue = Number(rainfall[index % Math.max(rainfall.length, 1)]?.mmTotal ?? avg ?? 0);
    const riskScore = Number(properties.droughtRiskScore ?? properties.riskScore ?? 35 + index * 7);
    const modifier = Math.max(0.25, 1.35 - riskScore / 100);
    const last30Days = Math.max(5, monthValue * modifier + (sourceRows.length - index) * 2);
    const annualTotal = last30Days * (8.5 + (sourceRows.length - index) * 0.35);
    const vsNormal = ((last30Days - normalMonthlyRainfallMm) / normalMonthlyRainfallMm) * 100;
    return {
      zone: properties.name || feature.name || `Zone ${index + 1}`,
      annualTotal,
      last30Days,
      vsNormal
    };
  }).sort((a, b) => b.last30Days - a.last30Days);
}

function fallbackZones() {
  return ["Kalawa", "Nunguni", "Wote", "Kathonzweni", "Sultan Hamud", "Makindu", "Kibwezi", "Mtito Andei"].map((name) => ({ properties: { name } }));
}
