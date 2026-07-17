import cors from "cors";
import express from "express";
import helmet from "helmet";
import apiV1Routes from "./routes/index.js";
import { errorHandler, notFound, standardizeErrorResponses } from "./middleware/errorHandler.js";
import { requestContext } from "./middleware/requestContext.js";
import { validateUuidPath } from "./middleware/validateUuidPath.js";
import { metrics } from "./services/metrics.js";
import { readinessReport } from "./services/readiness.js";
import { uploadRootPath } from "./services/uploadStorage.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
  app.use(requestContext);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(standardizeErrorResponses);
  app.use("/uploads", express.static(uploadRootPath()));

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "smart-water-map-server" });
  });

  app.get("/ready", async (req, res, next) => {
    try {
      const report = await readinessReport();
      res.status(report.ready ? 200 : 503).json({ status: report.ready ? "ready" : "not_ready", ...report });
    } catch (err) {
      next(err);
    }
  });

  app.get("/metrics", (req, res) => {
    res.type("text/plain; version=0.0.4").send(metrics.text());
  });

  app.use(validateUuidPath);
  app.use("/api/v1", apiV1Routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
