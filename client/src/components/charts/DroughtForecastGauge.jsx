import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { endpoints } from "../../services/api";

const fallback = { riskScore: 0.78, riskLabel: "High Risk", recommendation: ["Increase water harvesting", "Monitor boreholes closely"], drivers: [{ factor: "Rainfall Deficit", direction: "DOWN", impact: "HIGH" }, { factor: "Temperature Anomaly", direction: "UP", impact: "HIGH" }, { factor: "Vegetation Health", direction: "DOWN", impact: "MEDIUM" }, { factor: "Soil Moisture", direction: "DOWN", impact: "MEDIUM" }] };

export function DroughtForecastGauge({ districtId }) {
  const { data = fallback } = useQuery({
    queryKey: ["latest-forecast", districtId],
    queryFn: () => endpoints.latestForecast(districtId).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const pct = Math.round((data.riskScore || 0) * 100);
  const angle = -90 + pct * 1.8;
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">AI Drought Forecast <span className="text-xs font-medium">(Next 30 Days)</span></h2>
      <div className="mt-4 grid grid-cols-[8rem_1fr] gap-4">
        <div className="relative h-32">
          <svg viewBox="0 0 160 100" className="h-full w-full">
            <path d="M20 80 A60 60 0 0 1 140 80" fill="none" stroke="#E5E7EB" strokeWidth="16" strokeLinecap="round" />
            <path d="M20 80 A60 60 0 0 1 56 24" fill="none" stroke="#22C55E" strokeWidth="16" strokeLinecap="round" />
            <path d="M56 24 A60 60 0 0 1 98 24" fill="none" stroke="#F59E0B" strokeWidth="16" strokeLinecap="round" />
            <path d="M98 24 A60 60 0 0 1 128 50" fill="none" stroke="#E07B00" strokeWidth="16" strokeLinecap="round" />
            <path d="M128 50 A60 60 0 0 1 140 80" fill="none" stroke="#C0392B" strokeWidth="16" strokeLinecap="round" />
            <line x1="80" y1="80" x2="80" y2="28" stroke="#111827" strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 80 80)`} />
            <circle cx="80" cy="80" r="5" fill="#111827" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="text-3xl font-bold">{pct}%</p>
            <p className="text-xs font-bold text-red-500">{data.riskLabel}</p>
          </div>
        </div>
        <div className="text-xs">
          <p className="font-bold">Drivers</p>
          {data.drivers?.map((driver) => {
            const Icon = driver.direction === "UP" ? ArrowUp : ArrowDown;
            return <p key={driver.factor} className="mt-1 flex items-center gap-1 text-black/65"><Icon size={12} className={driver.direction === "UP" ? "text-red-500" : "text-green-600"} />{driver.factor}</p>;
          })}
          <p className="mt-3 font-bold text-emerald-700">Recommendation</p>
          <ul className="mt-1 space-y-1 text-black/65">
            {data.recommendation?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
