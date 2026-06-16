import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/report", authenticate, async (req, res, next) => {
  try {
    const input = z.object({
      districtId: z.string().uuid().optional(),
      latitude: z.number(),
      longitude: z.number(),
      waterLevel: z.number(),
      description: z.string().min(5),
      photoUrl: z.string().url().optional()
    }).parse(req.body);

    const [report] = await prisma.$queryRaw`
      INSERT INTO "CommunityReport" (id, "userId", "districtId", location, "waterLevel", description, "photoUrl", status, "createdAt")
      VALUES (gen_random_uuid(), ${req.user.id}::uuid, ${input.districtId || null}::uuid,
        ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326),
        ${input.waterLevel}, ${input.description}, ${input.photoUrl || null}, 'PENDING', NOW())
      RETURNING id, "userId", "districtId", "waterLevel",
        description, "photoUrl", status, "createdAt",
        ST_AsGeoJSON(location)::json AS location
    `;
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
