import { z } from "zod";

const defaultLimit = 50;
const maxLimit = 100;

export const uuidSchema = z.string().uuid();

export function paginationParams(query, options = {}) {
  const fallbackLimit = options.defaultLimit || defaultLimit;
  const limitCap = options.maxLimit || maxLimit;
  const limit = clampInt(query.limit, fallbackLimit, 1, limitCap);
  const page = clampInt(query.page, 1, 1, 10000);
  const offset = clampInt(query.offset, (page - 1) * limit, 0, 1000000);
  return { limit, page, offset };
}

export function requireUuid(value, name = "id") {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    const error = new Error(`Invalid ${name}`);
    error.status = 400;
    error.code = "INVALID_UUID";
    error.details = [{ path: [name], message: "Expected UUID value" }];
    throw error;
  }
  return result.data;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
