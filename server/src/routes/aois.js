import { Router } from "express";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { parseAoiGeometryFromShp } from "../services/shapefileParser.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get("/", async (_req, res, next) => {
  try {
    const aois = await prisma.aoi.findMany({
      select: { id: true, name: true, type: true, createdAt: true },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    });
    res.json(aois);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid AOI id" });
    }

    const aoi = await prisma.aoi.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, geometry: true, createdAt: true }
    });
    if (!aoi) {
      return res.status(404).json({ error: "AOI not found" });
    }

    return res.json(aoi);
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/",
  upload.fields([
    { name: "shp", maxCount: 1 },
    { name: "dbf", maxCount: 1 },
    { name: "shx", maxCount: 1 },
    { name: "prj", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ error: "AOI name is required" });
      }

      const [existing] = await prisma.$queryRaw`
        SELECT id FROM "aois" WHERE LOWER("name") = LOWER(${name}) LIMIT 1
      `;
      if (existing) {
        return res.status(409).json({ error: "An AOI with this name already exists" });
      }

      const shpFile = req.files?.shp?.[0];
      if (!shpFile?.buffer) {
        return res.status(400).json({ error: "A valid .shp file is required" });
      }

      let geometry;
      try {
        geometry = parseAoiGeometryFromShp(shpFile.buffer);
      } catch {
        return res.status(400).json({ error: "Uploaded shapefile could not be parsed as a valid polygon AOI" });
      }

      const aoi = await prisma.aoi.create({
        data: {
          name,
          type: "custom",
          geometry,
          createdBy: req.user.id
        },
        select: { id: true, name: true, type: true, geometry: true, createdAt: true }
      });

      return res.status(201).json(aoi);
    } catch (error) {
      if (error?.code === "P2002") {
        return res.status(409).json({ error: "An AOI with this name already exists" });
      }
      return next(error);
    }
  }
);

export default router;
