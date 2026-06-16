import { Router } from "express";
import authRoutes from "./auth.js";
import districtRoutes from "./districts.js";
import sensorRoutes from "./sensors.js";
import satelliteRoutes from "./satellite.js";
import alertRoutes from "./alerts.js";
import communityRoutes from "./community.js";
import forecastRoutes from "./forecasts.js";
import dashboardRoutes from "./dashboard.js";
import mapLayerRoutes from "./mapLayers.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/districts", districtRoutes);
router.use("/sensors", sensorRoutes);
router.use("/satellite", satelliteRoutes);
router.use("/alerts", alertRoutes);
router.use("/community", communityRoutes);
router.use("/forecasts", forecastRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/map-layers", mapLayerRoutes);

export default router;
