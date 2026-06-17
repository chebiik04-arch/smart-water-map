import { io } from "socket.io-client";

export function createSocket() {
  const token = readPersistedToken();
  return io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
    transports: ["websocket"],
    auth: token ? { token } : {}
  });
}

function readPersistedToken() {
  try {
    const persisted = JSON.parse(localStorage.getItem("smart-water-map-auth") || "{}");
    return persisted?.state?.token;
  } catch {
    return null;
  }
}
