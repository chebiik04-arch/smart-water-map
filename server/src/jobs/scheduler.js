import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { calculateDroughtScore } from "../utils/droughtScore.js";
import { dispatchAlert } from "../utils/alertDispatcher.js";
import { createSensorReading } from "../services/readingService.js";
import { emitAlertNew } from "../services/socket.js";

export function registerJobs() {
  cron.schedule("*/15 * * * *", pollSensorsAndCheckThresholds);
  cron.schedule("0 * * * *", recalculateDistrictRisk);
  cron.schedule("0 6 * * *", dispatchDailyAlerts);
}

export async function pollSensorsAndCheckThresholds() {
  const sensors = await prisma.sensor.findMany({ where: { status: "ONLINE" } });
  for (const sensor of sensors) {
    const simulated = simulateSensor(sensor.type);
    const reading = await createSensorReading(sensor.id, simulated);
    if (isThresholdBreach(sensor.type, simulated.value)) {
      const alert = await prisma.droughtAlert.create({
        data: {
          districtId: sensor.districtId,
          severity: simulated.value < 20 ? "EMERGENCY" : "WARNING",
          message: `${sensor.type} threshold breach: ${simulated.value}${simulated.unit}`
        }
      });
      emitAlertNew(alert);
    }
    console.info("Polled sensor", reading.id);
  }
}

export async function recalculateDistrictRisk() {
  const districts = await prisma.district.findMany({ include: { sensors: true } });
  for (const district of districts) {
    const metrics = await latestDistrictMetrics(district.id);
    const { score, level } = calculateDroughtScore(metrics);
    await prisma.district.update({ where: { id: district.id }, data: { droughtRiskLevel: level } });
    if (level === "WARNING" || level === "EMERGENCY") {
      const existing = await prisma.droughtAlert.findFirst({
        where: { districtId: district.id, severity: level, resolvedAt: null }
      });
      if (!existing) {
        const alert = await prisma.droughtAlert.create({
          data: { districtId: district.id, severity: level, message: `${district.name} drought score is ${score}` }
        });
        emitAlertNew(alert);
      }
    }
  }
}

export async function dispatchDailyAlerts() {
  const alerts = await prisma.droughtAlert.findMany({
    where: { resolvedAt: null, severity: { in: ["WARNING", "EMERGENCY"] } },
    include: { district: true }
  });
  for (const alert of alerts) {
    await dispatchAlert(alert, []);
  }
}

async function latestDistrictMetrics(districtId) {
  const latest = await prisma.$queryRaw`
    SELECT s.type, AVG(r.value)::float AS value
    FROM "Sensor" s
    JOIN "SensorReading" r ON r."sensorId" = s.id
    WHERE s."districtId" = ${districtId}::uuid
      AND r.timestamp >= NOW() - interval '7 days'
    GROUP BY s.type
  `;
  const byType = Object.fromEntries(latest.map((row) => [row.type, row.value]));
  const ndvi = await prisma.satelliteIndex.findFirst({
    where: { districtId, indexType: "NDVI" },
    orderBy: { capturedAt: "desc" }
  });

  return {
    groundwaterPercent: byType.GROUNDWATER ?? 65,
    soilMoisturePercent: byType.SOIL_MOISTURE ?? 55,
    ndvi: ndvi?.value ?? 0.45,
    rainfallAnomalyPercent: (byType.RAINFALL ?? 70) - 100
  };
}

function simulateSensor(type) {
  const ranges = {
    GROUNDWATER: [20, 85, "%"],
    SOIL_MOISTURE: [15, 80, "%"],
    RAINFALL: [0, 40, "mm"],
    WEATHER: [18, 38, "C"]
  };
  const [min, max, unit] = ranges[type] || ranges.WEATHER;
  return { value: Number((min + Math.random() * (max - min)).toFixed(2)), unit, metadata: { source: "scheduled_poll" } };
}

function isThresholdBreach(type, value) {
  return (type === "GROUNDWATER" || type === "SOIL_MOISTURE") && value < 25;
}
