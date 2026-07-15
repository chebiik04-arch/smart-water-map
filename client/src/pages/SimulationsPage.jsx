import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Droplet, Radio, RefreshCw, ShieldAlert, Truck, Wrench } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { DroughtMap } from "../components/map/DroughtMap";
import { Pagination, usePagination } from "../components/Pagination";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";
import { matchDistrictForAoi, useAoiSelection } from "../hooks/useAoiSelection";

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";

export function SimulationsPage() {
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
  const [rainfallDropPercent, setRainfallDropPercent] = useState(30);
  const { aois, selectedAoiId, selectedAoi, selectedAoiName, selectedAoiGeometry, updateSelectedAoi } = useAoiSelection();
  const { data: districts } = useQuery({ queryKey: ["drought-forecast-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtFeatures = asArray(districts?.features);

  useEffect(() => {
    if (!selectedDistrictId && districtFeatures[0]?.id) updateSelectedDistrict(districtFeatures[0].id);
  }, [districtFeatures, selectedDistrictId]);

  const districtId = matchDistrictForAoi(districtFeatures, selectedAoi, selectedDistrictId);
  const selectedDistrict = districtFeatures.find((feature) => feature.id === districtId) || districtFeatures[0];
  const districtName = selectedAoiName || selectedDistrict?.properties?.name || "Selected district";

  const { data: forecast } = useQuery({
    queryKey: ["forecast-page-latest", districtId],
    queryFn: () => endpoints.latestForecast(districtId).then((res) => res.data),
    enabled: Boolean(districtId)
  });

  const riskPercent = Math.round(Number(forecast?.riskScore || selectedDistrict?.properties?.droughtRiskScore / 100 || 0.62) * 100);
  const confidence = forecast?.confidenceScore ? Math.round(forecast.confidenceScore * 100) : 87;
  const riskLabel = riskText(riskPercent);
  const zoneRows = useMemo(() => buildRiskRows(districtFeatures, riskPercent), [districtFeatures, riskPercent]);
  const zonePagination = usePagination(zoneRows, 8);
  const weeklyTrend = [1, 2, 3, 4].map((week) => ({ week: `Wk ${week}`, risk: Math.min(98, Math.max(12, riskPercent - 9 + week * 4)) }));
  const recommendations = buildRecommendations(forecast?.recommendation, riskPercent, rainfallDropPercent);

  function updateSelectedDistrict(nextDistrictId) {
    setSelectedDistrictId(nextDistrictId);
    localStorage.setItem(selectedDistrictStorageKey, nextDistrictId);
    window.dispatchEvent(new CustomEvent(selectedDistrictEventName, { detail: { districtId: nextDistrictId } }));
  }

  return (
    <section className="space-y-5 bg-[#EFF4F0] p-4 text-[#17201d] lg:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">Drought Forecast</h1>
          <p className="mt-1 text-sm font-medium text-black/55">AI-powered 30-day risk projection - {districtName}, Kenya</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold shadow-sm" value={selectedAoiId} onChange={(event) => updateSelectedAoi(event.target.value)}>
            {aois.map((aoi) => <option key={aoi.id} value={aoi.id}>{aoi.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold shadow-sm">
            <span>Rainfall drop</span>
            <input className="w-16 rounded border border-black/10 px-2 py-1 text-right" type="number" min="0" max="100" value={rainfallDropPercent} onChange={(event) => setRainfallDropPercent(Number(event.target.value || 0))} />
            <span>%</span>
          </label>
          <button className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black/65 shadow-sm">
            <Download size={16} /> Export Report
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-center text-sm font-bold">AI Risk Index</h2>
          <p className="mt-1 text-center text-sm text-black/45">30-Day Forecast</p>
          <Gauge percent={riskPercent} label={riskLabel} />
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Confidence" value={`${confidence}%`} />
            <SummaryRow label="Model" value={forecast?.modelVersion || "LSTM v2.4"} />
            <SummaryRow label="Updated" value={forecast?.forecastDate ? new Date(forecast.forecastDate).toLocaleDateString() : "2 hrs ago"} />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 px-3 py-3 text-sm font-bold text-red-600">
            <AlertTriangle size={16} /> Extreme drought expected in southern zones
          </div>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">AI Recommendations</h2>
          <div className="mt-4 space-y-2">
            {recommendations.map((item) => <Recommendation key={item.text} item={item} />)}
          </div>
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">Weekly Risk Trend</h2>
          <p className="mt-1 text-xs text-black/45">Projected 30-day evolution</p>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={205}>
              <BarChart data={weeklyTrend} barCategoryGap="45%">
                <defs>
                  <linearGradient id="weeklyRiskGradient" x1="0" x2="0" y1="1" y2="0">
                    <stop offset="0%" stopColor="#FED7AA" />
                    <stop offset="48%" stopColor="#F97316" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                  <linearGradient id="weeklyExtremeGradient" x1="0" x2="0" y1="1" y2="0">
                    <stop offset="0%" stopColor="#FEE2E2" />
                    <stop offset="46%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#7F1D1D" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EDF0ED" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <ChartTooltip />
                <Bar dataKey="risk" name="Risk %" radius={[5, 5, 0, 0]}>
                  {weeklyTrend.map((entry) => <Cell key={entry.week} fill={entry.risk >= 80 ? "url(#weeklyExtremeGradient)" : "url(#weeklyRiskGradient)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-black/55">Risk is <span className="font-bold text-red-500">increasing</span> over the next 30 days without intervention.</p>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(24rem,0.95fr)]">
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <PanelHeader title="Spatial Drought Risk Map">
            <Legend />
          </PanelHeader>
          <div className="relative h-[430px]">
            <DroughtMap districtId={districtId} aoiGeometry={selectedAoiGeometry} aoiName={selectedAoiName} allLayers showLayerPanel={false} />
            <IntensityScale />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <PanelHeader title="Zone Risk Breakdown" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F7FAF9] text-xs uppercase tracking-wide text-black/50">
                <tr>
                  <th className="px-4 py-3 font-bold">Zone</th>
                  <th className="px-4 py-3 font-bold">Risk %</th>
                  <th className="px-4 py-3 font-bold">Population</th>
                  <th className="px-4 py-3 font-bold">Level</th>
                </tr>
              </thead>
              <tbody>
                {zonePagination.pageRows.map((row) => <RiskRow key={row.zone} row={row} />)}
                {!zoneRows.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-black/50">No risk zones available.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination pagination={zonePagination} />
        </section>
      </div>
    </section>
  );
}

function Gauge({ percent, label }) {
  const arcEnd = 25 + percent / 2;
  return (
    <div className="mx-auto mt-6 h-32 w-56 overflow-hidden">
      <div
        className="relative h-56 w-56 rounded-full"
        style={{
          background: `conic-gradient(from 270deg, #E5E7EB 0 25%, #F97316 25%, #EF4444 ${Math.max(25, arcEnd - 12)}%, #7F1D1D ${arcEnd}%, #E5E7EB ${arcEnd}% 75%, transparent 75% 100%)`
        }}
      >
        <div className="absolute inset-8 rounded-full bg-white" />
        <div className="absolute inset-x-0 top-[5.2rem] text-center">
          <p className="text-4xl font-extrabold leading-none text-red-600">{percent}%</p>
          <p className="mt-1 text-xs font-extrabold uppercase text-red-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Recommendation({ item }) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3 rounded-md bg-[#F8FAFA] px-3 py-3 text-sm">
      <Icon size={17} className={item.tone} />
      <span className="flex-1 font-semibold text-black/65">{item.text}</span>
      <span className={`rounded px-2 py-1 text-xs font-extrabold ${severityClass(item.severity)}`}>{item.severity}</span>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return <div className="flex items-center justify-between"><span className="text-black/55">{label}</span><span className="font-extrabold">{value}</span></div>;
}

function PanelHeader({ title, children }) {
  return <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3"><h2 className="text-sm font-bold">{title}</h2>{children}</div>;
}

function Legend() {
  const items = [
    ["Extreme", "from-red-200 via-red-600 to-red-950"],
    ["High", "from-orange-100 via-orange-500 to-red-700"],
    ["Moderate", "from-yellow-100 via-yellow-400 to-orange-500"],
    ["Low", "from-emerald-50 via-lime-200 to-yellow-300"]
  ];
  return <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-black/60">{items.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className={`h-4 w-3 rounded-full bg-gradient-to-t ${color}`} />{label}</span>)}</div>;
}

function IntensityScale() {
  return (
    <div className="absolute bottom-4 right-4 z-[500] rounded-md border border-black/10 bg-white/95 p-3 text-xs font-bold text-black/60 shadow-sm">
      <div className="grid grid-cols-[0.75rem_1fr] gap-2">
        <span className="h-32 rounded-full bg-gradient-to-t from-yellow-100 via-orange-500 to-red-950" />
        <div className="flex h-32 flex-col justify-between">
          <span>Extreme</span>
          <span>High</span>
          <span>Moderate</span>
          <span>Low</span>
        </div>
      </div>
    </div>
  );
}

function RiskRow({ row }) {
  const level = riskLevel(row.risk);
  return (
    <tr className="border-t border-black/5">
      <td className="px-4 py-3 font-bold text-black/75">{row.zone}</td>
      <td className="px-4 py-3">
        <span className="inline-grid min-w-32 grid-cols-[4rem_3rem] items-center gap-3">
          <span className="h-2 overflow-hidden rounded-full bg-black/5"><span className={`block h-full rounded-full ${level.bar}`} style={{ width: `${row.risk}%` }} /></span>
          <span className="font-extrabold text-black/70">{row.risk}%</span>
        </span>
      </td>
      <td className="px-4 py-3 font-semibold text-black/55">{row.population.toLocaleString()}</td>
      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${level.badge}`}>{level.label}</span></td>
    </tr>
  );
}

function buildRiskRows(districtFeatures, baseRisk) {
  const sourceRows = districtFeatures.length ? districtFeatures : ["Mtito Andei", "Kibwezi", "Makindu", "Sultan Hamud", "Kathonzweni", "Wote", "Nunguni", "Kalawa"].map((name) => ({ properties: { name } }));
  return sourceRows.slice(0, 8).map((feature, index) => {
    const properties = feature.properties || {};
    const propertyRisk = Number(properties.droughtRiskScore ?? baseRisk + (index - 3) * 7);
    const risk = Math.max(16, Math.min(98, Math.round(propertyRisk || baseRisk)));
    return {
      zone: properties.name || `Zone ${index + 1}`,
      risk,
      population: Math.round(11200 + index * 3700 + risk * 120)
    };
  }).sort((a, b) => b.risk - a.risk);
}

function buildRecommendations(recommendation, riskPercent, rainfallDropPercent) {
  const backendItems = asArray(recommendation);
  if (backendItems.length) {
    return backendItems.slice(0, 6).map((text, index) => ({
      text,
      icon: [Droplet, ShieldAlert, Wrench, Radio, Truck, RefreshCw][index % 6],
      severity: index < 2 || riskPercent >= 80 ? "Critical" : index < 4 ? "High" : "Medium",
      tone: index < 2 ? "text-red-500" : "text-orange-500"
    }));
  }
  return [
    { text: `Reduce irrigation by ${Math.max(20, rainfallDropPercent + 5)}% across high-risk farms`, icon: Droplet, severity: "Critical", tone: "text-sky-500" },
    { text: "Activate emergency water reserves in Kibwezi", icon: ShieldAlert, severity: "Critical", tone: "text-red-500" },
    { text: "Repair MT-BH-04 borehole - 320 households affected", icon: Wrench, severity: "High", tone: "text-black/50" },
    { text: "Deploy SMS drought alerts to 1,200 farmers", icon: Radio, severity: "High", tone: "text-black/60" },
    { text: "Coordinate NGO water trucking for Mtito Andei", icon: Truck, severity: "Medium", tone: "text-orange-500" },
    { text: "Switch to drought-resistant crop varieties", icon: RefreshCw, severity: "Medium", tone: "text-emerald-600" }
  ];
}

function riskText(percent) {
  if (percent >= 85) return "Extreme";
  if (percent >= 65) return "High Risk";
  if (percent >= 45) return "Moderate";
  return "Low";
}

function riskLevel(percent) {
  if (percent >= 85) return { label: "Extreme", bar: "bg-gradient-to-t from-red-200 via-red-600 to-red-950", badge: "bg-red-100 text-red-600" };
  if (percent >= 65) return { label: "High", bar: "bg-gradient-to-t from-orange-100 via-orange-500 to-red-700", badge: "bg-orange-100 text-orange-700" };
  if (percent >= 45) return { label: "Moderate", bar: "bg-gradient-to-t from-yellow-100 via-yellow-400 to-orange-500", badge: "bg-yellow-100 text-yellow-700" };
  return { label: "Low", bar: "bg-gradient-to-t from-emerald-50 via-lime-200 to-yellow-300", badge: "bg-emerald-100 text-emerald-700" };
}

function severityClass(severity) {
  if (severity === "Critical") return "bg-red-50 text-red-600";
  if (severity === "High") return "bg-orange-50 text-orange-600";
  return "bg-yellow-50 text-yellow-700";
}
