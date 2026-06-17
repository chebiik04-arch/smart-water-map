import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

let ioInstance;

export function registerSocket(io) {
  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Missing socket token"));
      const payload = jwt.verify(token, env.jwtSecret);
      socket.data.user = payload;
      socket.join(`tenant:${payload.tenantId || "public"}`);
      return next();
    } catch {
      return next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("subscribe:district", async (districtId, ack) => {
      try {
        if (!districtId) return;
        const district = await prisma.district.findFirst({
          where: { id: districtId, ...(socket.data.user?.tenantId ? { tenantId: socket.data.user.tenantId } : {}) },
          select: { id: true }
        });
        if (!district) {
          ack?.({ ok: false, error: "District not found" });
          return;
        }
        socket.join(`district:${districtId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });
  });
}

export function emitSensorUpdate(reading) {
  emitTenant(reading.tenantId, "sensor:update", reading);
  if (reading.districtId) {
    ioInstance?.to(`district:${reading.districtId}`).emit("sensor:update", reading);
  }
}

export function emitAlertNew(alert) {
  emitTenant(alert.tenantId, "alert:new", alert);
  ioInstance?.to(`district:${alert.districtId}`).emit("alert:new", alert);
}

export function emitWaterSourceUpdate(update) {
  emitTenant(update.tenantId, "watersource:update", update);
  if (update.districtId) {
    ioInstance?.to(`district:${update.districtId}`).emit("watersource:update", update);
  }
}

export function emitForecastUpdated(forecast) {
  emitTenant(forecast.tenantId, "forecast:updated", forecast);
  if (forecast.districtId) {
    ioInstance?.to(`district:${forecast.districtId}`).emit("forecast:updated", forecast);
  }
}

export function emitAlertResolved(alert) {
  emitTenant(alert.tenantId, "alert:resolved", alert);
  ioInstance?.to(`district:${alert.districtId}`).emit("alert:resolved", alert);
}

function emitTenant(tenantId, event, payload) {
  ioInstance?.to(`tenant:${tenantId || "public"}`).emit(event, payload);
}
