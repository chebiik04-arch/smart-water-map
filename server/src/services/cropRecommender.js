export function scoreCropVariety(variety, districtSignals) {
  const droughtFit = variety.droughtTolerance * 10;
  const waterPenalty = { LOW: 0, MEDIUM: 12, HIGH: 28 }[variety.waterDemand] || 12;
  const riskPenalty = { NORMAL: 0, WATCH: 6, WARNING: 16, EMERGENCY: 28 }[districtSignals.riskLevel] || 0;
  const ndviBonus = Math.max(0, districtSignals.ndvi * 20);
  const score = Math.max(0, Math.min(100, droughtFit + ndviBonus - waterPenalty - riskPenalty - variety.maturityDays / 12));
  return Number(score.toFixed(1));
}

export function recommendationRationale(variety, districtSignals) {
  return `${variety.varietyName} fits ${districtSignals.riskLevel.toLowerCase()} conditions because it has ${variety.waterDemand.toLowerCase()} water demand, drought tolerance ${variety.droughtTolerance}/10, and ${variety.maturityDays}-day maturity.`;
}

