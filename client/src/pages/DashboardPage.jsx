import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CloudRain,
  Download,
  Droplet,
  Layers,
  Sprout,
  TrendingUp,
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

const mapCenter = [-2.25, 37.85];

const fallbackDistrict = {
  type: "FeatureCollection",
  features: [
    {
      id: "makueni",
      type: "Feature",
      properties: { name: "Makueni County", droughtRiskLevel: "WARNING" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [37.08, -1.62],
          [37.62, -1.43],
          [38.26, -1.63],
          [38.74, -2.01],
          [38.52, -2.72],
          [37.88, -2.95],
          [37.24, -2.67],
          [36.95, -2.1],
          [37.08, -1.62]
        ]]
      }
    }
  ]
};

const rainfallTrend = [
  { label: "Dec", value: 49 },
  { label: "Jan", value: 82 },
  { label: "Feb", value: 96 },
  { label: "Mar", value: 57 },
  { label: "Apr", value: 39 },
  { label: "May", value: 6 }
];

const ndviTrend = [
  { label: "Dec", value: 0.35 },
  { label: "Jan", value: 0.58 },
  { label: "Feb", value: 0.68 },
  { label: "Mar", value: 0.59 },
  { label: "Apr", value: 0.42 },
  { label: "May", value: 0.41 }
];

const groundwaterTrend = [
  { label: "Dec", value: 13 },
  { label: "Jan", value: 16 },
  { label: "Feb", value: 14 },
  { label: "Mar", value: 17 },
  { label: "Apr", value: 20 },
  { label: "May", value: 24 }
];

const droughtHotspots = [
  [-2.31, 37.63, 34],
  [-2.58, 38.32, 31],
  [-2.12, 37.45, 23],
  [-1.88, 37.79, 18],
  [-2.41, 38.08, 19],
  [-2.7, 38.0, 24],
  [-2.22, 38.45, 16]
];

const fallbackPoints = [
  { id: "b1", type: "BOREHOLE", label: "Borehole", position: [-2.12, 37.48] },
  { id: "b2", type: "BOREHOLE", label: "Borehole", position: [-2.4, 37.82] },
  { id: "b3", type: "BOREHOLE", label: "Borehole", position: [-2.62, 38.25] },
  { id: "w1", type: "WATER_POINT", label: "Water point", position: [-1.95, 37.68] },
  { id: "w2", type: "WATER_POINT", label: "Water point", position: [-2.32, 38.12] },
  { id: "w3", type: "WATER_POINT", label: "Water point", position: [-2.55, 37.42] },
  { id: "s1", type: "SENSOR", label: "Sensor", position: [-2.2, 37.98] },
  { id: "s2", type: "SENSOR", label: "Sensor", position: [-2.72, 38.05] },
  { id: "s3", type: "SENSOR", label: "Sensor", position: [-1.78, 38.31] },
  { id: "r1", type: "REPORT", label: "Community report", position: [-2.47, 38.52] }
];

const riskColors = {
  NORMAL: "#159957",
  WATCH: "#F59E0B",
  WARNING: "#F97316",
  EMERGENCY: "#DC2626"
};

export function DashboardPage() {
  const [activeBasemap, setActiveBasemap] = useState("OpenStreetMap");
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
        districts: districtRes.status === "fulfilled" ? districtRes.value.data : fallbackDistrict,
        sensors: sensorRes.status === "fulfilled" ? sensorRes.value.data : [],
        alerts: alertRes.status === "fulfilled" ? alertRes.value.data : [],
        reports: reportRes.status === "fulfilled" ? reportRes.value.data : [],
        boreholes: boreholeRes.status === "fulfilled" ? boreholeRes.value.data : []
      };
    }
  });

  const summary = dashboardData.summary || {};
  const districts = dashboardData.districts || fallbackDistrict;
  const sensors = dashboardData.sensors || [];
  const alerts = dashboardData.alerts || [];
  const reports = dashboardData.reports || [];
  const boreholes = dashboardData.boreholes || [];
  const onlineSensors = sensors.filter((sensor) => sensor.status === "ONLINE").length || summary.sensors?.online || summary.sensorsOnline || 22;
  const waterSourceTotal = summary.waterSources?.total || Math.max(124, boreholes.length + reports.length + 98);
  const activeWaterSources = summary.waterSources?.active || Math.max(98, boreholes.filter((item) => item.status === "FUNCTIONAL").length + 96);
  const alertCount = summary.alertsToday || alerts.length || summary.activeAlerts || 18;
  const recentReports = reports.length ? reports : summary.recentCommunityReports || [];
  const riskLevel = summary.droughtRisk?.level || (alertCount > 10 || summary.districtsAtRisk ? "HIGH" : "MODERATE");
  const droughtScore = summary.droughtRisk?.score || (riskLevel === "HIGH" ? 0.78 : 0.54);
  const mapPoints = useMemo(() => buildMapPoints({ sensors, reports, boreholes }), [sensors, reports, boreholes]);

  return (
    <section className="space-y-4 bg-[#F5F6F4] p-4 text-[#17201d] lg:p-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.1fr_.7fr_.75fr]">
        <MetricCard title="Water Sources" value={waterSourceTotal} subtext={`Active: ${activeWaterSources}`} icon={Droplet} iconClass="bg-blue-500 text-white" />
        <MetricCard title="Active Sensors" value={summary.sensors?.total || summary.sensorsOnline || onlineSensors} subtext={`Online: ${onlineSensors}`} icon={Wifi} iconClass="bg-emerald-100 text-emerald-700" />
        <MetricCard title="Drought Risk Level" value={riskLevel} subtext={`Score: ${droughtScore.toFixed(2)}`} icon={TrendingUp} danger />
        <MetricCard title="Alerts (Today)" value={alertCount} subtext="View all alerts" compact />
        <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800">
            Export Report <Download size={16} />
          </button>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-h-[430px] overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="relative h-full min-h-[430px]">
            <DashboardMap districts={districts} points={mapPoints} layers={layers} />
            <div className="absolute left-4 top-4 z-[500] rounded-lg bg-white/95 px-4 py-3 shadow-sm">
              <h1 className="text-lg font-bold">Makueni County</h1>
              <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Study Area</span>
            </div>
            <div className="absolute right-4 top-4 z-[500] w-44 rounded-lg border border-black/10 bg-white/95 p-3 shadow-sm">
              <PanelTitle title="Basemap" />
              {["OpenStreetMap", "Satellite", "Terrain", "Dark Map"].map((item) => (
                <button key={item} onClick={() => setActiveBasemap(item)} className="mt-2 flex w-full items-center gap-2 text-left text-xs">
                  <span className={`h-7 w-7 rounded bg-cover ${basemapSwatch(item)}`} />
                  <span className="flex-1">{item}</span>
                  <span className={`h-3 w-3 rounded-full border ${activeBasemap === item ? "border-emerald-700 bg-emerald-600" : "border-black/25"}`} />
                </button>
              ))}
            </div>
            <div className="absolute bottom-4 right-4 z-[500] w-48 rounded-lg border border-black/10 bg-white/95 p-3 shadow-sm">
              <PanelTitle title="Layers" />
              <LayerToggle label="Boreholes" color="bg-blue-500" checked={layers.boreholes} onChange={() => toggleLayer(setLayers, "boreholes")} />
              <LayerToggle label="Water Points" color="bg-emerald-600" checked={layers.water} onChange={() => toggleLayer(setLayers, "water")} />
              <LayerToggle label="Sensors" color="bg-violet-500" checked={layers.sensors} onChange={() => toggleLayer(setLayers, "sensors")} />
              <LayerToggle label="Drought Hotspots" color="bg-orange-500" checked={layers.hotspots} onChange={() => toggleLayer(setLayers, "hotspots")} />
              <LayerToggle label="Rainfall (CHIRPS)" icon={CloudRain} checked={layers.rainfall} onChange={() => toggleLayer(setLayers, "rainfall")} />
              <LayerToggle label="NDVI (Sentinel-2)" icon={Sprout} checked={layers.ndvi} onChange={() => toggleLayer(setLayers, "ndvi")} />
              <LayerToggle label="Soil Moisture (SMAP)" icon={Waves} checked={layers.soil} onChange={() => toggleLayer(setLayers, "soil")} />
              <LayerToggle label="Community Reports" icon={AlertTriangle} checked={layers.reports} onChange={() => toggleLayer(setLayers, "reports")} />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <FeedPanel
            title="Latest Alerts"
            action="View all"
            headerClass="bg-red-500 text-white"
            items={(alerts.length ? alerts : fallbackAlerts).slice(0, 3).map((alert, index) => ({
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
            items={(recentReports.length ? recentReports : fallbackReports).slice(0, 4).map((report, index) => ({
              id: report.id || index,
              title: report.description || report.title,
              subtitle: report.createdAt ? formatDate(report.createdAt) : report.subtitle,
              meta: "",
              dot: ["bg-amber-400", "bg-red-500", "bg-orange-500", "bg-yellow-400"][index % 4]
            }))}
          />
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <ChartCard title="Rainfall Trend (Last 6 Months)">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={rainfallTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value" name="Rainfall (mm)" radius={[3, 3, 0, 0]}>
                {rainfallTrend.map((entry) => <Cell key={entry.label} fill={entry.label === "May" ? "#DDE5F6" : "#2D8CFF"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Vegetation Health (NDVI)">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={ndviTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" name="NDVI" stroke="#159957" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Groundwater Levels">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={groundwaterTrend}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis reversed tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" name="Water Level (m)" stroke="#2D8CFF" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ForecastCard />
      </div>
    </section>
  );
}

function DashboardMap({ districts, points, layers }) {
  return (
    <MapContainer center={mapCenter} zoom={9} minZoom={7} zoomControl className="z-0">
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url={import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
      />
      {layers.ndvi && (
        <GeoJSON
          data={districts || fallbackDistrict}
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
        {items.map((item) => {
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
        })}
      </div>
    </section>
  );
}

function ForecastCard() {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">AI Drought Forecast <span className="text-xs font-medium">(Next 30 Days)</span></h2>
      <div className="mt-4 grid grid-cols-[8rem_1fr] gap-4">
        <div className="relative h-32">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(#EF4444_0_78%,#E5E7EB_78%_100%)]" />
          <div className="absolute inset-[18px] grid place-items-center rounded-full bg-white text-center">
            <p className="text-3xl font-bold">78%</p>
            <p className="text-xs font-bold text-red-500">High Risk</p>
          </div>
        </div>
        <div className="text-xs">
          <p className="font-bold">Drivers</p>
          <Driver icon={ArrowDown} text="Rainfall Deficit" />
          <Driver icon={ArrowUp} text="Temperature Anomaly" />
          <Driver icon={ArrowDown} text="Vegetation Health" />
          <Driver icon={ArrowDown} text="Soil Moisture" />
          <p className="mt-3 font-bold text-emerald-700">Recommendation</p>
          <p className="mt-1 text-black/65">Increase water harvesting. Monitor boreholes closely.</p>
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
    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5 accent-emerald-700" />
      {color ? <span className={`h-3 w-3 rounded-full ${color}`} /> : <Icon size={13} className="text-emerald-700" />}
      <span>{label}</span>
    </label>
  );
}

function PanelTitle({ title }) {
  return (
    <div className="flex items-center justify-between text-xs font-bold">
      <span>{title}</span>
      <Layers size={14} />
    </div>
  );
}

function Driver({ icon: Icon, text }) {
  return <p className="mt-1 flex items-center gap-1 text-black/65"><Icon size={12} className="text-red-500" /> {text}</p>;
}

function buildMapPoints({ sensors, reports, boreholes }) {
  const apiPoints = [
    ...boreholes.map((item) => ({ id: item.id, type: "BOREHOLE", label: item.name || "Borehole", position: geoJsonPointToLatLng(item.location) })),
    ...sensors.map((item) => ({ id: item.id, type: "SENSOR", label: item.type || "Sensor", position: geoJsonPointToLatLng(item.location) })),
    ...reports.map((item) => ({ id: item.id, type: "REPORT", label: item.description || "Community report", position: geoJsonPointToLatLng(item.location) }))
  ].filter((item) => item.position);

  return apiPoints.length ? apiPoints : fallbackPoints;
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
    OpenStreetMap: "bg-[linear-gradient(135deg,#dfe8d1,#f5efe2)]",
    Satellite: "bg-[linear-gradient(135deg,#324b2f,#b5c49c)]",
    Terrain: "bg-[linear-gradient(135deg,#d7d0ba,#71846b)]",
    "Dark Map": "bg-[linear-gradient(135deg,#111827,#4b5563)]"
  }[item];
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relativeTime(value) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3600000));
  return `${hours}h ago`;
}

const fallbackAlerts = [
  { id: "a1", title: "High Drought Risk", subtitle: "Kibwezi East Sub-county", meta: "2 hours ago" },
  { id: "a2", title: "Low Water Levels", subtitle: "Mbooni Sub-county", meta: "4 hours ago" },
  { id: "a3", title: "Rainfall Deficit", subtitle: "Kilome Sub-county", meta: "6 hours ago" }
];

const fallbackReports = [
  { id: "r1", title: "Water shortage in Muthwani area", subtitle: "Today, 08:45 AM" },
  { id: "r2", title: "Dry borehole in Ikanga village", subtitle: "Today, 07:15 AM" },
  { id: "r3", title: "Broken pump at Nziu Mbitini", subtitle: "Yesterday, 04:35 PM" },
  { id: "r4", title: "Livestock water shortage", subtitle: "Yesterday, 01:20 PM" }
];
