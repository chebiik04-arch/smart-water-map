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
  const riskLabel = data.riskLabel || (pct >= 76 ? "Emergency" : pct >= 51 ? "High Risk" : pct >= 31 ? "Watch" : "Normal");
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold">AI Drought Forecast <span className="text-xs font-medium">(Next 30 Days)</span></h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-[11rem_1fr]">
        <div className="relative mx-auto h-44 w-44 sm:mx-0">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(#EF4444_0_78%,#E5E7EB_78%_100%)]" />
          <div className="absolute inset-[24px] grid place-items-center rounded-full bg-white text-center">
            <div>
              <p className="text-5xl font-bold leading-none">{pct}%</p>
              <p className="mt-2 text-xs font-bold text-red-500">{riskLabel}</p>
            </div>
          </div>
        </div>
        <div className="text-sm">
          <p className="font-bold">Drivers</p>
          {data.drivers?.map((driver) => {
            const Icon = driver.direction === "UP" ? ArrowUp : ArrowDown;
            return <p key={driver.factor} className="mt-2 flex items-center gap-2 text-black/65"><Icon size={13} className={driver.direction === "UP" ? "text-red-500" : "text-green-600"} />{driver.factor}</p>;
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
