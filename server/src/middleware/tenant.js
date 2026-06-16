import { prisma } from "../config/prisma.js";

export async function attachTenant(req, res, next) {
  try {
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      return next();
    }

    const slug = req.headers["x-tenant-slug"];
    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: String(slug) } });
      if (tenant) req.tenantId = tenant.id;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

export function tenantWhere(req) {
  return req.tenantId ? { tenantId: req.tenantId } : {};
}

