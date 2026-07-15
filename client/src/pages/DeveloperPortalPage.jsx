import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudRain, Download, Droplet, FileText, RadioTower } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Pagination, usePagination } from "../components/Pagination";
import { endpoints } from "../services/api";
import { asArray, featuresToProperties } from "../utils/apiData";
import { matchDistrictForAoi, useAoiSelection } from "../hooks/useAoiSelection";

const reportTypes = [
  { id: "aoi-situation", label: "AOI Situation Report", icon: FileText },
  { id: "drought-rainfall", label: "Drought & Rainfall Report", icon: CloudRain },
  { id: "water-sources", label: "Water Sources Report", icon: Droplet },
  { id: "sensor-health", label: "Sensor Health Report", icon: RadioTower }
];

const timeRanges = [
  { id: "30d", label: "Last 30 days", months: 1, period: "monthly" },
  { id: "90d", label: "Last 90 days", months: 3, period: "monthly" },
  { id: "6m", label: "Last 6 months", months: 6, period: "custom" },
  { id: "12m", label: "Last 12 months", months: 12, period: "annual" }
];

export function DeveloperPortalPage() {
  const [reportType, setReportType] = useState("aoi-situation");
  const [timeRange, setTimeRange] = useState("6m");
  const { aois, selectedAoiId, selectedAoi, selectedAoiName, updateSelectedAoi } = useAoiSelection();
  const { data: districts } = useQuery({ queryKey: ["reports-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const districtFeatures = asArray(districts?.features);
  const districtId = matchDistrictForAoi(districtFeatures, selectedAoi);

  const selectedRange = timeRanges.find((item) => item.id === timeRange) || timeRanges[2];

  const { data: exportReport } = useQuery({
    queryKey: ["reports-export", districtId, timeRange],
    queryFn: () => endpoints.exportReport(districtId ? { districtId, period: selectedRange.period } : { period: selectedRange.period }).then((res) => res.data),
    enabled: Boolean(districtId || districts)
  });
  const { data: summary = {} } = useQuery({
    queryKey: ["reports-dashboard-summary", districtId],
    queryFn: () => endpoints.dashboardSummary(districtId ? { districtId } : undefined).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: rainfallData = [] } = useQuery({
    queryKey: ["reports-rainfall", districtId, timeRange],
    queryFn: () => endpoints.rainfallSeries(districtId, { months: selectedRange.months }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: forecast } = useQuery({
    queryKey: ["reports-forecast", districtId],
    queryFn: () => endpoints.latestForecast(districtId).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: waterSources } = useQuery({
    queryKey: ["reports-water-sources", districtId],
    queryFn: () => endpoints.waterSources({ districtId }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: sensors = [] } = useQuery({
    queryKey: ["reports-sensors", districtId],
    queryFn: () => endpoints.sensors({ district: districtId }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: sensorHealth } = useQuery({
    queryKey: ["reports-sensor-health"],
    queryFn: () => endpoints.sensorHealth().then((res) => res.data),
    enabled: reportType === "sensor-health"
  });

  const rangeStart = useMemo(() => dateMonthsAgo(selectedRange.months), [selectedRange.months]);
  const sourceRows = useMemo(() => filterRowsByDate(featuresToProperties(waterSources), "lastInspected", rangeStart), [waterSources, rangeStart]);
  const rainfallRows = asArray(rainfallData);
  const sensorRows = useMemo(() => filterRowsByDate(asArray(sensors), "lastPing", rangeStart), [sensors, rangeStart]);
  const activeReport = reportTypes.find((item) => item.id === reportType) || reportTypes[0];
  const report = useMemo(() => buildReport({
    reportType,
    areaName: selectedAoiName,
    summary,
    exportReport,
    rainfallRows,
    forecast,
    sourceRows,
    sensorRows,
    sensorHealth,
    timeRangeLabel: selectedRange.label
  }), [reportType, selectedAoiName, summary, exportReport, rainfallRows, forecast, sourceRows, sensorRows, sensorHealth, selectedRange.label]);
  const reportPagination = usePagination(report.rows, 9);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report.payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportType}-${selectedAoiName || "aoi"}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Reports</h1>
          <p className="text-sm text-black/55">Generate operational reports from AOI water, drought, rainfall, and sensor data.</p>
        </div>
        <button onClick={downloadJson} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Download size={15} /> Download Report</button>
      </div>

      <div className="grid gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm lg:grid-cols-3">
        <label className="block text-sm font-semibold">
          Report type
          <select className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm" value={reportType} onChange={(event) => setReportType(event.target.value)}>
            {reportTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          AOI / county
          <select className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm" value={selectedAoiId} onChange={(event) => updateSelectedAoi(event.target.value)}>
            {aois.map((aoi) => <option key={aoi.id} value={aoi.id}>{aoi.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Time range
          <select className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm" value={timeRange} onChange={(event) => setTimeRange(event.target.value)}>
            {timeRanges.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <activeReport.icon size={18} className="text-emerald-700" />
            <h2 className="text-sm font-bold">{activeReport.label}</h2>
          </div>
          <p className="mt-1 text-xs text-black/45">{selectedAoiName || "Selected AOI"} · {selectedRange.label} · Generated {new Date().toLocaleDateString()}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {report.metrics.map((metric) => <MiniStat key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />)}
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.chart}>
                <CartesianGrid stroke="#EDF0ED" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip />
                <Bar dataKey="value" fill={report.chartColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4">
            <h2 className="text-sm font-bold">Report Details</h2>
            <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-semibold text-black/60">{report.rows.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="p-3">Category</th>
                  <th>Details</th>
                  <th>Status / Value</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {reportPagination.pageRows.map((row) => (
                  <tr key={row.key} className="border-t border-black/10">
                    <td className="p-3 font-medium">{row.category}</td>
                    <td>{row.details}</td>
                    <td>{row.status}</td>
                    <td>{row.updated}</td>
                  </tr>
                ))}
                {!report.rows.length && <tr><td colSpan={4} className="p-6 text-center text-sm text-black/50">No report rows available for this AOI.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination pagination={reportPagination} />
        </section>
      </div>
    </section>
  );
}

function buildReport({ reportType, areaName, summary, exportReport, rainfallRows, forecast, sourceRows, sensorRows, sensorHealth, timeRangeLabel }) {
  if (reportType === "drought-rainfall") return droughtRainfallReport({ areaName, rainfallRows, forecast, summary, timeRangeLabel });
  if (reportType === "water-sources") return waterSourcesReport({ areaName, sourceRows, timeRangeLabel });
  if (reportType === "sensor-health") return sensorHealthReport({ areaName, sensorRows, sensorHealth, timeRangeLabel });
  return aoiSituationReport({ areaName, summary, exportReport, rainfallRows, forecast, sourceRows, sensorRows, timeRangeLabel });
}

function aoiSituationReport({ areaName, summary, exportReport, rainfallRows, forecast, sourceRows, sensorRows, timeRangeLabel }) {
  const activeSources = sourceRows.filter((item) => item.status === "ACTIVE").length;
  const onlineSensors = sensorRows.filter((item) => item.status === "ONLINE" || item.statusCode === "ONLINE").length;
  const lowCapacity = sourceRows.filter((item) => capacityPercent(item) < 20).length;
  const strongCapacity = sourceRows.filter((item) => capacityPercent(item) >= 50).length;
  const latestRainfall = Number(rainfallRows.at(-1)?.mmTotal || 0);
  return {
    chartColor: "#059669",
    metrics: [
      { label: "Water Sources", value: sourceRows.length || summary.waterSources?.total || 0 },
      { label: "Active Sources", value: `${activeSources || summary.waterSources?.active || 0} (${pct(activeSources, sourceRows.length)})`, tone: "text-emerald-700" },
      { label: "Sensors", value: sensorRows.length || summary.sensors?.total || 0 },
      { label: "Sources >50%", value: `${strongCapacity} (${pct(strongCapacity, sourceRows.length)})`, tone: "text-blue-700" }
    ],
    chart: [
      { name: "Sources", value: sourceRows.length || summary.waterSources?.total || 0 },
      { name: "Active", value: activeSources || summary.waterSources?.active || 0 },
      { name: "<20%", value: lowCapacity },
      { name: ">50%", value: strongCapacity }
    ],
    rows: [
      row("summary-range", "Summary", "Reporting period", timeRangeLabel, "-"),
      row("summary-water", "Summary", "Water source coverage", `${sourceRows.length || summary.waterSources?.total || 0} total`, "-"),
      row("summary-capacity-low", "Capacity", "Sources below 20% estimated capacity", `${lowCapacity} (${pct(lowCapacity, sourceRows.length)})`, "-"),
      row("summary-capacity-strong", "Capacity", "Sources at or above 50% estimated capacity", `${strongCapacity} (${pct(strongCapacity, sourceRows.length)})`, "-"),
      row("summary-sensors", "Summary", "Sensor network", `${onlineSensors || summary.sensors?.online || 0}/${sensorRows.length || summary.sensors?.total || 0} online (${pct(onlineSensors, sensorRows.length)})`, "-"),
      row("summary-risk", "Drought", `${areaName} risk forecast`, forecast?.riskLabel || summary.droughtRisk?.level || "Unknown", forecast?.forecastDate ? date(forecast.forecastDate) : "-"),
      row("summary-rainfall", "Rainfall", "Latest monthly rainfall", `${latestRainfall} mm`, rainfallRows.at(-1)?.month || "-"),
      ...asArray(exportReport?.activeAlerts).map((alert) => row(`alert-${alert.id}`, "Alert", alert.message, alert.severity, date(alert.triggeredAt)))
    ],
    payload: { reportType: "aoi-situation", areaName, timeRange: timeRangeLabel, summary, exportReport, latestForecast: forecast, rainfall: rainfallRows, capacity: { below20Percent: lowCapacity, above50Percent: strongCapacity } }
  };
}

function droughtRainfallReport({ areaName, rainfallRows, forecast, summary, timeRangeLabel }) {
  const total = rainfallRows.reduce((sum, item) => sum + Number(item.mmTotal || 0), 0);
  const avg = rainfallRows.length ? total / rainfallRows.length : 0;
  const normal = rainfallRows.length * 75;
  const deficit = normal ? ((total - normal) / normal) * 100 : 0;
  const riskScore = Math.round(Number(forecast?.riskScore || summary.droughtRisk?.score || 0) * 100);
  return {
    chartColor: "#2563EB",
    metrics: [
      { label: "YTD Rainfall", value: `${Math.round(total)} mm`, tone: "text-blue-700" },
      { label: "Monthly Avg", value: `${Math.round(avg)} mm` },
      { label: "Vs Normal", value: `${deficit.toFixed(0)}%`, tone: deficit < 0 ? "text-red-600" : "text-emerald-700" },
      { label: "Confidence", value: `${Math.round(Number(forecast?.confidenceScore || 0) * 100)}%` }
    ],
    chart: rainfallRows.map((item) => ({ name: item.month, value: Number(item.mmTotal || 0) })),
    rows: [
      row("rain-range", "Summary", "Reporting period", timeRangeLabel, "-"),
      row("rain-total", "Rainfall", "Total rainfall", `${Math.round(total)} mm`, `${deficit.toFixed(0)}% vs normal`),
      row("rain-risk", "Drought", "Risk index", `${riskScore}%`, forecast?.riskLabel || summary.droughtRisk?.level || "-"),
      ...rainfallRows.map((item) => row(`rain-${item.month}`, "Rainfall", item.month, `${item.mmTotal} mm`, item.source || "CHIRPS")),
      row("forecast", "Drought Forecast", `${areaName} 30-day forecast`, forecast?.riskLabel || summary.droughtRisk?.level || "Unknown", forecast?.forecastDate ? date(forecast.forecastDate) : "-"),
      ...asArray(forecast?.drivers).map((driver) => row(`driver-${driver.id || driver.factor}`, "Forecast Driver", driver.factor, driver.impact, driver.direction))
    ],
    payload: { reportType: "drought-rainfall", areaName, timeRange: timeRangeLabel, rainfall: rainfallRows, rainfallSummary: { total, average: avg, deficitPercent: deficit }, forecast }
  };
}

function waterSourcesReport({ areaName, sourceRows, timeRangeLabel }) {
  const active = sourceRows.filter((item) => item.status === "ACTIVE").length;
  const dry = sourceRows.filter((item) => item.status === "DRY").length;
  const maintenance = sourceRows.filter((item) => item.status === "UNDER_REPAIR").length;
  const capacity = capacityBuckets(sourceRows);
  return {
    chartColor: "#0EA5E9",
    metrics: [
      { label: "Total Sources", value: sourceRows.length },
      { label: "Below 20%", value: `${capacity.below20} (${pct(capacity.below20, sourceRows.length)})`, tone: "text-red-600" },
      { label: "20-50%", value: `${capacity.between20And50} (${pct(capacity.between20And50, sourceRows.length)})`, tone: "text-amber-600" },
      { label: "Above 50%", value: `${capacity.above50} (${pct(capacity.above50, sourceRows.length)})`, tone: "text-emerald-700" }
    ],
    chart: [
      { name: "<20%", value: capacity.below20 },
      { name: "20-50%", value: capacity.between20And50 },
      { name: ">50%", value: capacity.above50 },
      { name: "Unknown", value: capacity.unknown }
    ],
    rows: [
      row("water-range", "Summary", "Reporting period", timeRangeLabel, "-"),
      row("water-active", "Status", "Active sources", `${active} (${pct(active, sourceRows.length)})`, "-"),
      row("water-dry", "Status", "Dry sources", `${dry} (${pct(dry, sourceRows.length)})`, "-"),
      row("water-maintenance", "Status", "Under repair", `${maintenance} (${pct(maintenance, sourceRows.length)})`, "-"),
      ...sourceRows.map((source) => {
        const capacityPercent = capacityPercentLabel(source);
        return row(source.id, source.type, source.name, `${source.status} · ${capacityPercent} capacity · ${source.latestLevel ?? "-"} m`, source.lastInspected ? date(source.lastInspected) : "-");
      })
    ],
    payload: { reportType: "water-sources", areaName, timeRange: timeRangeLabel, capacity, waterSources: sourceRows }
  };
}

function sensorHealthReport({ areaName, sensorRows, sensorHealth, timeRangeLabel }) {
  const staleRows = asArray(sensorHealth?.stale);
  const online = sensorRows.filter((item) => item.status === "ONLINE" || item.statusCode === "ONLINE").length;
  const offline = sensorRows.filter((item) => item.status === "OFFLINE" || item.statusCode === "OFFLINE").length;
  const maintenance = sensorRows.filter((item) => item.status === "MAINTENANCE" || item.statusCode === "MAINTENANCE").length;
  return {
    chartColor: "#7C3AED",
    metrics: [
      { label: "Sensors", value: sensorRows.length },
      { label: "Online", value: `${online} (${pct(online, sensorRows.length)})`, tone: "text-emerald-700" },
      { label: "Offline", value: `${offline} (${pct(offline, sensorRows.length)})`, tone: "text-red-600" },
      { label: "Stale", value: `${staleRows.length} (${pct(staleRows.length, sensorRows.length)})`, tone: staleRows.length ? "text-amber-600" : "text-emerald-700" }
    ],
    chart: [
      { name: "Online", value: online },
      { name: "Offline", value: offline },
      { name: "Maint.", value: maintenance },
      { name: "Stale", value: staleRows.length }
    ],
    rows: [
      row("sensor-range", "Summary", "Reporting period", timeRangeLabel, "-"),
      ...sensorRows.map((sensor) => row(sensor.id, sensor.type, sensor.externalId || sensor.districtName || "Sensor", `${sensor.status} · ${sensor.latestValue ?? "-"} ${sensor.latestUnit || ""}`, sensor.lastPing ? date(sensor.lastPing) : "-")),
      ...staleRows.map((sensor) => row(`stale-${sensor.id}`, "Stale Sensor", sensor.districtName || sensor.type, `${Number(sensor.hoursSincePing || 0).toFixed(1)} hrs since ping`, sensor.openTickets ? `${sensor.openTickets} tickets` : "No ticket"))
    ],
    payload: { reportType: "sensor-health", areaName, timeRange: timeRangeLabel, sensors: sensorRows, sensorHealth, percentages: { online: pct(online, sensorRows.length), offline: pct(offline, sensorRows.length), stale: pct(staleRows.length, sensorRows.length) } }
  };
}

function MiniStat({ label, value, tone = "text-black" }) {
  return <div className="rounded-md bg-black/[0.03] p-3"><p className="text-xs text-black/50">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div>;
}

function row(key, category, details, status, updated) {
  return { key, category, details, status, updated };
}

function date(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function pct(value, total) {
  return `${total ? Math.round((Number(value || 0) / total) * 100) : 0}%`;
}

function capacityBuckets(sourceRows) {
  return sourceRows.reduce((buckets, source) => {
    const capacity = capacityPercent(source);
    if (capacity === null) buckets.unknown += 1;
    else if (capacity < 20) buckets.below20 += 1;
    else if (capacity < 50) buckets.between20And50 += 1;
    else buckets.above50 += 1;
    return buckets;
  }, { below20: 0, between20And50: 0, above50: 0, unknown: 0 });
}

function capacityPercentLabel(source) {
  const capacity = capacityPercent(source);
  return capacity === null ? "unknown" : `${capacity}%`;
}

function capacityPercent(source) {
  const latestLevel = Number(source.latestLevel);
  if (!Number.isFinite(latestLevel)) return null;
  if (latestLevel >= 0 && latestLevel <= 100) return Math.round(latestLevel);
  return Math.max(0, Math.min(100, Math.round(100 - Math.abs(latestLevel) * 8)));
}

function filterRowsByDate(rows, field, startDate) {
  return rows.filter((row) => {
    if (!row[field]) return true;
    return new Date(row[field]) >= startDate;
  });
}

function dateMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}
