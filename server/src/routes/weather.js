import { Router } from "express";
import fetch from "node-fetch";
import { prisma } from "../config/prisma.js";

const router = Router();

router.get("/current", async (req, res, next) => {
  try {
    const { lat, lng } = await resolveLocation(req.query.districtId);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("current", "temperature_2m,weathercode,windspeed_10m,relativehumidity_2m");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
    const data = await response.json();
    const current = data.current || {};
    res.json({
      tempC: Math.round(current.temperature_2m ?? 27),
      condition: conditionLabel(current.weathercode),
      humidity: Math.round(current.relativehumidity_2m ?? 54),
      windKmh: Math.round(current.windspeed_10m ?? 18),
      forecastUrl: `https://open-meteo.com/en/docs?latitude=${lat}&longitude=${lng}`
    });
  } catch (err) {
    next(err);
  }
});

async function resolveLocation(districtId) {
  if (!districtId) {
    return {
      lat: Number(process.env.MAKUENI_LAT || -1.8),
      lng: Number(process.env.MAKUENI_LNG || 37.6)
    };
  }
  const [district] = await prisma.$queryRaw`
    SELECT ST_Y(ST_Centroid(geometry)::geometry)::float AS lat,
      ST_X(ST_Centroid(geometry)::geometry)::float AS lng
    FROM "District"
    WHERE id = ${districtId}::uuid
  `;
  return district || { lat: -1.8, lng: 37.6 };
}

function conditionLabel(code) {
  if ([0, 1].includes(code)) return "Clear";
  if ([2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Cloudy";
}

export default router;
