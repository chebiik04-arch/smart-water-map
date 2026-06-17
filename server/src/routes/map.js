import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { clamp } from "../utils/time.js";

const router = Router();

router.get("/drought-heatmap", async (req, res, next) => {
  try {
    const districtId = req.query.districtId || null;
    const rows = await prisma.$queryRaw`
      SELECT ST_Y(s.location::geometry)::float AS lat,
        ST_X(s.location::geometry)::float AS lng,
        s.type,
        COALESCE(latest.value, 50)::float AS value,
        COALESCE(ndvi.value, 0.45)::float AS ndvi,
        COALESCE(rain."mmTotal", 35)::float AS rainfall,
        COALESCE(smap.value, 0.42)::float AS smap
      FROM "Sensor" s
      LEFT JOIN LATERAL (
        SELECT r.value
        FROM "SensorReading" r
        WHERE r."sensorId" = s.id
        ORDER BY r.timestamp DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT n.value
        FROM "NDVIReading" n
        WHERE n."districtId" = s."districtId"
        ORDER BY n."capturedAt" DESC
        LIMIT 1
      ) ndvi ON true
      LEFT JOIN LATERAL (
        SELECT rr."mmTotal"
        FROM "RainfallRecord" rr
        WHERE rr."districtId" = s."districtId"
        ORDER BY rr.month DESC
        LIMIT 1
      ) rain ON true
      LEFT JOIN LATERAL (
        SELECT si.value
        FROM "SatelliteIndex" si
        WHERE si."districtId" = s."districtId" AND si."indexType" = 'SMAP'::"SatelliteIndexType"
        ORDER BY si."capturedAt" DESC
        LIMIT 1
      ) smap ON true
      WHERE (${districtId}::uuid IS NULL OR s."districtId" = ${districtId}::uuid)
      LIMIT 300
    `;

    const points = rows.map((row) => {
      const groundwaterDeficit = row.type === "GROUNDWATER" ? 1 - row.value / 100 : 0.45;
      const ndviDeficit = 1 - row.ndvi;
      const rainfallAnomaly = clamp((55 - row.rainfall) / 55);
      const soilMoistureDeficit = row.type === "SOIL_MOISTURE" ? 1 - row.value / 100 : 1 - row.smap;
      const intensity = clamp(
        groundwaterDeficit * 0.35 +
          ndviDeficit * 0.25 +
          rainfallAnomaly * 0.25 +
          soilMoistureDeficit * 0.15
      );
      return { lat: row.lat, lng: row.lng, intensity: Number(intensity.toFixed(3)) };
    });

    res.json(points);
  } catch (err) {
    next(err);
  }
});

export default router;
