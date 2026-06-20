import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CloudRain,
  Droplet,
  FileDown,
  MapPin,
  MousePointer2,
  Ruler,
  Sprout,
  TrendingUp,
  Upload,
  Waves,
  Wifi
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { endpoints } from "../services/api";
import { geoJsonPointToLatLng } from "../utils/geoHelpers";
import { asArray } from "../utils/apiData";
import { usePlatformSettings } from "../hooks/usePlatformSettings";

const mapCenter = [-2.25, 37.85];

const emptyFeatureCollection = { type: "FeatureCollection", features: [] };

const riskColors = {
  NORMAL: "#159957",
  WATCH: "#F59E0B",
  WARNING: "#F97316",
  EMERGENCY: "#DC2626"
};

export function DashboardPage() {
  const [activeBasemap, setActiveBasemap] = useState("OpenStreetMap");
  const [basemapsCollapsed, setBasemapsCollapsed] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [layers, setLayers] = useState({
    boreholes: true,
    water: true,
    sensors: true,
    hotspots: true,
    rainfall: false,
    ndvi: false,
    soil: false,
    reports: true
  });
  const { data: settings } = usePlatformSettings();

  useEffect(() => {
    if (settings?.map?.defaultBasemap) setActiveBasemap(settings.map.defaultBasemap);
  }, [settings?.map?.defaultBasemap]);

  const { data: dashboardData = {} } = useQuery({
    queryKey: ["dashboard-page-data"],
    queryFn: async () => {
      const [summaryRes, districtRes, sensorRes, alertRes, reportRes, boreholeRes] = await Promise.allSettled([
        endpoints.dashboardSummary(),
        endpoints.districts(),
        endpoints.sensors(),
        endpoints.alerts({ limit: 5, status: "ACTIVE" }),
        endpoints.communityReports({ limit: 5 }),
        endpoints.boreholes()
      ]);
      return {
        summary: summaryRes.status === "fulfilled" ? summaryRes.value.data : {},
        districts: districtRes.status === "fulfilled" ? districtRes.value.data : emptyFeatureCollection,
        sensors: asArray(sensorRes.status === "fulfilled" ? sensorRes.value.data : []),
        alerts: asArray(alertRes.status === "fulfilled" ? alertRes.value.data : []),
        reports: asArray(reportRes.status === "fulfilled" ? reportRes.value.data : []),
        boreholes: asArray(boreholeRes.status === "fulfilled" ? boreholeRes.value.data : [])
      };
    }
  });

  const summary = dashboardData.summary || {};
  const districts = dashboardData.districts || emptyFeatureCollection;
  const districtFeatures = asArray(districts.features);
  const selectedDistrict = districtFeatures.find((feature) => feature.properties?.name === settings?.general?.defaultDistrict) || districtFeatures[0];
  const selectedDistrictId = selectedDistrict?.id;
  const selectedDistrictName = selectedDistrict?.properties?.name || "Selected area";
  const mapZoom = settings?.map?.defaultZoom || 9;
  const mapCenter = featureCenter(selectedDistrict) || [settings?.map?.centerLat || -2.25, settings?.map?.centerLng || 37.85];
  const sensors = asArray(dashboardData.sensors);
  const alerts = asArray(dashboardData.alerts);
  const reports = asArray(dashboardData.reports);
  const boreholes = asArray(dashboardData.boreholes);
  const onlineSensors = summary.sensors?.online ?? summary.sensorsOnline ?? sensors.filter((sensor) => sensor.status === "ONLINE").length;
  const totalSensors = summary.sensors?.total ?? summary.sensorsOnline ?? sensors.length;
  const waterSourceTotal = summary.waterSources?.total ?? boreholes.length;
  const activeWaterSources = summary.waterSources?.active ?? boreholes.filter((item) => ["FUNCTIONAL", "ACTIVE", "ONLINE"].includes(item.status)).length;
  const alertCount = summary.alertsToday ?? summary.activeAlerts ?? alerts.length;
  const recentReports = reports.length ? reports : asArray(summary.recentCommunityReports);
  const riskLevel = summary.droughtRisk?.level || selectedDistrict?.properties?.droughtRiskLevel || "UNKNOWN";
  const droughtScore = summary.droughtRisk?.score ?? 0;
  const mapPoints = useMemo(() => buildMapPoints({ sensors, reports, boreholes }), [sensors, reports, boreholes]);

  const { data: rainfallData } = useQuery({
    queryKey: ["dashboard-rainfall", selectedDistrictId],
    queryFn: () => endpoints.rainfallSeries(selectedDistrictId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(selectedDistrictId)
  });
  const { data: ndviData } = useQuery({
    queryKey: ["dashboard-ndvi", selectedDistrictId],
    queryFn: () => endpoints.ndviSeries(selectedDistrictId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(selectedDistrictId)
  });
  const { data: groundwaterData } = useQuery({
    queryKey: ["dashboard-groundwater", selectedDistrictId],
    queryFn: () => endpoints.groundwaterSeries(selectedDistrictId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(selectedDistrictId)
  });
  const { data: forecast } = useQuery({
    queryKey: ["dashboard-forecast", selectedDistrictId],
    queryFn: () => endpoints.latestForecast(selectedDistrictId).then((res) => res.data),
    enabled: Boolean(selectedDistrictId)
  });
  const { data: heatmapData } = useQuery({
    queryKey: ["dashboard-heatmap", selectedDistrictId],
    queryFn: () => endpoints.droughtHeatmap({ districtId: selectedDistrictId }).then((res) => res.data),
    enabled: Boolean(selectedDistrictId)
  });
  const rainfallTrend = asArray(rainfallData).map((row) => ({ label: row.month || row.label, value: row.mmTotal ?? row.value ?? 0 }));
  const ndviTrend = asArray(ndviData).map((row) => ({ label: row.month || row.label, value: row.value ?? 0 }));
  const groundwaterTrend = asArray(groundwaterData).map((row) => ({ label: row.month || row.label, value: Math.abs(row.avgDepth ?? row.value ?? 0) }));
  const droughtHotspots = asArray(heatmapData).map((point) => [point.lat ?? point.latitude, point.lng ?? point.longitude, point.radius ?? point.intensity ?? point.value ?? 12]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  return (
    <section className="space-y-4 bg-[#F5F6F4] p-4 text-[#17201d] lg:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Water Sources" value={waterSourceTotal} subtext={`Active: ${activeWaterSources}`} icon={Droplet} iconClass="bg-blue-500 text-white" />
        <MetricCard title="Active Sensors" value={totalSensors} subtext={`Online: ${onlineSensors}`} icon={Wifi} iconClass="bg-emerald-100 text-emerald-700" />
        <MetricCard title="Drought Risk Level" value={riskLevel} subtext={`Score: ${droughtScore.toFixed(2)}`} icon={TrendingUp} danger />
        <MetricCard title="Alerts (Today)" value={alertCount} subtext="View all alerts" compact />
        <MetricCard title="Export Report" value="PDF" subtext="County summary" icon={FileDown} iconClass="bg-primary text-white" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="grid min-h-[390px] grid-cols-1 bg-white xl:grid-cols-[17rem_minmax(0,1fr)_16rem]">
            <aside className="z-[500] border-b border-black/10 bg-white/95 p-4 xl:border-b-0 xl:border-r">
              <h1 className="text-xl font-bold leading-tight">{selectedDistrictName}</h1>
              <p className="mt-1 text-sm text-black/60">{settings?.organizationName || "Smart Water"} · {settings?.country || "Kenya"}</p>

              <label className="mt-4 block text-sm font-semibold">
                County, shapefile or AOI
                <select className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm">
                  <option>{selectedDistrictName} shapefile</option>
                  <option>Select another county</option>
                  <option>Upload shapefile</option>
                  <option>Draw desired AOI</option>
                </select>
              </label>

              <div className="mt-4 rounded-md border border-dashed border-primary/35 bg-primary/5 p-3">
                <p className="text-sm font-bold text-primary">Study area</p>
                <p className="mt-1 text-sm text-black/65">Placeholder for selected county boundary, uploaded shapefile, or drawn area of interest.</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-bold">Map tools</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ToolButton icon={MousePointer2} label="Select" />
                  <ToolButton icon={MapPin} label="Pin" />
                  <ToolButton icon={Ruler} label="Measure" />
                  <ToolButton icon={Upload} label="Upload" />
                </div>
              </div>
            </aside>

            <div className="relative min-h-[390px]">
              <DashboardMap districts={districts} points={mapPoints} layers={layers} activeBasemap={activeBasemap} droughtHotspots={droughtHotspots} center={mapCenter} zoom={mapZoom} />
              <div className="absolute left-4 top-4 z-[500] rounded-md border border-black/10 bg-white/95 px-3 py-2 text-xs font-semibold text-black/70 shadow-sm">
                Settings: {activeBasemap} · Zoom {mapZoom} · {selectedDistrictName}
              </div>
              <div className="absolute bottom-4 left-4 z-[500] rounded-md border border-black/20 bg-white/95 px-3 py-2 shadow-sm">
                <div className="h-1 w-24 border-x-2 border-b-2 border-black" />
                <p className="mt-1 text-xs font-semibold text-black/70">0 5 10 km</p>
              </div>
            </div>

            <aside className="z-[500] space-y-3 border-t border-black/10 bg-white/95 p-4 xl:border-l xl:border-t-0">
              <CollapsiblePanel title="Basemaps" collapsed={basemapsCollapsed} onToggle={() => setBasemapsCollapsed((value) => !value)}>
                {["OpenStreetMap", "Satellite", "Terrain", "Dark Map"].map((item) => (
                  <button key={item} onClick={() => setActiveBasemap(item)} className="mt-2 flex w-full items-center gap-3 rounded-md border border-black/10 p-2 text-left text-sm hover:bg-black/[0.03]">
                    <span className={`h-9 w-11 shrink-0 rounded bg-cover ${basemapSwatch(item)}`} />
                    <span className="flex-1 font-medium">{item}</span>
                    <span className={`h-3.5 w-3.5 rounded-full border ${activeBasemap === item ? "border-emerald-700 bg-emerald-600" : "border-black/25"}`} />
                  </button>
                ))}
              </CollapsiblePanel>

              <CollapsiblePanel title="Layers" collapsed={layersCollapsed} onToggle={() => setLayersCollapsed((value) => !value)}>
                <LayerToggle label="Boreholes" color="bg-blue-500" checked={layers.boreholes} onChange={() => toggleLayer(setLayers, "boreholes")} />
                <LayerToggle label="Water Points" color="bg-emerald-600" checked={layers.water} onChange={() => toggleLayer(setLayers, "water")} />
                <LayerToggle label="Sensors" color="bg-violet-500" checked={layers.sensors} onChange={() => toggleLayer(setLayers, "sensors")} />
                <LayerToggle label="Drought Hotspots" color="bg-orange-500" checked={layers.hotspots} onChange={() => toggleLayer(setLayers, "hotspots")} />
                <LayerToggle label="Rainfall (CHIRPS)" icon={CloudRain} checked={layers.rainfall} onChange={() => toggleLayer(setLayers, "rainfall")} />
                <LayerToggle label="NDVI (Sentinel-2)" icon={Sprout} checked={layers.ndvi} onChange={() => toggleLayer(setLayers, "ndvi")} />
                <LayerToggle label="Soil Moisture (SMAP)" icon={Waves} checked={layers.soil} onChange={() => toggleLayer(setLayers, "soil")} />
                <LayerToggle label="Community Reports" icon={AlertTriangle} checked={layers.reports} onChange={() => toggleLayer(setLayers, "reports")} />
              </CollapsiblePanel>
            </aside>
          </div>
        </div>

        <aside className="space-y-4">
          <FeedPanel
            title="Latest Alerts"
            action="View all"
            headerClass="bg-red-500 text-white"
            items={alerts.slice(0, 3).map((alert, index) => ({
              id: alert.id || index,
              title: alert.message || alert.title,
              subtitle: alert.district?.name || alert.districtName || alert.subtitle,
              meta: alert.createdAt ? relativeTime(alert.createdAt) : alert.meta,
              icon: index === 2 ? CloudRain : AlertTriangle,
              tone: index === 0 ? "text-red-500" : index === 1 ? "text-amber-500" : "text-blue-500"
            }))}
          />
          <FeedPanel
            title="Recent Reports"
            action="View all"
            items={recentReports.slice(0, 4).map((report, index) => ({
              id: report.id || index,
              title: report.description || report.title,
              subtitle: report.createdAt ? formatDate(report.createdAt) : report.subtitle,
              meta: "",
              dot: ["bg-amber-400", "bg-red-500", "bg-orange-500", "bg-yellow-400"][index % 4]
            }))}
          />
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.25fr]">
        <ChartCard title="Rainfall Trend (Last 6 Months)">
          {rainfallTrend.length ? <ResponsiveContainer width="100%" height={150}>
            <BarChart data={rainfallTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value" name="Rainfall (mm)" radius={[3, 3, 0, 0]}>
                {rainfallTrend.map((entry) => <Cell key={entry.label} fill={entry.label === "May" ? "#DDE5F6" : "#2D8CFF"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer> : <EmptyChart message="No rainfall series returned by the backend." />}
        </ChartCard>
        <ChartCard title="Vegetation Health (NDVI)">
          {ndviTrend.length ? <ResponsiveContainer width="100%" height={150}>
            <LineChart data={ndviTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" name="NDVI" stroke="#159957" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer> : <EmptyChart message="No NDVI series returned by the backend." />}
        </ChartCard>
        <ChartCard title="Groundwater Levels">
          {groundwaterTrend.length ? <ResponsiveContainer width="100%" height={150}>
            <LineChart data={groundwaterTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" name="Water Level (m)" stroke="#2D8CFF" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer> : <EmptyChart message="No groundwater series returned by the backend." />}
        </ChartCard>
        <ForecastCard forecast={forecast} />
      </div>
    </section>
  );
}

function DashboardMap({ districts, points, layers, activeBasemap, droughtHotspots, center, zoom }) {
  return (
    <MapContainer key={`${center[0]}-${center[1]}-${zoom}`} center={center} zoom={zoom} minZoom={7} zoomControl className="z-0 h-full min-h-[390px]">
      <TileLayer
        attribution={basemapAttribution(activeBasemap)}
        url={basemapUrl(activeBasemap)}
      />
      {layers.ndvi && (
        <GeoJSON
          data={districts}
          style={() => ({ color: "#159957", fillColor: "#A7F3D0", fillOpacity: 0.24, weight: 1 })}
        />
      )}
      {districts && (
        <GeoJSON
          data={districts}
          style={(feature) => ({
            color: "#2f3431",
            weight: 2,
            fillColor: riskColors[feature.properties?.droughtRiskLevel] || "#F59E0B",
            fillOpacity: 0.08
          })}
        />
      )}
      {layers.hotspots && droughtHotspots.map(([lat, lng, radius]) => (
        <CircleMarker
          key={`${lat}-${lng}`}
          center={[lat, lng]}
          radius={radius}
          pathOptions={{ color: "#F97316", fillColor: "#F97316", fillOpacity: 0.18, opacity: 0.2 }}
        />
      ))}
      {points.map((point) => shouldShowPoint(point.type, layers) && (
        <CircleMarker key={point.id} center={point.position} radius={point.type === "REPORT" ? 7 : 5} pathOptions={pointStyle(point.type)}>
          <Tooltip>{point.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function MetricCard({ title, value, subtext, icon: Icon, iconClass = "", danger = false, compact = false }) {
  return (
    <article className="flex min-h-24 items-center justify-between rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${danger ? "text-red-600" : ""}`}>{value}</p>
        <p className={`mt-1 text-xs ${danger ? "text-red-500" : "text-emerald-700"}`}>{subtext}</p>
      </div>
      {Icon && !compact && <span className={`grid h-14 w-14 place-items-center rounded-full ${danger ? "bg-red-500 text-white" : iconClass}`}><Icon size={28} /></span>}
    </article>
  );
}

function FeedPanel({ title, action, items, headerClass = "", }) {
  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-4 py-3 ${headerClass || ""}`}>
        <div className="flex items-center gap-2">
          {headerClass && <AlertTriangle size={17} />}
          <h2 className="font-bold">{title}</h2>
        </div>
        <button className="text-xs font-medium opacity-80">{action}</button>
      </div>
      <div className="divide-y divide-black/10">
        {items.length ? items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              {Icon ? <Icon className={item.tone} size={18} /> : <span className={`h-3 w-3 rounded-full ${item.dot}`} />}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${item.tone || ""}`}>{item.title}</p>
                <p className="truncate text-xs text-black/55">{item.subtitle}</p>
              </div>
              {item.meta && <p className="text-[11px] text-black/45">{item.meta}</p>}
              {!item.meta && <ArrowRight size={15} className="text-black/35" />}
            </div>
          );
        }) : <p className="px-4 py-6 text-sm text-black/50">No records returned by the backend.</p>}
      </div>
    </section>
  );
}

function ForecastCard({ forecast }) {
  const pct = Math.round((forecast?.riskScore || 0) * 100);
  const riskLabel = forecast?.riskLabel || (pct >= 76 ? "Emergency" : pct >= 51 ? "High Risk" : pct >= 31 ? "Watch" : "Normal");
  const drivers = asArray(forecast?.drivers);
  const recommendations = asArray(forecast?.recommendation);
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">AI Drought Forecast <span className="text-xs font-medium">(Next 30 Days)</span></h2>
      <div className="mt-4 grid grid-cols-[9rem_1fr] gap-5">
        <div className="relative h-36">
          <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#EF4444 0 ${pct}%, #E5E7EB ${pct}% 100%)` }} />
          <div className="absolute inset-[20px] grid place-items-center rounded-full bg-white text-center">
            <p className="text-4xl font-bold">{pct}%</p>
            <p className="text-xs font-bold text-red-500">{riskLabel}</p>
          </div>
        </div>
        <div className="text-xs">
          <p className="font-bold">Drivers</p>
          {drivers.length ? drivers.map((driver) => <Driver key={driver.factor} icon={driver.direction === "UP" ? ArrowUp : ArrowDown} text={driver.factor} />) : <p className="mt-1 text-black/50">No drivers returned.</p>}
          <p className="mt-3 font-bold text-emerald-700">Recommendation</p>
          <p className="mt-1 text-black/65">{recommendations.length ? recommendations.join(". ") : "No recommendations returned."}</p>
        </div>
      </div>
    </section>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

function LayerToggle({ label, color, icon: Icon, checked, onChange }) {
  return (
    <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5 accent-emerald-700" />
      {color ? <span className={`h-3 w-3 rounded-full ${color}`} /> : <Icon size={13} className="text-emerald-700" />}
      <span>{label}</span>
    </label>
  );
}

function CollapsiblePanel({ title, collapsed, onToggle, children }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-sm font-bold">
        <span>{title}</span>
        <ChevronDown size={16} className={`transition ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && <div className="mt-2">{children}</div>}
    </section>
  );
}

function ToolButton({ icon: Icon, label }) {
  return (
    <button type="button" className="flex items-center gap-2 rounded-md border border-black/10 bg-white px-2 py-2 text-sm font-medium hover:bg-black/[0.03]">
      <Icon size={15} className="text-primary" />
      <span>{label}</span>
    </button>
  );
}

function Driver({ icon: Icon, text }) {
  return <p className="mt-1 flex items-center gap-1 text-black/65"><Icon size={12} className="text-red-500" /> {text}</p>;
}

function buildMapPoints({ sensors, reports, boreholes }) {
  return [
    ...boreholes.map((item) => ({ id: item.id, type: "BOREHOLE", label: item.name || "Borehole", position: geoJsonPointToLatLng(item.location) })),
    ...sensors.map((item) => ({ id: item.id, type: "SENSOR", label: item.type || "Sensor", position: geoJsonPointToLatLng(item.location) })),
    ...reports.map((item) => ({ id: item.id, type: "REPORT", label: item.description || "Community report", position: geoJsonPointToLatLng(item.location) }))
  ].filter((item) => item.position);
}

function shouldShowPoint(type, layers) {
  return (
    (type === "BOREHOLE" && layers.boreholes) ||
    (type === "WATER_POINT" && layers.water) ||
    (type === "SENSOR" && layers.sensors) ||
    (type === "REPORT" && layers.reports)
  );
}

function pointStyle(type) {
  const color = {
    BOREHOLE: "#2D8CFF",
    WATER_POINT: "#159957",
    SENSOR: "#7C3AED",
    REPORT: "#F59E0B"
  }[type] || "#2D8CFF";
  return { color: "#FFFFFF", weight: 2, fillColor: color, fillOpacity: 0.95 };
}

function toggleLayer(setLayers, key) {
  setLayers((current) => ({ ...current, [key]: !current[key] }));
}

function basemapSwatch(item) {
  return {
    OpenStreetMap: "bg-[linear-gradient(135deg,#e8efe1_0_35%,#f7f1df_35%_55%,#b8d7ef_55%_100%)]",
    Satellite: "bg-[radial-gradient(circle_at_30%_30%,#789168,#263e28_46%,#102417)]",
    Terrain: "bg-[linear-gradient(135deg,#e4d9bd,#8ba06f_45%,#6f5f42)]",
    "Dark Map": "bg-[linear-gradient(135deg,#0f172a,#1f2937_50%,#111827)]"
  }[item];
}

function basemapUrl(item) {
  if (item === "Satellite") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  if (item === "Terrain") return "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
  if (item === "Dark Map") return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  return import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

function basemapAttribution(item) {
  if (item === "Satellite") return "Tiles &copy; Esri";
  if (item === "Terrain") return "Map data &copy; OpenTopoMap contributors";
  if (item === "Dark Map") return "&copy; OpenStreetMap contributors &copy; CARTO";
  return "&copy; OpenStreetMap contributors";
}

function featureCenter(feature) {
  const coordinates = feature?.geometry?.coordinates?.[0];
  if (!Array.isArray(coordinates) || !coordinates.length) return null;
  const totals = coordinates.reduce((acc, coordinate) => {
    acc.lng += Number(coordinate[0]) || 0;
    acc.lat += Number(coordinate[1]) || 0;
    return acc;
  }, { lat: 0, lng: 0 });
  return [totals.lat / coordinates.length, totals.lng / coordinates.length];
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relativeTime(value) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3600000));
  return `${hours}h ago`;
}

function EmptyChart({ message }) {
  return <div className="grid h-[150px] place-items-center rounded bg-black/[0.03] text-center text-sm text-black/50">{message}</div>;
}
