let ioInstance;

export function registerSocket(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("subscribe:district", (districtId) => {
      if (districtId) {
        socket.join(`district:${districtId}`);
      }
    });
  });
}

export function emitSensorUpdate(reading) {
  ioInstance?.emit("sensor:update", reading);
  if (reading.districtId) {
    ioInstance?.to(`district:${reading.districtId}`).emit("sensor:update", reading);
  }
}

export function emitAlertNew(alert) {
  ioInstance?.emit("alert:new", alert);
  ioInstance?.to(`district:${alert.districtId}`).emit("alert:new", alert);
}

export function emitAlertResolved(alert) {
  ioInstance?.emit("alert:resolved", alert);
  ioInstance?.to(`district:${alert.districtId}`).emit("alert:resolved", alert);
}

