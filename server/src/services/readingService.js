import { prisma } from "../config/prisma.js";
import { emitSensorUpdate } from "./socket.js";

export async function createSensorReading(sensorId, { value, unit, metadata = {} }) {
  const sensor = await prisma.sensor.findUnique({ where: { id: sensorId }, include: { district: { select: { tenantId: true } } } });
  if (!sensor) {
    const err = new Error("Sensor not found");
    err.status = 404;
    throw err;
  }

  const reading = await prisma.sensorReading.create({
    data: { sensorId, value: Number(value), unit, metadata }
  });
  await prisma.sensor.update({ where: { id: sensorId }, data: { lastPing: new Date(), status: "ONLINE" } });

  const payload = { ...reading, districtId: sensor.districtId, tenantId: sensor.district?.tenantId, sensorType: sensor.type };
  emitSensorUpdate(payload);
  return payload;
}
