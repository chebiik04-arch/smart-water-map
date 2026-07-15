import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CloudRain,
  Droplet,
  FileDown,
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
import { asArray } from "../utils/apiData";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { matchDistrictForAoi, useAoiSelection } from "../hooks/useAoiSelection";
import { geometryCenter, geometryToFeatureCollection } from "../utils/aoiGeometry";
import { basemapAttribution, basemapOptions, basemapSwatch, basemapUrl } from "../utils/basemaps";

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";

const emptyFeatureCollection = { type: "FeatureCollection", features: [] };

const riskColors = {
  NORMAL: "#159957",
  WATCH: "#F59E0B",
  WARNING: "#F97316",
  EMERGENCY: "#DC2626"
};

export function DashboardPage() {
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
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
  const { aois, selectedAoiId, selectedAoi, selectedAoiName, selectedAoiGeometry, updateSelectedAoi } = useAoiSelection();

  useEffect(() => {
    if (settings?.map?.defaultBasemap) setActiveBasemap(settings.map.defaultBasemap);
  }, [settings?.map?.defaultBasemap]);

  const { data: districts = emptyFeatureCollection } = useQuery({
    queryKey: ["dashboard-districts"],
    queryFn: () => endpoints.districts().then((res) => res.data)
  });

  const districtFeatures = asArray(districts.features);
  const districtId = matchDistrictForAoi(districtFeatures, selectedAoi, selectedDistrictId);

  useEffect(() => {
    if (selectedDistrictId || !districtFeatures.length) return;
    const defaultDistrict = districtFeatures.find((feature) => feature.properties?.name === settings?.general?.defaultDistrict) || districtFeatures[0];
    if (defaultDistrict?.id) updateSelectedDistrict(defaultDistrict.id);
  }, [districtFeatures, selectedDistrictId, settings?.general?.defaultDistrict]);

  function updateSelectedDistrict(districtId) {
    setSelectedDistrictId(districtId);
    localStorage.setItem(selectedDistrictStorageKey, districtId);
    window.dispatchEvent(new CustomEvent(selectedDistrictEventName, { detail: { districtId } }));
  }

  const { data: dashboardData = {} } = useQuery({
    queryKey: ["dashboard-page-data", districtId],
    queryFn: async () => {
      const [summaryRes, sensorRes, alertRes, reportRes, waterSourceRes] = await Promise.allSettled([
        endpoints.dashboardSummary({ districtId }),
        endpoints.sensors({ district: districtId }),
        endpoints.alerts({ limit: 5, status: "ACTIVE", districtId }),
        endpoints.communityReports({ limit: 5, districtId }),
        endpoints.waterSources({ districtId })
      ]);
      return {
        summary: summaryRes.status === "fulfilled" ? summaryRes.value.data : {},
        sensors: asArray(sensorRes.status === "fulfilled" ? sensorRes.value.data : []),
        alerts: asArray(alertRes.status === "fulfilled" ? alertRes.value.data : []),
        reports: asArray(reportRes.status === "fulfilled" ? reportRes.value.data : []),
        waterSources: asArray(waterSourceRes.status === "fulfilled" ? waterSourceRes.value.data?.features : [])
      };
    },
    enabled: Boolean(districtId)
  });

  const summary = dashboardData.summary || {};
  const selectedDistrict = districtFeatures.find((feature) => feature.id === districtId) || districtFeatures[0];
  const selectedDistrictName = selectedAoiName || selectedDistrict?.properties?.name || "Selected area";
  const selectedDistrictBoundary = selectedAoiGeometry ? geometryToFeatureCollection(selectedAoiGeometry, selectedAoiName) : selectedDistrict ? { type: "FeatureCollection", features: [selectedDistrict] } : emptyFeatureCollection;
  const mapZoom = settings?.map?.defaultZoom || 9;
  const mapCenter = geometryCenter(selectedAoiGeometry) || featureCenter(selectedDistrict) || [settings?.map?.centerLat || -2.25, settings?.map?.centerLng || 37.85];
  const sensors = asArray(dashboardData.sensors);
  const alerts = asArray(dashboardData.alerts);
  const reports = asArray(dashboardData.reports);
  const waterSources = asArray(dashboardData.waterSources);
  const selectedOnlineSensors = sensors.filter((sensor) => (sensor.statusCode || sensor.status) === "ONLINE" || sensor.status === "Online").length;
  const selectedActiveWaterSources = waterSources.filter((item) => item.properties?.status === "ACTIVE").length;
  const onlineSensors = districtId ? selectedOnlineSensors : summary.sensors?.online ?? summary.sensorsOnline ?? selectedOnlineSensors;
  const totalSensors = districtId ? sensors.length : summary.sensors?.total ?? sensors.length;
  const waterSourceTotal = districtId ? waterSources.length : summary.waterSources?.total ?? waterSources.length;
  const activeWaterSources = districtId ? selectedActiveWaterSources : summary.waterSources?.active ?? selectedActiveWaterSources;
  const alertCount = summary.alertsToday ?? summary.activeAlerts ?? alerts.length;
  const recentReports = reports.length ? reports : asArray(summary.recentCommunityReports);
  const riskLevel = summary.droughtRisk?.level || selectedDistrict?.properties?.droughtRiskLevel || "UNKNOWN";
  const droughtScore = summary.droughtRisk?.score ?? 0;
  const mapPoints = useMemo(() => buildMapPoints({ sensors, reports, waterSources }), [sensors, reports, waterSources]);

  const { data: rainfallData } = useQuery({
    queryKey: ["dashboard-rainfall", districtId],
    queryFn: () => endpoints.rainfallSeries(districtId, { calendarYear: true }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: ndviData } = useQuery({
    queryKey: ["dashboard-ndvi", districtId],
    queryFn: () => endpoints.ndviSeries(districtId, { calendarYear: true }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: groundwaterData } = useQuery({
    queryKey: ["dashboard-groundwater", districtId],
    queryFn: () => endpoints.groundwaterSeries(districtId, { calendarYear: true }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: forecast } = useQuery({
    queryKey: ["dashboard-forecast", districtId],
    queryFn: () => endpoints.latestForecast(districtId).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const { data: heatmapData } = useQuery({
    queryKey: ["dashboard-heatmap", districtId],
    queryFn: () => endpoints.droughtHeatmap({ districtId }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const rainfallTrend = asArray(rainfallData).map((row) => ({ label: row.month || row.label, value: row.mmTotal ?? row.value ?? 0 }));
  const ndviTrend = asArray(ndviData).map((row) => ({ label: row.month || row.label, value: row.value ?? 0 }));
  const groundwaterTrend = asArray(groundwaterData).map((row) => ({ label: row.month || row.label, value: Math.abs(row.avgDepth ?? row.value ?? 0) }));
  const droughtHotspots = asArray(heatmapData).map((point) => [point.lat ?? point.latitude, point.lng ?? point.longitude, point.radius ?? point.intensity ?? point.value ?? 12]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  return (
    <section className="space-y-4 bg-[#F5F6F4] p-4 text-[#17201d] lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold leading-tight">{selectedDistrictName}</h1>
          <p className="mt-1 text-sm text-black/60">{settings?.organizationName || "Smart Water"} · {settings?.country || "Kenya"}</p>
        </div>
        <label className="block w-full text-sm font-semibold sm:w-80">
          Region or county
          <select
            className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm"
            value={selectedAoiId}
            onChange={(event) => updateSelectedAoi(event.target.value)}
          >
            {aois.map((aoi) => (
              <option key={aoi.id} value={aoi.id}>{aoi.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Water Sources" value={waterSourceTotal} subtext={`Active: ${activeWaterSources}`} icon={Droplet} iconClass="bg-blue-500 text-white" />
        <MetricCard title="Active Sensors" value={totalSensors} subtext={`Online: ${onlineSensors}`} icon={Wifi} iconClass="bg-emerald-100 text-emerald-700" />
        <MetricCard title="Drought Risk Level" value={riskLevel} subtext={`Score: ${droughtScore.toFixed(2)}`} icon={TrendingUp} danger />
        <MetricCard title="Alerts (Today)" value={alertCount} subtext="View all alerts" compact />
        <MetricCard title="Export Report" value="PDF" subtext="County summary" icon={FileDown} iconClass="bg-primary text-white" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="grid min-h-[390px] grid-cols-1 bg-white xl:h-[clamp(430px,58vh,620px)] xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="relative h-[430px] min-h-[390px] xl:h-full">
              <DashboardMap districts={selectedDistrictBoundary} points={mapPoints} layers={layers} activeBasemap={activeBasemap} droughtHotspots={droughtHotspots} center={mapCenter} zoom={mapZoom} />
              <div className="absolute left-4 top-4 z-[500] rounded-md border border-black/10 bg-white/95 px-3 py-2 text-xs font-semibold text-black/70 shadow-sm">
                Settings: {activeBasemap} · Zoom {mapZoom} · {selectedDistrictName}
              </div>
              <div className="absolute bottom-4 left-4 z-[500] rounded-md border border-black/20 bg-white/95 px-3 py-2 shadow-sm">
                <div className="h-1 w-24 border-x-2 border-b-2 border-black" />
                <p className="mt-1 text-xs font-semibold text-black/70">0 5 10 km</p>
              </div>
            </div>

            <aside className="z-[500] space-y-3 border-t border-black/10 bg-white/95 p-4 xl:h-full xl:overflow-y-auto xl:border-l xl:border-t-0">
              <CollapsiblePanel title="Basemaps" collapsed={basemapsCollapsed} onToggle={() => setBasemapsCollapsed((value) => !value)}>
                {basemapOptions.map((item) => (
                  <button key={item.name} onClick={() => setActiveBasemap(item.name)} className="mt-2 flex w-full items-center gap-3 rounded-md border border-black/10 p-2 text-left text-sm hover:bg-black/[0.03]">
                    <span className={`h-9 w-11 shrink-0 rounded bg-cover ${basemapSwatch(item.name)}`} />
                    <span className="flex-1 font-medium">{item.name}</span>
                    <span className={`h-3.5 w-3.5 rounded-full border ${activeBasemap === item.name ? "border-emerald-700 bg-emerald-600" : "border-black/25"}`} />
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
            actionTo="/alerts"
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
            actionTo="/reports"
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
        <ChartCard title="Rainfall Trend (Year to Date)">
          {rainfallTrend.length ? <ResponsiveContainer width="100%" height={150}>
            <BarChart data={rainfallTrend} barCategoryGap="32%" barGap={8}>
              <CartesianGrid stroke="#E7EAE5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Bar dataKey="value" name="Rainfall (mm)" barSize={18} radius={[3, 3, 0, 0]}>
                {rainfallTrend.map((entry) => <Cell key={entry.label} fill={entry.label === "May" ? "#DDE5F6" : "#2D8CFF"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer> : <EmptyChart message="No rainfall series returned by the backend." />}
        </ChartCard>
        <ChartCard title="Vegetation Health (Year to Date)">
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
        <ChartCard title="Groundwater Levels (Year to Date)">
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
    <MapContainer key={`${center[0]}-${center[1]}-${zoom}`} center={center} zoom={zoom} minZoom={7} zoomControl={false} className="z-0 h-full min-h-[390px]">
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution={basemapAttribution(activeBasemap)}
        url={basemapUrl(activeBasemap)}
      />
      {districts && <FitMapToGeoJson data={districts} />}
      {layers.rainfall && (
        <GeoJSON
          key="rainfall-layer"
          data={districts}
          style={() => ({ color: "#2563EB", dashArray: "6 5", fillColor: "#60A5FA", fillOpacity: 0.2, opacity: 0.9, weight: 2 })}
        />
      )}
      {layers.ndvi && (
        <GeoJSON
          key="ndvi-layer"
          data={districts}
          style={() => ({ color: "#159957", fillColor: "#A7F3D0", fillOpacity: 0.24, opacity: 0.9, weight: 2 })}
        />
      )}
      {layers.soil && (
        <GeoJSON
          key="soil-layer"
          data={districts}
          style={() => ({ color: "#A16207", dashArray: "2 6", fillColor: "#D97706", fillOpacity: 0.16, opacity: 0.9, weight: 2 })}
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
        <CircleMarker key={point.id} center={point.position} radius={pointRadius(point.type)} pathOptions={pointStyle(point.type)}>
          <Tooltip>{point.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function FitMapToGeoJson({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data) return;
    const layer = L.geoJSON(data);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 12 });
    }
  }, [data, map]);
  return null;
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

function FeedPanel({ title, action, actionTo, items, headerClass = "", }) {
  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-4 py-3 ${headerClass || ""}`}>
        <div className="flex items-center gap-2">
          {headerClass && <AlertTriangle size={17} />}
          <h2 className="font-bold">{title}</h2>
        </div>
        {actionTo ? (
          <Link to={actionTo} className="text-xs font-medium opacity-80 hover:opacity-100">{action}</Link>
        ) : (
          <button className="text-xs font-medium opacity-80">{action}</button>
        )}
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
  const pct = clampPercent(Math.round((forecast?.riskScore || 0) * 100));
  const riskLabel = forecast?.riskLabel || (pct >= 76 ? "Emergency" : pct >= 51 ? "High Risk" : pct >= 31 ? "Watch" : "Normal");
  const drivers = asArray(forecast?.drivers);
  const recommendations = asArray(forecast?.recommendation);
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">AI Drought Forecast <span className="text-xs font-medium">(Next 30 Days)</span></h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr] xl:grid-cols-1 2xl:grid-cols-[10rem_1fr]">
        <DroughtGauge value={pct} label={riskLabel} />
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

function DroughtGauge({ value, label }) {
  const angle = -90 + (clampPercent(value) / 100) * 180;
  const needleLength = 54;
  const needleX = 80 + needleLength * Math.cos((angle * Math.PI) / 180);
  const needleY = 88 + needleLength * Math.sin((angle * Math.PI) / 180);
  const arc = describeArc(80, 88, 62, -90, angle);

  return (
    <div className="mx-auto w-40 text-center sm:mx-0 xl:mx-auto 2xl:mx-0">
      <svg viewBox="0 0 160 120" className="h-32 w-40" role="img" aria-label={`Drought forecast gauge at ${value}%`}>
        <defs>
          <linearGradient id="dashboard-drought-gauge" x1="18" y1="88" x2="142" y2="88" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="55%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
        <path d={describeArc(80, 88, 62, -90, 90)} fill="none" stroke="#E7EAE5" strokeWidth="14" strokeLinecap="round" />
        <path d={arc} fill="none" stroke="url(#dashboard-drought-gauge)" strokeWidth="14" strokeLinecap="round" />
        {[0, 25, 50, 75, 100].map((tick) => {
          const tickAngle = -90 + (tick / 100) * 180;
          const outer = pointOnArc(80, 88, 70, tickAngle);
          const inner = pointOnArc(80, 88, 61, tickAngle);
          return <line key={tick} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#17201d" strokeOpacity="0.32" strokeWidth="2" />;
        })}
        <line x1="80" y1="88" x2={needleX} y2={needleY} stroke="#17201d" strokeWidth="4" strokeLinecap="round" />
        <circle cx="80" cy="88" r="7" fill="#17201d" />
        <text x="22" y="110" className="fill-black/45 text-[10px] font-bold">0</text>
        <text x="130" y="110" className="fill-black/45 text-[10px] font-bold">100</text>
      </svg>
      <p className="text-3xl font-bold leading-none">{value}%</p>
      <p className="mt-1 text-xs font-bold text-red-500">{label}</p>
    </div>
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

function Driver({ icon: Icon, text }) {
  return <p className="mt-1 flex items-center gap-1 text-black/65"><Icon size={12} className="text-red-500" /> {text}</p>;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = pointOnArc(cx, cy, radius, startAngle);
  const end = pointOnArc(cx, cy, radius, endAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function pointOnArc(cx, cy, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function buildMapPoints({ sensors, reports, waterSources }) {
  return [
    ...waterSources.map((feature) => ({
      id: feature.properties?.id || feature.id,
      type: feature.properties?.type || "WATER_POINT",
      label: feature.properties?.name || feature.properties?.type || "Water source",
      position: geoJsonPointToLatLng(feature.geometry)
    })),
    ...sensors.map((item) => ({ id: item.id, type: "SENSOR", label: item.type || "Sensor", position: geoJsonPointToLatLng(item.locationGeojson || item.location) })),
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

function pointRadius(type) {
  return {
    BOREHOLE: 7,
    WATER_POINT: 6,
    SENSOR: 6,
    REPORT: 8
  }[type] || 6;
}

function toggleLayer(setLayers, key) {
  setLayers((current) => ({ ...current, [key]: !current[key] }));
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
