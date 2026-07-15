import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, LayersControl, MapContainer, Marker, Popup, TileLayer, Tooltip, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { Activity, Droplets, Layers, RadioTower, ShieldAlert, Waves } from "lucide-react";
import { endpoints } from "../services/api";
import { createSocket } from "../services/socket";
import { districtStyle, droughtColor, geoJsonPointToLatLng, scoreColor } from "../utils/geoHelpers";
import { asArray } from "../utils/apiData";
import { SeverityBadge } from "./SeverityBadge";
import { WaterTableTerrain } from "./WaterTableTerrain";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { basemapAttribution, basemapOptions, basemapSwatch, basemapUrl } from "../utils/basemaps";

const { Overlay } = LayersControl;

const sensorIcon = new L.DivIcon({
  className: "",
  html: '<div class="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#1B4D3E] text-white shadow-md">●</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const reportIcon = new L.DivIcon({
  className: "",
  html: '<div class="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#E07B00] text-white shadow-md">!</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const boreholeIcons = {
  FUNCTIONAL: new L.DivIcon({
    className: "",
    html: '<div class="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#27AE60] text-xs font-bold text-white shadow-md">B</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  }),
  DRY: new L.DivIcon({
    className: "",
    html: '<div class="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#C0392B] text-xs font-bold text-white shadow-md">B</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  }),
  ABANDONED: new L.DivIcon({
    className: "",
    html: '<div class="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#6B7280] text-xs font-bold text-white shadow-md">B</div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
};

export function DroughtMap() {
  const [districts, setDistricts] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [boreholes, setBoreholes] = useState([]);
  const [conflictRisks, setConflictRisks] = useState(null);
  const [hydroEvents, setHydroEvents] = useState(null);
  const [livestockStress, setLivestockStress] = useState({ waterPoints: [], pasture: [] });
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [basemap, setBasemap] = useState("OpenStreetMap");
  const { data: settings } = usePlatformSettings();

  useEffect(() => {
    if (settings?.map?.defaultBasemap) setBasemap(settings.map.defaultBasemap);
  }, [settings?.map?.defaultBasemap]);

  useEffect(() => {
    Promise.all([
      endpoints.districts(),
      endpoints.sensors(),
      endpoints.alerts(),
      endpoints.communityReports(),
      endpoints.droughtTimeline(),
      endpoints.boreholes(),
      endpoints.conflictRisks(),
      endpoints.hydroEvents(),
      endpoints.livestockWaterStress()
    ]).then(([districtRes, sensorRes, alertRes, reportRes, timelineRes, boreholeRes, conflictRes, hydroRes, livestockRes]) => {
      setDistricts(districtRes.data);
      setSensors(asArray(sensorRes.data));
      setAlerts(asArray(alertRes.data));
      setReports(asArray(reportRes.data));
      setTimeline(asArray(timelineRes.data));
      setBoreholes(asArray(boreholeRes.data));
      setConflictRisks(conflictRes.data);
      setHydroEvents(hydroRes.data);
      setLivestockStress(livestockRes.data);
      setWeekIndex(Math.max(0, uniqueWeeks(asArray(timelineRes.data)).length - 1));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socket.on("sensor:update", (reading) => {
      setLiveUpdates((current) => [reading, ...current].slice(0, 8));
    });
    socket.on("alert:new", (alert) => setAlerts((current) => [alert, ...current]));
    socket.on("alert:resolved", (alert) => setAlerts((current) => current.filter((item) => item.id !== alert.id)));
    return () => socket.disconnect();
  }, []);

  const alertsByDistrict = useMemo(() => {
    return alerts.reduce((acc, alert) => {
      acc[alert.districtId] = [...(acc[alert.districtId] || []), alert];
      return acc;
    }, {});
  }, [alerts]);

  const weeks = useMemo(() => uniqueWeeks(timeline), [timeline]);
  const activeWeek = weeks[weekIndex];
  const snapshotsByDistrict = useMemo(() => {
    return timeline
      .filter((snapshot) => snapshot.weekStart === activeWeek)
      .reduce((acc, snapshot) => {
        acc[snapshot.districtId] = snapshot;
        return acc;
      }, {});
  }, [activeWeek, timeline]);
  const terrainSnapshot = useMemo(() => {
    return Object.values(snapshotsByDistrict).sort((a, b) => b.severityScore - a.severityScore)[0];
  }, [snapshotsByDistrict]);

  return (
    <div className="relative h-full">
      <MapContainer
        key={`${settings?.map?.centerLat || 0.52}-${settings?.map?.centerLng || 35.27}-${settings?.map?.defaultZoom || 9}`}
        center={[settings?.map?.centerLat || 0.52, settings?.map?.centerLng || 35.27]}
        zoom={settings?.map?.defaultZoom || 9}
        minZoom={6}
        zoomControl={false}
        className="z-0"
      >
        <ZoomControl position="topleft" />
        <LayersControl position="bottomright">
          <TileLayer
            attribution={basemapAttribution(basemap)}
            url={basemapUrl(basemap)}
          />

          {districts && (
            <GeoJSON
              key={`${activeWeek}-${JSON.stringify(districts.features?.map((f) => f.properties?.droughtRiskLevel))}`}
              data={districts}
              style={(feature) => {
                const snapshot = snapshotsByDistrict[feature.id];
                if (!snapshot) return districtStyle(feature);
                const color = scoreColor(snapshot.severityScore);
                return { color, weight: 2, fillColor: color, fillOpacity: 0.42 };
              }}
              onEachFeature={(feature, layer) => {
                const alertsForDistrict = alertsByDistrict[feature.id] || [];
                const snapshot = snapshotsByDistrict[feature.id];
                layer.bindPopup(`
                  <strong>${feature.properties.name}</strong><br/>
                  Risk: ${snapshot?.riskLevel || feature.properties.droughtRiskLevel}<br/>
                  Score: ${snapshot?.severityScore ?? "n/a"}<br/>
                  Water table: ${snapshot?.groundwaterDepthMeters ?? "n/a"} m<br/>
                  Active alerts: ${alertsForDistrict.length}
                `);
              }}
            />
          )}

          <Overlay checked name="Groundwater sensors">
            <>
              {sensors.filter((s) => s.type === "GROUNDWATER").map((sensor) => <SensorMarker key={sensor.id} sensor={sensor} />)}
            </>
          </Overlay>
          <Overlay checked name="Soil Moisture">
            <>
              {sensors.filter((s) => s.type === "SOIL_MOISTURE").map((sensor) => <SensorMarker key={sensor.id} sensor={sensor} />)}
            </>
          </Overlay>
          <Overlay checked name="Rainfall">
            <>
              {sensors.filter((s) => s.type === "RAINFALL").map((sensor) => <SensorMarker key={sensor.id} sensor={sensor} />)}
            </>
          </Overlay>
          <Overlay name="NDVI">
            <NdviOverlay districts={districts} />
          </Overlay>
          <Overlay checked name="Community reports">
            <>
              {reports.map((report) => {
                const pos = geoJsonPointToLatLng(report.location);
                if (!pos) return null;
                return (
                  <Marker key={report.id} position={pos} icon={reportIcon}>
                    <Popup>
                      <strong>{report.districtName || "Community report"}</strong>
                      <p>{report.description}</p>
                      <p>Water level: {report.waterLevel}</p>
                    </Popup>
                  </Marker>
                );
              })}
            </>
          </Overlay>
          <Overlay checked name="Borehole network">
            <>
              {boreholes.map((borehole) => <BoreholeMarker key={borehole.id} borehole={borehole} />)}
            </>
          </Overlay>
          <Overlay name="Conflict risk">
            {conflictRisks && (
              <GeoJSON
                data={conflictRisks}
                style={(feature) => ({
                  color: "#7F1D1D",
                  weight: 2,
                  fillColor: "#C0392B",
                  fillOpacity: Math.min(0.5, feature.properties.riskScore / 180)
                })}
                onEachFeature={(feature, layer) => {
                  layer.bindPopup(`
                    <strong>${feature.properties.name}</strong><br/>
                    Risk score: ${feature.properties.riskScore}<br/>
                    Incidents last year: ${feature.properties.incidentsLastYear}<br/>
                    ${feature.properties.notes}
                  `);
                }}
              />
            )}
          </Overlay>
          <Overlay name="Flood-drought duality">
            {hydroEvents && (
              <GeoJSON
                data={hydroEvents}
                style={(feature) => ({
                  color: feature.properties.eventType === "FLASH_FLOOD" ? "#2563EB" : "#C0392B",
                  dashArray: feature.properties.eventType === "FLASH_FLOOD" ? "4 6" : "0",
                  weight: 2,
                  fillColor: feature.properties.eventType === "FLASH_FLOOD" ? "#60A5FA" : "#E07B00",
                  fillOpacity: 0.28
                })}
                onEachFeature={(feature, layer) => {
                  layer.bindPopup(`
                    <strong>${feature.properties.eventType.replace("_", " ")}</strong><br/>
                    District: ${feature.properties.districtName}<br/>
                    Severity: ${feature.properties.severity}<br/>
                    ${feature.properties.notes}
                  `);
                }}
              />
            )}
          </Overlay>
          <Overlay name="Livestock water stress">
            <>
              {livestockStress.waterPoints.map((point) => {
                const pos = geoJsonPointToLatLng(point.location);
                if (!pos) return null;
                return (
                  <CircleMarker key={point.id} center={pos} radius={point.status === "DRY" ? 11 : 8} pathOptions={{ color: livestockColor(point.status), fillColor: livestockColor(point.status), fillOpacity: 0.78 }}>
                    <Popup>
                      <strong>{point.name}</strong>
                      <p>Status: {point.status}</p>
                      <p>{Number(point.daysRemaining).toFixed(1)} days remaining</p>
                      <p>{point.supportedLivestock} livestock supported</p>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </>
          </Overlay>

          {districts?.features?.map((feature) => {
            const alertsForDistrict = alertsByDistrict[feature.id] || [];
            if (!alertsForDistrict.length) return null;
            const center = approximatePolygonCenter(feature.geometry);
            return center ? (
              <CircleMarker key={`alert-${feature.id}`} center={center} radius={14} pathOptions={{ color: "#C0392B", fillColor: "#C0392B", fillOpacity: 0.85 }}>
                <Tooltip permanent direction="center" className="!border-0 !bg-transparent !shadow-none !text-white">
                  {alertsForDistrict.length}
                </Tooltip>
              </CircleMarker>
            ) : null;
          })}
        </LayersControl>
      </MapContainer>

      <div className="absolute right-4 top-4 z-[500] w-52 max-w-[calc(100%-2rem)] rounded-lg border border-black/10 bg-white/95 p-3 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between text-xs font-bold"><span>Basemap</span><Layers size={14} /></div>
        {basemapOptions.map((item) => (
          <button key={item.name} onClick={() => setBasemap(item.name)} className="mt-2 flex w-full items-center gap-2 rounded-md border border-black/10 p-2 text-left text-xs hover:bg-black/[0.03]">
            <span className={`h-8 w-10 shrink-0 rounded bg-cover ${basemapSwatch(item.name)}`} />
            <span className="flex-1 font-medium">{item.name}</span>
            <span className={`h-3 w-3 rounded-full border ${basemap === item.name ? "border-emerald-700 bg-emerald-600" : "border-black/25"}`} />
          </button>
        ))}
      </div>

      <div className="absolute left-4 top-20 z-[500] max-w-sm rounded-lg border border-black/10 bg-white/95 p-4 shadow-panel backdrop-blur">
        <div className="mb-1 flex items-center gap-2 text-primary"><Layers size={18} /><h1 className="font-semibold">{settings?.general?.defaultDistrict || "Drought GIS"}</h1></div>
        <p className="mb-3 text-xs font-medium text-black/60">{settings?.organizationName || "Smart Water"} · Zoom {settings?.map?.defaultZoom || 9}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Legend label="Normal" color="#27AE60" />
          <Legend label="Watch" color="#E07B00" />
          <Legend label="Warning" color="#F97316" />
          <Legend label="Emergency" color="#C0392B" />
        </div>
      </div>

      <div className="absolute left-4 bottom-4 z-[500] w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg border border-black/10 bg-white/95 p-4 shadow-panel backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary"><Activity size={18} /><p className="font-semibold">Drought progression</p></div>
          <p className="text-xs text-black/60">{activeWeek ? new Date(activeWeek).toLocaleDateString() : "Loading"}</p>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, weeks.length - 1)}
          value={weekIndex}
          onChange={(event) => setWeekIndex(Number(event.target.value))}
          className="w-full accent-primary"
        />
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <OverlayMetric icon={Droplets} label="Boreholes" value={boreholes.length} />
          <OverlayMetric icon={ShieldAlert} label="Conflict zones" value={conflictRisks?.features?.length || 0} />
          <OverlayMetric icon={Waves} label="Flood/drought" value={hydroEvents?.features?.length || 0} />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[500] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-black/10 bg-white/95 p-4 shadow-panel backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary"><RadioTower size={18} /><p className="font-semibold">Live sensor stream</p></div>
          <SeverityBadge level={alerts[0]?.severity || "NORMAL"} />
        </div>
        <div className="space-y-2">
          {liveUpdates.length ? liveUpdates.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span>{item.sensorType}</span>
              <strong>{item.value}{item.unit}</strong>
            </div>
          )) : <p className="text-sm text-black/60">Waiting for sensor:update events</p>}
        </div>
      </div>

      <div className="absolute right-4 top-[17rem] z-[500] w-80 max-w-[calc(100vw-2rem)]">
        <WaterTableTerrain snapshot={terrainSnapshot} />
      </div>
    </div>
  );
}

function SensorMarker({ sensor }) {
  const pos = geoJsonPointToLatLng(sensor.location);
  if (!pos) return null;
  return (
    <Marker position={pos} icon={sensorIcon}>
      <Popup>
        <strong>{sensor.type}</strong>
        <p>Status: {sensor.status}</p>
        <p>District: {sensor.districtName}</p>
        <p>Last ping: {sensor.lastPing ? new Date(sensor.lastPing).toLocaleString() : "No ping yet"}</p>
      </Popup>
    </Marker>
  );
}

function BoreholeMarker({ borehole }) {
  const pos = geoJsonPointToLatLng(borehole.location);
  if (!pos) return null;
  return (
    <Marker position={pos} icon={boreholeIcons[borehole.status] || boreholeIcons.ABANDONED}>
      <Popup>
        <strong>{borehole.name}</strong>
        <p>Status: {borehole.status}</p>
        <p>District: {borehole.districtName}</p>
        <p>Depth: {borehole.depthMeters} m</p>
        <p>Yield: {borehole.yieldLitersPerHour} L/hr</p>
      </Popup>
    </Marker>
  );
}

function NdviOverlay({ districts }) {
  if (!districts) return null;
  return (
    <GeoJSON
      data={districts}
      style={(feature) => ({
        color: "#1B4D3E",
        weight: 1,
        fillColor: droughtColor(feature.properties?.droughtRiskLevel),
        fillOpacity: 0.18
      })}
    />
  );
}

function Legend({ label, color }) {
  return <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: color }} /> {label}</div>;
}

function OverlayMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-black/10 bg-background p-2">
      <Icon size={15} className="mb-1 text-primary" />
      <p className="font-semibold">{value}</p>
      <p className="text-black/55">{label}</p>
    </div>
  );
}

function uniqueWeeks(timeline) {
  return [...new Set(timeline.map((snapshot) => snapshot.weekStart))].sort();
}

function approximatePolygonCenter(geometry) {
  const ring = geometry?.coordinates?.[0];
  if (!ring?.length) return null;
  const sums = ring.reduce((acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }), { lat: 0, lng: 0 });
  return [sums.lat / ring.length, sums.lng / ring.length];
}

function livestockColor(status) {
  return { RELIABLE: "#27AE60", STRESSED: "#E07B00", DRY: "#C0392B", CONTAMINATED: "#7C3AED" }[status] || "#E07B00";
}
