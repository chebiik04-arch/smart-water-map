import { env } from "../config/env.js";

export async function pollSensorReading(sensor) {
  if (!env.sensorProviderUrl) return simulateSensorReading(sensor.type);

  const url = new URL(`/sensors/${sensor.id}/reading`, env.sensorProviderUrl);
  const response = await fetch(url, {
    headers: env.sensorProviderApiKey ? { Authorization: `Bearer ${env.sensorProviderApiKey}` } : {}
  });
  if (!response.ok) {
    throw new Error(`Sensor provider failed for ${sensor.id} with ${response.status}`);
  }
  const payload = await response.json();
  return normalizeReading(sensor.type, payload);
}

function normalizeReading(type, payload) {
  const fallback = simulateSensorReading(type);
  return {
    value: Number(payload.value ?? fallback.value),
    unit: String(payload.unit ?? fallback.unit),
    metadata: {
      source: "sensor_provider",
      providerTimestamp: payload.timestamp || null,
      ...(payload.metadata || {})
    }
  };
}

function simulateSensorReading(type) {
  const ranges = {
    GROUNDWATER: [20, 85, "%"],
    SOIL_MOISTURE: [15, 80, "%"],
    RAINFALL: [0, 40, "mm"],
    WEATHER: [18, 38, "C"]
  };
  const [min, max, unit] = ranges[type] || ranges.WEATHER;
  return { value: Number((min + Math.random() * (max - min)).toFixed(2)), unit, metadata: { source: "local_simulator" } };
}
