import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, GeoJSON, LayerGroup, MapContainer, Popup, ScaleControl, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";
import { CloudRain, Droplet, Layers, RadioTower, Sprout, Waves } from "lucide-react";
import { endpoints } from "../../services/api";
import { geoJsonPointToLatLng } from "../../utils/geoHelpers";
import { asArray } from "../../utils/apiData";
import { usePlatformSettings } from "../../hooks/usePlatformSettings";

const basemaps = {
  OpenStreetMap: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  Satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  Terrain: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  "Dark Map": "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
};

const defaultCenter = [
  Number(import.meta.env.VITE_MAP_CENTER_LAT || -1.8),
  Number(import.meta.env.VITE_MAP_CENTER_LNG || 37.6)
];

export function DroughtMap({ districtId, allLayers = false, expanded = false, onWaterSourceClick, showLayerPanel = true, showLegend = false }) {
  const [basemap, setBasemap] = useState("OpenStreetMap");
  const [heatOpacity, setHeatOpacity] = useState(0.8);
  const [layers, setLayers] = useState({
    boreholes: true,
    water: allLayers || true,
    sensors: true,
    hotspots: true,
    rainfall: allLayers,
    ndvi: allLayers,
    soil: allLayers,
    reports: true
  });

  const { data: districts } = useQuery({ queryKey: ["districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const { data: sources } = useQuery({ queryKey: ["water-sources", districtId], queryFn: () => endpoints.waterSources({ districtId }).then((res) => res.data) });
  const { data: sensorData } = useQuery({ queryKey: ["sensors", districtId], queryFn: () => endpoints.sensors({ district: districtId }).then((res) => res.data) });
  const { data: reportData } = useQuery({ queryKey: ["map-reports", districtId], queryFn: () => endpoints.communityReports({ districtId, limit: 50 }).then((res) => res.data) });
  const { data: heatmapData } = useQuery({ queryKey: ["heatmap", districtId], queryFn: () => endpoints.droughtHeatmap({ districtId }).then((res) => res.data) });
  const { data: settings } = usePlatformSettings();

  useEffect(() => {
    if (settings?.map?.defaultBasemap) setBasemap(settings.map.defaultBasemap);
  }, [settings?.map?.defaultBasemap]);

  const waterSources = sources?.features || [];
  const sensors = asArray(sensorData);
  const reports = asArray(reportData);
  const heatPoints = asArray(heatmapData);
  const selectedDistrict = asArray(districts?.features).find((feature) => feature.id === districtId);
  const visibleDistricts = selectedDistrict ? { type: "FeatureCollection", features: [selectedDistrict] } : districts;
  const selectedCenter = featureCenter(selectedDistrict) || [settings?.map?.centerLat || defaultCenter[0], settings?.map?.centerLng || defaultCenter[1]];
  const selectedDistrictName = selectedDistrict?.properties?.name || settings?.general?.defaultDistrict || "Selected area";

  return (
    <div className="relative h-full min-h-[430px]">
      <MapContainer
        key={`${selectedCenter[0]}-${selectedCenter[1]}-${settings?.map?.defaultZoom || 9}-${districtId || "all"}`}
        center={selectedCenter}
        zoom={settings?.map?.defaultZoom || Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM || 9)}
        minZoom={7}
        zoomControl={false}
        className="z-0"
      >
        <ZoomControl position="topleft" />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url={basemaps[basemap]} />
        <ScaleControl position="bottomleft" metric imperial={false} />
        {visibleDistricts && <GeoJSON data={visibleDistricts} style={() => ({ color: "#1B4D3E", weight: 2, fillOpacity: 0 })} onEachFeature={(feature, layer) => layer.bindTooltip(feature.properties?.name || "Unnamed district", { permanent: true, direction: "center" })} />}
        {layers.ndvi && visibleDistricts && <GeoJSON data={visibleDistricts} style={() => ({ color: "#22C55E", fillColor: "#BBF7D0", fillOpacity: 0.2, weight: 1 })} />}
        {layers.hotspots && <HeatLayer points={heatPoints} opacity={heatOpacity} />}
        <LayerGroup>
          {waterSources.map((feature) => {
            const position = geoJsonPointToLatLng(feature.geometry);
            if (!position) return null;
            const isBorehole = feature.properties.type === "BOREHOLE";
            const isWaterPoint = feature.properties.type === "WATER_POINT";
            if ((isBorehole && !layers.boreholes) || (isWaterPoint && !layers.water)) return null;
            return (
              <CircleMarker key={feature.properties.id} center={position} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: isBorehole ? "#3B82F6" : "#22C55E", fillOpacity: 0.95 }} eventHandlers={{ click: () => onWaterSourceClick?.(feature.properties) }}>
                <Popup><strong>{feature.properties.name}</strong><p>{feature.properties.type} · {feature.properties.status}</p><p>Depth: {feature.properties.depth ?? "n/a"} m</p><p>Yield: {feature.properties.yield ?? "n/a"} L/hr</p></Popup>
              </CircleMarker>
            );
          })}
        </LayerGroup>
        {layers.sensors && sensors.map((sensor) => {
          const position = geoJsonPointToLatLng(sensor.location);
          if (!position) return null;
          return <CircleMarker key={sensor.id} center={position} radius={5} pathOptions={{ color: "#fff", weight: 2, fillColor: "#0F766E", fillOpacity: 0.95 }}><Tooltip>{sensor.type}</Tooltip><Popup><strong>{sensor.type}</strong><p>{sensor.status}</p><p>{sensor.lastPing ? new Date(sensor.lastPing).toLocaleString() : "No recent reading"}</p></Popup></CircleMarker>;
        })}
        {layers.reports && reports.map((report) => {
          const position = geoJsonPointToLatLng(report.location);
          if (!position) return null;
          return <CircleMarker key={report.id} center={position} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: "#FACC15", fillOpacity: 0.95 }}><Popup><strong>{report.description}</strong><p>{report.timeAgo}</p></Popup></CircleMarker>;
        })}
      </MapContainer>
      <div className="absolute left-4 top-20 z-[500] max-w-[calc(100%-2rem)] rounded-md border border-black/10 bg-white/95 px-3 py-2 text-xs font-semibold text-black/70 shadow-sm">
        {selectedDistrictName} · {basemap} · Zoom {settings?.map?.defaultZoom || 9}
      </div>
      <MapPanels basemap={basemap} setBasemap={setBasemap} layers={layers} setLayers={setLayers} expanded={expanded} heatOpacity={heatOpacity} setHeatOpacity={setHeatOpacity} showLayerPanel={showLayerPanel} />
      {showLegend && <MapLegend />}
    </div>
  );
}

function HeatLayer({ points, opacity }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points?.length) return undefined;
    const layer = L.heatLayer(points.map((point) => [point.lat, point.lng, point.intensity ?? point.value ?? 0]), {
      radius: 35,
      blur: 25,
      maxZoom: 12,
      gradient: { 0.0: "transparent", 0.4: "yellow", 0.7: "orange", 1.0: "red" }
    }).addTo(map);
    if (layer._canvas) layer._canvas.style.opacity = String(opacity);
    return () => layer.remove();
  }, [map, points, opacity]);
  return null;
}

function MapPanels({ basemap, setBasemap, layers, setLayers, expanded, heatOpacity, setHeatOpacity, showLayerPanel }) {
  return (
    <div className="absolute right-4 top-4 z-[500] flex max-h-[calc(100%-2rem)] w-52 max-w-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto pr-1">
      <div className="w-full rounded-lg border border-black/10 bg-white/95 p-3 shadow-sm">
        <PanelTitle title="Basemap" />
        {Object.keys(basemaps).map((item) => <button key={item} onClick={() => setBasemap(item)} className="mt-2 flex w-full items-center gap-2 text-left text-xs"><span className="h-7 w-7 rounded bg-emerald-100" /><span className="flex-1">{item}</span><span className={`h-3 w-3 rounded-full border ${basemap === item ? "border-emerald-700 bg-emerald-600" : "border-black/25"}`} /></button>)}
      </div>
      {showLayerPanel && <div className="w-full rounded-lg border border-black/10 bg-white/95 p-3 shadow-sm">
        <PanelTitle title="Layers" />
        <LayerToggle label="Boreholes" color="bg-blue-500" checked={layers.boreholes} onChange={() => toggle(setLayers, "boreholes")} />
        <LayerToggle label="Water Points" color="bg-emerald-600" checked={layers.water} onChange={() => toggle(setLayers, "water")} />
        <LayerToggle label="Sensors" color="bg-teal-600" checked={layers.sensors} onChange={() => toggle(setLayers, "sensors")} />
        <LayerToggle label="Drought Hotspots" color="bg-orange-500" checked={layers.hotspots} onChange={() => toggle(setLayers, "hotspots")} />
        <LayerToggle label="Rainfall (CHIRPS)" icon={CloudRain} checked={layers.rainfall} onChange={() => toggle(setLayers, "rainfall")} />
        <LayerToggle label="NDVI (Sentinel-2)" icon={Sprout} checked={layers.ndvi} onChange={() => toggle(setLayers, "ndvi")} />
        <LayerToggle label="Soil Moisture (SMAP)" icon={Waves} checked={layers.soil} onChange={() => toggle(setLayers, "soil")} />
        <LayerToggle label="Community Reports" icon={Droplet} checked={layers.reports} onChange={() => toggle(setLayers, "reports")} />
        {expanded && <label className="mt-3 block text-xs">Heat opacity<input className="mt-1 w-full accent-emerald-700" type="range" min="0" max="1" step="0.05" value={heatOpacity} onChange={(event) => setHeatOpacity(Number(event.target.value))} /></label>}
      </div>}
    </div>
  );
}

function MapLegend() {
  const items = [
    ["Boreholes", "bg-blue-500"],
    ["Water Points", "bg-emerald-600"],
    ["Sensors", "bg-teal-600"],
    ["Drought Hotspots", "bg-orange-500"],
    ["Rainfall", "bg-blue-300"],
    ["Community Reports", "bg-yellow-400"]
  ];
  return (
    <div className="absolute bottom-4 left-1/2 z-[500] flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-wrap items-center justify-center gap-4 rounded-md border border-black/10 bg-white/95 px-4 py-2 text-[11px] shadow-sm">
      {items.map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>)}
    </div>
  );
}

function PanelTitle({ title }) {
  return <div className="flex items-center justify-between text-xs font-bold"><span>{title}</span><Layers size={14} /></div>;
}

function LayerToggle({ label, color, icon: Icon = RadioTower, checked, onChange }) {
  return <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={checked} onChange={onChange} className="h-3.5 w-3.5 accent-emerald-700" />{color ? <span className={`h-3 w-3 rounded-full ${color}`} /> : <Icon size={13} className="text-emerald-700" />}<span>{label}</span></label>;
}

function toggle(setLayers, key) {
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
