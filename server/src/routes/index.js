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
import developerRoutes from "./developer.js";
import publicApiRoutes from "./publicApi.js";
import simulationRoutes from "./simulations.js";

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
router.use("/developer", developerRoutes);
router.use("/public", publicApiRoutes);
router.use("/simulations", simulationRoutes);

export default router;
