export function buildIrrigationAdvice({ cropName, soilMoisturePercent, evapotranspirationMmDay, rainfallForecastMm = 0 }) {
  const targetMoisture = cropTargetMoisture(cropName);
  const deficitPercent = Math.max(0, targetMoisture - soilMoisturePercent);
  const etReplacementMm = Math.max(0, evapotranspirationMmDay * 3 - rainfallForecastMm);
  const waterMm = Math.max(0, deficitPercent * 0.8 + etReplacementMm);
  const daysUntilIrrigation = soilMoisturePercent < targetMoisture * 0.65 ? 0 : soilMoisturePercent < targetMoisture ? 1 : 3;
  const priority = waterMm > 35 ? "EMERGENCY" : waterMm > 22 ? "WARNING" : waterMm > 10 ? "WATCH" : "WATCH";

  return {
    recommendedDate: new Date(Date.now() + daysUntilIrrigation * 24 * 60 * 60 * 1000),
    waterMm: Number(waterMm.toFixed(1)),
    litersPerHectare: Math.round(waterMm * 10000),
    priority,
    rationale: `${cropName} target moisture is ${targetMoisture}%. Current soil moisture is ${soilMoisturePercent}%, with ET at ${evapotranspirationMmDay} mm/day.`
  };
}

function cropTargetMoisture(cropName = "") {
  const normalized = cropName.toLowerCase();
  if (normalized.includes("sorghum") || normalized.includes("millet")) return 34;
  if (normalized.includes("cowpea") || normalized.includes("green gram")) return 38;
  if (normalized.includes("maize")) return 48;
  return 42;
}

