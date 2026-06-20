import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/current", authenticate, async (req, res, next) => {
  try {
    const settings = await resolveSettings(req.user.tenantId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.patch("/current", authenticate, requireRole("admin"), async (req, res, next) => {
  try {
    const tenant = await resolveTenant(req.user.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const input = settingsUpdateSchema.parse(req.body);
    const currentConfig = tenant.config || {};
    const nextConfig = {
      ...currentConfig,
      general: {
        ...(currentConfig.general || {}),
        ...(input.general || {})
      },
      map: {
        ...(currentConfig.map || {}),
        ...(input.map || {})
      }
    };

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: input.organizationName ?? tenant.name,
        country: input.country ?? tenant.country,
        config: nextConfig
      }
    });

    res.json(await formatSettings(updated));
  } catch (err) {
    next(err);
  }
});

async function resolveSettings(tenantId) {
  const tenant = await resolveTenant(tenantId);
  if (!tenant) return defaultSettings();
  return formatSettings(tenant);
}

async function resolveTenant(tenantId) {
  if (tenantId) return prisma.tenant.findUnique({ where: { id: tenantId } });
  return prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
}

async function formatSettings(tenant) {
  const config = tenant.config || {};
  const fallbackDistrict = await prisma.district.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true }
  });

  return {
    tenantId: tenant.id,
    organizationName: tenant.name,
    country: tenant.country,
    slug: tenant.slug,
    general: {
      defaultDistrict: config.general?.defaultDistrict || fallbackDistrict?.name || "",
      temperatureUnit: config.general?.temperatureUnit || "Celsius"
    },
    map: {
      defaultZoom: Number(config.map?.defaultZoom || 9),
      defaultBasemap: config.map?.defaultBasemap || "OpenStreetMap",
      centerLat: Number(config.map?.centerLat || -2.25),
      centerLng: Number(config.map?.centerLng || 37.85)
    }
  };
}

function defaultSettings() {
  return {
    tenantId: null,
    organizationName: "Smart Water",
    country: "Kenya",
    slug: "",
    general: {
      defaultDistrict: "",
      temperatureUnit: "Celsius"
    },
    map: {
      defaultZoom: 9,
      defaultBasemap: "OpenStreetMap",
      centerLat: -2.25,
      centerLng: 37.85
    }
  };
}

const settingsUpdateSchema = z.object({
  organizationName: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  general: z.object({
    defaultDistrict: z.string().optional(),
    temperatureUnit: z.enum(["Celsius", "Fahrenheit"]).optional()
  }).optional(),
  map: z.object({
    defaultZoom: z.coerce.number().min(6).max(18).optional(),
    defaultBasemap: z.enum(["OpenStreetMap", "Satellite", "Terrain", "Dark Map"]).optional(),
    centerLat: z.coerce.number().min(-90).max(90).optional(),
    centerLng: z.coerce.number().min(-180).max(180).optional()
  }).optional()
});

export default router;
