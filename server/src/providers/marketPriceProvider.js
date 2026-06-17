import { env } from "../config/env.js";
import { withRetry } from "../utils/retry.js";

let cached = { expiresAt: 0, data: [] };

export async function fetchNormalizedMarketPrices({ force = false } = {}) {
  if (!env.marketPriceApiUrl) return [];
  if (!force && cached.expiresAt > Date.now()) return cached.data;

  const data = await withRetry(async () => {
    const response = await fetch(env.marketPriceApiUrl, {
      headers: {
        ...(env.marketPriceApiKey ? { Authorization: `Bearer ${env.marketPriceApiKey}` } : {}),
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error(`Market price provider failed with ${response.status}`);
    return response.json();
  }, { attempts: 3, delayMs: 500 });

  const normalized = normalizeMarketPayload(data, env.marketPriceProvider);
  cached = { expiresAt: Date.now() + 15 * 60 * 1000, data: normalized };
  return normalized;
}

export function normalizeMarketPayload(payload, provider = "generic") {
  const rows = Array.isArray(payload) ? payload : payload?.prices || payload?.data || payload?.results || [];
  return rows.map((item) => normalizeRow(item, provider)).filter(Boolean);
}

function normalizeRow(item, provider) {
  const commodity = item.commodity || item.crop || item.product || item.itemName;
  const marketName = item.marketName || item.market || item.location || item.county;
  const price = Number(item.price ?? item.wholesalePrice ?? item.retailPrice ?? item.value);
  if (!commodity || !marketName || !Number.isFinite(price)) return null;
  return {
    commodity: String(commodity),
    marketName: String(marketName),
    unit: String(item.unit || item.measure || "kg"),
    price,
    currency: String(item.currency || "KES"),
    observedAt: item.observedAt ? new Date(item.observedAt) : new Date(),
    trend: normalizeTrend(item.trend || item.changeDirection),
    source: String(item.source || provider || "market_provider")
  };
}

function normalizeTrend(value = "STABLE") {
  const normalized = String(value).toUpperCase();
  if (["UP", "RISING", "INCREASED"].includes(normalized)) return "RISING";
  if (["DOWN", "FALLING", "DECREASED"].includes(normalized)) return "FALLING";
  return "STABLE";
}
