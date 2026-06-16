export function geoJsonPointToLatLng(point) {
  if (!point?.coordinates) return null;
  const [lng, lat] = point.coordinates;
  return [lat, lng];
}

export function droughtColor(level) {
  return {
    NORMAL: "#27AE60",
    WATCH: "#E07B00",
    WARNING: "#F97316",
    EMERGENCY: "#C0392B"
  }[level] || "#27AE60";
}

export function districtStyle(feature) {
  const color = droughtColor(feature?.properties?.droughtRiskLevel);
  return {
    color,
    weight: 2,
    fillColor: color,
    fillOpacity: 0.38
  };
}

