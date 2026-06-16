import { scoreToLevel } from "../utils/droughtScore.js";

export function simulateGroundwaterScenario({ baselineGroundwater, rainfallDropPercent, durationWeeks, soilMoisturePercent = 55, ndvi = 0.45 }) {
  const rainfallStress = Math.max(0, rainfallDropPercent);
  const weeklyGroundwaterLoss = rainfallStress * 0.09 + 1.2;
  const projectedGroundwater = Math.max(0, baselineGroundwater - weeklyGroundwaterLoss * durationWeeks);
  const groundwaterStress = 100 - projectedGroundwater;
  const soilStress = 100 - Math.max(0, soilMoisturePercent - rainfallStress * 0.35);
  const vegetationStress = 100 - Math.max(0, ndvi * 100 - rainfallStress * 0.2);
  const score = Math.min(100, groundwaterStress * 0.45 + soilStress * 0.25 + vegetationStress * 0.15 + rainfallStress * 0.15);

  return {
    projectedGroundwater: Number(projectedGroundwater.toFixed(2)),
    projectedSeverityScore: Math.round(score),
    projectedRiskLevel: scoreToLevel(score),
    assumptions: {
      weeklyGroundwaterLoss: Number(weeklyGroundwaterLoss.toFixed(2)),
      rainfallDropPercent,
      durationWeeks,
      model: "linear-planning-v1"
    }
  };
}

