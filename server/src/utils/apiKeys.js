import crypto from "node:crypto";

export function generateApiKey() {
  return `swm_${crypto.randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function keyPrefix(key) {
  return key.slice(0, 12);
}

