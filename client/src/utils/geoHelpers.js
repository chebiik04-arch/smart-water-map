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

export function scoreColor(score) {
  if (score <= 30) return "#27AE60";
  if (score <= 50) return "#E07B00";
  if (score <= 75) return "#F97316";
  return "#C0392B";
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
