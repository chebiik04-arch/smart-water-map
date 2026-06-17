import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import apiV1Routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { uploadRootPath } from "./services/uploadStorage.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(morgan("combined"));
  app.use("/uploads", express.static(uploadRootPath()));

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "smart-water-map-server" });
  });

  app.use("/api/v1", apiV1Routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
