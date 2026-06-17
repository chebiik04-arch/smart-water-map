import { env } from "../config/env.js";
import { withRetry } from "../utils/retry.js";

export async function pollSensorReading(sensor) {
  if (!env.sensorProviderUrl && !sensor.device?.pollUrl) return simulateSensorReading(sensor.type);

  const url = sensor.device?.pollUrl || new URL(`/sensors/${sensor.device?.externalId || sensor.id}/reading`, env.sensorProviderUrl);
  const payload = await withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        ...(env.sensorProviderApiKey ? { Authorization: `Bearer ${env.sensorProviderApiKey}` } : {}),
        ...(sensor.device?.externalId ? { "x-sensor-id": sensor.device.externalId } : {})
      }
    });
    if (!response.ok) throw new Error(`Sensor provider failed for ${sensor.id} with ${response.status}`);
    return response.json();
  }, { attempts: 3, delayMs: 500 });
  return normalizeReading(sensor.type, payload);
}

export async function pollSensorBatch(sensors) {
  if (!env.sensorProviderUrl || env.sensorProviderMode !== "batch") {
    const readings = [];
    for (const sensor of sensors) readings.push({ sensorId: sensor.id, reading: await pollSensorReading(sensor) });
    return readings;
  }

  const response = await withRetry(async () => {
    const request = await fetch(new URL("/readings/batch", env.sensorProviderUrl), {
      method: "POST",
      headers: {
        ...(env.sensorProviderApiKey ? { Authorization: `Bearer ${env.sensorProviderApiKey}` } : {}),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sensors: sensors.map((sensor) => ({ id: sensor.id, externalId: sensor.device?.externalId, type: sensor.type })) })
    });
    if (!request.ok) throw new Error(`Sensor batch provider failed with ${request.status}`);
    return request.json();
  }, { attempts: 3, delayMs: 500 });

  const rows = Array.isArray(response) ? response : response.readings || [];
  return rows.map((row) => {
    const sensor = sensors.find((item) => item.id === row.sensorId || item.device?.externalId === row.externalId);
    if (!sensor) return null;
    return { sensorId: sensor.id, reading: normalizeReading(sensor.type, row) };
  }).filter(Boolean);
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
