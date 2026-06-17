import cron from "node-cron";
import { prisma } from "../config/prisma.js";
import { calculateDroughtScore } from "../utils/droughtScore.js";
import { dispatchAlert } from "../utils/alertDispatcher.js";
import { createSensorReading } from "../services/readingService.js";
import { emitAlertNew, emitForecastUpdated, emitWaterSourceUpdate } from "../services/socket.js";
import { clamp } from "../utils/time.js";
import { pollSensorReading } from "../providers/sensorProvider.js";

export function registerJobs() {
  cron.schedule("*/15 * * * *", pollSensorsAndCheckThresholds);
  cron.schedule("0 */6 * * *", recalculateDroughtForecasts);
  cron.schedule("*/30 * * * *", checkWaterSourceReadings);
  cron.schedule("0 * * * *", recalculateDistrictRisk);
  cron.schedule("10 * * * *", checkSensorHealth);
  cron.schedule("0 6 * * *", dispatchDailyAlerts);
}

export async function pollSensorsAndCheckThresholds() {
  const sensors = await prisma.sensor.findMany({ where: { status: "ONLINE" } });
  for (const sensor of sensors) {
    const polled = await pollSensorReading(sensor);
    const reading = await createSensorReading(sensor.id, polled);
    if (isThresholdBreach(sensor.type, polled.value)) {
      const alert = await prisma.droughtAlert.create({
        data: {
          districtId: sensor.districtId,
          alertType: "SENSOR_OFFLINE",
          severity: polled.value < 20 ? "EMERGENCY" : "WARNING",
          message: `${sensor.type} threshold breach: ${polled.value}${polled.unit}`
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

export async function checkSensorHealth(staleHours = Number(process.env.SENSOR_STALE_HOURS || 6)) {
  const threshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  const staleSensors = await prisma.sensor.findMany({
    where: { OR: [{ lastPing: null }, { lastPing: { lt: threshold } }] },
    include: { district: true }
  });

  for (const sensor of staleSensors) {
    const existing = await prisma.maintenanceTicket.findFirst({
      where: { sensorId: sensor.id, status: { not: "RESOLVED" } }
    });
    if (existing) continue;

    const hours = sensor.lastPing ? (Date.now() - sensor.lastPing.getTime()) / 3600000 : staleHours + 1;
    await prisma.maintenanceTicket.create({
      data: {
        sensorId: sensor.id,
        districtId: sensor.districtId,
        title: `${sensor.type} sensor has missed ping SLA`,
        description: `Sensor ${sensor.id} has not pinged for ${hours.toFixed(1)} hours.`,
        priority: hours >= 24 ? "CRITICAL" : "HIGH",
        staleHours: Number(hours.toFixed(1))
      }
    });
    const alert = await prisma.droughtAlert.create({
      data: {
        districtId: sensor.districtId,
        alertType: "SENSOR_OFFLINE",
        severity: "WATCH",
        message: `Sensor health alert: ${sensor.type} sensor in ${sensor.district.name} has not pinged for ${hours.toFixed(1)} hours.`
      }
    });
    emitAlertNew(alert);
  }
}

export async function recalculateDroughtForecasts() {
  const districts = await prisma.district.findMany();
  for (const district of districts) {
    const latestNdvi = await prisma.nDVIReading.findFirst({
      where: { districtId: district.id },
      orderBy: { capturedAt: "desc" }
    }).catch(() => null);
    const latestSmap = await prisma.satelliteIndex.findFirst({
      where: { districtId: district.id, indexType: "SMAP" },
      orderBy: { capturedAt: "desc" }
    });
    const rainfall = await prisma.rainfallRecord.findFirst({
      where: { districtId: district.id },
      orderBy: { month: "desc" }
    }).catch(() => null);
    const groundwater = await prisma.$queryRaw`
      SELECT AVG(wsr."waterLevel")::float AS depth
      FROM "WaterSourceReading" wsr
      JOIN "WaterSource" ws ON ws.id = wsr."sourceId"
      WHERE ws."districtId" = ${district.id}::uuid
        AND wsr.timestamp >= NOW() - interval '30 days'
    `.catch(() => [{ depth: -12 }]);

    const historicalAvgMm = 55;
    const baselineDepth = -8;
    const currentDepth = groundwater[0]?.depth ?? -12;
    const rainfallScore = ((rainfall?.mmTotal ?? 32) - historicalAvgMm) / historicalAvgMm;
    const ndviScore = 1 - (latestNdvi?.value ?? 0.42);
    const groundwaterScore = Math.abs((currentDepth - baselineDepth) / baselineDepth);
    const soilScore = 1 - (latestSmap?.value ?? 0.42);
    const riskScore = clamp(Math.abs(rainfallScore) * 0.3 + ndviScore * 0.25 + groundwaterScore * 0.25 + soilScore * 0.2);
    const riskLabel = riskScore < 0.3 ? "Low Risk" : riskScore < 0.5 ? "Moderate" : riskScore <= 0.75 ? "High Risk" : "Critical";
    const predictedSeverity = riskScore > 0.75 ? "EMERGENCY" : riskScore > 0.5 ? "WARNING" : riskScore > 0.3 ? "WATCH" : "NORMAL";

    const forecast = await prisma.droughtForecast.create({
      data: {
        districtId: district.id,
        forecastDate: new Date(),
        predictedSeverity,
        confidenceScore: 0.82,
        riskScore: Number(riskScore.toFixed(2)),
        riskLabel,
        recommendation: ["Increase water harvesting", "Monitor boreholes closely"],
        modelVersion: "composite-v2",
        drivers: {
          create: [
            { factor: "Rainfall Deficit", direction: "DOWN", impact: Math.abs(rainfallScore) > 0.35 ? "HIGH" : "MEDIUM" },
            { factor: "Temperature Anomaly", direction: "UP", impact: "HIGH" },
            { factor: "Vegetation Health", direction: "DOWN", impact: ndviScore > 0.5 ? "HIGH" : "MEDIUM" },
            { factor: "Soil Moisture", direction: "DOWN", impact: soilScore > 0.5 ? "HIGH" : "MEDIUM" }
          ]
        }
      },
      include: { drivers: true }
    });
    emitForecastUpdated(forecast);

    if (riskScore > 0.6) {
      const existing = await prisma.droughtAlert.findFirst({
        where: { districtId: district.id, alertType: "HIGH_DROUGHT_RISK", resolvedAt: null }
      });
      if (!existing) {
        const alert = await prisma.droughtAlert.create({
          data: {
            districtId: district.id,
            alertType: "HIGH_DROUGHT_RISK",
            severity: riskScore > 0.75 ? "EMERGENCY" : "WARNING",
            subDistrict: district.name,
            message: `${district.name} drought forecast risk is ${Math.round(riskScore * 100)}%.`
          }
        });
        emitAlertNew(alert);
      }
    }
  }
}

export async function checkWaterSourceReadings() {
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const staleSources = await prisma.waterSource.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { readings: { none: {} } },
        { readings: { none: { timestamp: { gte: threshold } } } }
      ]
    }
  }).catch(() => []);

  for (const source of staleSources) {
    const updated = await prisma.waterSource.update({
      where: { id: source.id },
      data: { status: "UNDER_REPAIR" }
    });
    emitWaterSourceUpdate({ ...updated, reason: "No reading in 48 hours" });
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

function isThresholdBreach(type, value) {
  return (type === "GROUNDWATER" || type === "SOIL_MOISTURE") && value < 25;
}
