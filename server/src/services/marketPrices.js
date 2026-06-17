import { fetchNormalizedMarketPrices } from "../providers/marketPriceProvider.js";

export async function fetchExternalMarketPrices() {
  return fetchNormalizedMarketPrices();
}

export function marketDecisionHint({ commodity, trend, price }) {
  if (commodity.toLowerCase().includes("goat") || commodity.toLowerCase().includes("cattle")) {
    if (trend === "FALLING") return "Consider selling vulnerable animals early before drought body-condition losses deepen.";
    if (trend === "RISING") return "Hold healthy animals if water access is secure; prices are improving.";
  }
  if (trend === "RISING") return "Forward-plan purchases; prices are rising under drought pressure.";
  if (trend === "FALLING") return "Compare storage and transport costs before waiting.";
  return `Current price is ${price}; monitor nearby markets before committing.`;
}
