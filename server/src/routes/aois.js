import { Router } from "express";
import multer from "multer";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { parseAoiGeometryFromShp } from "../services/shapefileParser.js";
import { paginationParams } from "../utils/http.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const requiredShapefileExtensions = [".shp", ".dbf", ".shx", ".prj"];

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = paginationParams(req.query);
    const aois = await prisma.aoi.findMany({
      select: { id: true, name: true, type: true, createdAt: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      take: limit,
      skip: offset
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
  upload.any(),
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

      const filesByExtension = shapefilePartsByExtension(req.files);
      const missing = requiredShapefileExtensions.filter((extension) => !filesByExtension[extension]);
      if (missing.length) {
        return res.status(400).json({
          error: `Missing shapefile part${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
          missing
        });
      }

      const shpFile = filesByExtension[".shp"];
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

function shapefilePartsByExtension(files = []) {
  return files.reduce((parts, file) => {
    const extension = file.originalname?.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (requiredShapefileExtensions.includes(extension) && !parts[extension]) {
      parts[extension] = file;
    }
    return parts;
  }, {});
}

export default router;
