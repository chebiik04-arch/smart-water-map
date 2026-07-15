export function geometryToFeatureCollection(geometry, name = "Selected AOI") {
  if (!geometry) return { type: "FeatureCollection", features: [] };
  if (geometry.type === "FeatureCollection") return geometry;
  if (geometry.type === "Feature") return { type: "FeatureCollection", features: [geometry] };
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { name }, geometry }]
  };
}

export function geometryCenter(geometry) {
  const bounds = geometryBounds(geometry);
  if (!bounds) return null;
  return [(bounds.minLat + bounds.maxLat) / 2, (bounds.minLng + bounds.maxLng) / 2];
}

export function geometryBounds(geometry) {
  const coordinates = [];
  collectCoordinates(geometry, coordinates);
  if (!coordinates.length) return null;

  return coordinates.reduce((bounds, [lng, lat]) => ({
    minLat: Math.min(bounds.minLat, lat),
    maxLat: Math.max(bounds.maxLat, lat),
    minLng: Math.min(bounds.minLng, lng),
    maxLng: Math.max(bounds.maxLng, lng)
  }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
}

function collectCoordinates(geometry, output) {
  if (!geometry) return;
  if (geometry.type === "FeatureCollection") {
    geometry.features?.forEach((feature) => collectCoordinates(feature, output));
    return;
  }
  if (geometry.type === "Feature") {
    collectCoordinates(geometry.geometry, output);
    return;
  }
  if (geometry.type === "GeometryCollection") {
    geometry.geometries?.forEach((item) => collectCoordinates(item, output));
    return;
  }
  collectNestedCoordinates(geometry.coordinates, output);
}

function collectNestedCoordinates(value, output) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    output.push(value);
    return;
  }
  value.forEach((item) => collectNestedCoordinates(item, output));
}
