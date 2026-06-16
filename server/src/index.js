import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { registerSocket } from "./services/socket.js";
import { registerJobs } from "./jobs/scheduler.js";

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*", methods: ["GET", "POST"] }
});

registerSocket(io);
registerJobs();

server.listen(env.port, () => {
  console.info(`Smart Water Map API listening on port ${env.port}`);
});
