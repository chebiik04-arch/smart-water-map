import { uuidSchema } from "../utils/http.js";

const uuidPathRules = [
  /^\/api\/v1\/districts\/([^/]+)/,
  /^\/api\/v1\/water-sources\/([^/]+)/,
  /^\/api\/v1\/sensors\/operations\/tickets\/([^/]+)/,
  /^\/api\/v1\/sensors\/(?!operations|summary)([^/]+)/,
  /^\/api\/v1\/alerts\/([^/]+)/,
  /^\/api\/v1\/forecasts\/([^/]+)/,
  /^\/api\/v1\/community\/reports\/([^/]+)/,
  /^\/api\/v1\/simulations\/groundwater\/([^/]+)/,
  /^\/api\/v1\/tenants\/([^/]+)/,
  /^\/api\/v1\/tenants\/([^/]+)\/users\/([^/]+)/,
  /^\/api\/v1\/provider\/sensors\/devices\/([^/]+)/,
  /^\/api\/v1\/advisory\/crops\/recommendations\/([^/]+)/,
  /^\/api\/v1\/satellite\/([^/]+)/,
  /^\/api\/v1\/ndvi\/([^/]+)/,
  /^\/api\/v1\/rainfall\/([^/]+)/,
  /^\/api\/v1\/groundwater\/([^/]+)/
];

export function validateUuidPath(req, res, next) {
  for (const rule of uuidPathRules) {
    const match = req.path.match(rule);
    const invalid = match?.slice(1).find((value) => !uuidSchema.safeParse(value).success);
    if (invalid) {
      return res.status(400).json({
        error: "Invalid UUID path parameter",
        code: "INVALID_UUID",
        details: [{ path: ["id"], message: "Expected UUID value" }]
      });
    }
  }
  return next();
}
