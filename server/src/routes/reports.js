import { Router } from "express";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/export", async (req, res, next) => {
  try {
    const districtId = req.query.districtId || null;
    const format = String(req.query.format || "json").toLowerCase();
    const period = String(req.query.period || "");
    const dateRange = resolveDateRange({ period, startDate: req.query.startDate, endDate: req.query.endDate });
    const whereDistrict = {
      ...(districtId ? { districtId } : {}),
      ...(req.tenantId ? { district: { tenantId: req.tenantId } } : {})
    };
    const timeFilter = dateRange ? { gte: dateRange.start, lte: dateRange.end } : undefined;
    let districtName = null;
    if (districtId) {
      const district = await prisma.district.findFirst({
        where: { id: districtId, ...(req.tenantId ? { tenantId: req.tenantId } : {}) },
        select: { id: true, name: true }
      });
      if (!district) return res.status(404).json({ error: "District not found" });
      districtName = district.name;
    }
    const [summary, alerts, waterSources, forecast, rainfall] = await Promise.all([
      buildSummary(districtId, req.tenantId),
      prisma.droughtAlert.findMany({
        where: { ...whereDistrict, resolvedAt: null, ...(timeFilter ? { triggeredAt: timeFilter } : {}) },
        orderBy: { triggeredAt: "desc" },
        take: 10,
        include: { district: { select: { name: true } } }
      }),
      prisma.waterSource.findMany({
        where: whereDistrict,
        orderBy: { lastInspected: "desc" },
        take: 5,
        select: { id: true, name: true, type: true, status: true, depth: true, yield: true, lastInspected: true }
      }).catch(() => []),
      districtId
        ? prisma.droughtForecast.findFirst({ where: whereDistrict, orderBy: { forecastDate: "desc" }, include: { drivers: true } })
        : prisma.droughtForecast.findFirst({ where: req.tenantId ? { district: { tenantId: req.tenantId } } : {}, orderBy: { forecastDate: "desc" }, include: { drivers: true } }),
      districtId
        ? prisma.rainfallRecord.findMany({ where: whereDistrict, orderBy: { month: "desc" }, take: 6 })
        : prisma.rainfallRecord.findMany({ where: req.tenantId ? { district: { tenantId: req.tenantId } } : {}, orderBy: { month: "desc" }, take: 6 })
    ]);

    const payload = {
      county: districtName || "All districts",
      generatedAt: new Date().toISOString(),
      filters: { districtId, period, startDate: dateRange?.start?.toISOString() || null, endDate: dateRange?.end?.toISOString() || null },
      summary,
      activeAlerts: alerts,
      topWaterSources: waterSources,
      latestForecast: forecast,
      rainfall: rainfall.reverse()
    };

    if (format === "csv") {
      res.type("text/csv").attachment("smart-water-report.csv").send(toCsv(payload));
      return;
    }
    if (format === "pdf") {
      res.type("application/pdf").attachment("smart-water-report.pdf").send(Buffer.from(toReportText(payload)));
      return;
    }
    res.type("application/json").json(payload);
  } catch (err) {
    next(err);
  }
});

async function buildSummary(districtId, tenantId) {
  const whereDistrict = {
    ...(districtId ? { districtId } : {}),
    ...(tenantId ? { district: { tenantId } } : {})
  };
  const [waterSourcesTotal, waterSourcesActive, sensorsTotal, sensorsOnline, alertsToday] = await Promise.all([
    prisma.waterSource.count({ where: whereDistrict }).catch(() => 0),
    prisma.waterSource.count({ where: { ...whereDistrict, status: "ACTIVE" } }).catch(() => 0),
    prisma.sensor.count({ where: whereDistrict }),
    prisma.sensor.count({ where: { ...whereDistrict, status: "ONLINE" } }),
    prisma.droughtAlert.count({ where: { ...whereDistrict, resolvedAt: null } })
  ]);
  return {
    waterSources: { total: waterSourcesTotal, active: waterSourcesActive },
    sensors: { total: sensorsTotal, online: sensorsOnline },
    alertsToday
  };
}

function resolveDateRange({ period, startDate, endDate }) {
  if (startDate || endDate) {
    return {
      start: startDate ? new Date(String(startDate)) : new Date(0),
      end: endDate ? new Date(String(endDate)) : new Date()
    };
  }
  const end = new Date();
  const start = new Date(end);
  if (period === "monthly") start.setMonth(start.getMonth() - 1);
  else if (period === "annual") start.setFullYear(start.getFullYear() - 1);
  else return null;
  return { start, end };
}

function toCsv(payload) {
  const rows = [
    ["section", "name", "value", "status"],
    ["summary", "waterSources.total", payload.summary.waterSources.total, ""],
    ["summary", "waterSources.active", payload.summary.waterSources.active, ""],
    ["summary", "sensors.total", payload.summary.sensors.total, ""],
    ["summary", "sensors.online", payload.summary.sensors.online, ""],
    ...payload.activeAlerts.map((alert) => ["alert", alert.message, alert.severity, alert.triggeredAt.toISOString?.() || alert.triggeredAt]),
    ...payload.topWaterSources.map((source) => ["water_source", source.name, source.type, source.status]),
    ...payload.rainfall.map((row) => ["rainfall", row.month, row.mmTotal, row.source])
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}

function toReportText(payload) {
  return [
    "Smart Water Map Report",
    `Area: ${payload.county}`,
    `Generated: ${payload.generatedAt}`,
    `Water sources: ${payload.summary.waterSources.total}`,
    `Active sources: ${payload.summary.waterSources.active}`,
    `Sensors online: ${payload.summary.sensors.online}/${payload.summary.sensors.total}`,
    `Active alerts: ${payload.activeAlerts.length}`,
    "",
    "This lightweight PDF response is generated by the API. Use format=json or format=csv for structured exports."
  ].join("\n");
}

export default router;
