export function calculateDroughtScore({ groundwaterPercent, soilMoisturePercent, ndvi, rainfallAnomalyPercent }) {
  const groundwaterStress = 100 - clamp(groundwaterPercent, 0, 100);
  const soilStress = 100 - clamp(soilMoisturePercent, 0, 100);
  const vegetationStress = 100 - clamp(ndvi * 100, 0, 100);
  const rainfallStress = clamp(Math.abs(Math.min(rainfallAnomalyPercent, 0)), 0, 100);

  const score = groundwaterStress * 0.35 + soilStress * 0.3 + vegetationStress * 0.2 + rainfallStress * 0.15;
  return {
    score: Math.round(clamp(score, 0, 100)),
    level: scoreToLevel(score)
  };
}

export function scoreToLevel(score) {
  if (score <= 30) return "NORMAL";
  if (score <= 50) return "WATCH";
  if (score <= 75) return "WARNING";
  return "EMERGENCY";
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

