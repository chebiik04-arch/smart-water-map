export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.reports)) return value.reports;
  if (Array.isArray(value?.alerts)) return value.alerts;
  if (Array.isArray(value?.sensors)) return value.sensors;
  if (Array.isArray(value?.boreholes)) return value.boreholes;
  if (Array.isArray(value?.features)) return value.features;
  return [];
}

export function featuresToProperties(collection) {
  return asArray(collection?.features || collection).map((feature) => ({
    id: feature.id,
    ...feature.properties,
    geometry: feature.geometry
  }));
}
