import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, CloudRain, RefreshCw, TrendingDown } from "lucide-react";
import { DroughtForecastGauge } from "../components/charts/DroughtForecastGauge";
import { DroughtMap } from "../components/map/DroughtMap";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function SimulationsPage() {
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState({ districtId: "", rainfallDropPercent: 30, durationWeeks: 6 });
  const { data: forecast } = useQuery({
    queryKey: ["forecast-page-latest", form.districtId],
    queryFn: () => endpoints.latestForecast(form.districtId).then((res) => res.data),
    enabled: Boolean(form.districtId)
  });

  useEffect(() => {
    endpoints.districts().then((districtRes) => {
      const options = (districtRes.data.features || []).map((feature) => ({ id: feature.id, name: feature.properties.name }));
      setDistricts(options);
      setForm((current) => ({ ...current, districtId: current.districtId || options[0]?.id || "" }));
    });
  }, []);

  const probability = Math.round((forecast?.riskScore || 0) * 100);
  const districtOptions = districts.length ? districts : [{ id: "", name: "No districts returned" }];
  const selectedDistrictId = form.districtId || districtOptions[0].id;
  const selectedDistrict = districtOptions.find((district) => district.id === selectedDistrictId)?.name || "Selected district";
  const drivers = asArray(forecast?.drivers);
  const riskLabel = forecast?.riskLabel || "Unavailable";

  return (
    <section className="space-y-4 bg-[#F5F6F4] p-4 text-[#17201d] lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">AI Drought Forecast</h1>
          <p className="text-sm text-black/60">{selectedDistrict}, Kenya</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="min-w-48 rounded-md border border-black/10 bg-white px-3 py-2 text-sm" value={selectedDistrictId} onChange={(event) => setForm({ ...form, districtId: event.target.value })}>
            {districtOptions.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm"><option>Next 30 Days</option></select>
          <button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ForecastMetric title="Drought Probability" value={`${probability}%`} subtext={riskLabel} icon={TrendingDown} danger />
        <ForecastMetric title="Confidence Level" value={forecast?.confidenceScore ? `${Math.round(forecast.confidenceScore * 100)}%` : "-"} subtext="Model agreement" icon={Activity} />
        <ForecastMetric title="Forecast Period" value="30 days" subtext="Rolling outlook" icon={CalendarDays} />
        <ForecastMetric title="Rainfall Scenario" value={`${form.rainfallDropPercent}%`} subtext={`${form.durationWeeks} week stress test`} icon={CloudRain} warning />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <DroughtForecastGauge districtId={form.districtId} />
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Forecast Summary</h2>
          <div className="mt-4 space-y-4 text-sm">
            <Summary label="Probability" value={`${probability}%`} />
            <Summary label="Confidence Level" value={forecast?.confidenceScore ? `${Math.round(forecast.confidenceScore * 100)}%` : "-"} />
            <Summary label="Forecast Period" value="Next 30 Days" />
            <Summary label="Forecast Date" value={forecast?.forecastDate ? new Date(forecast.forecastDate).toLocaleDateString() : "-"} />
            <Summary label="Model Version" value={forecast?.modelVersion || "-"} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Drivers</h2>
          {drivers.length ? drivers.map((driver) => (
            <div key={driver.factor} className="mt-3 rounded-md bg-background p-3 text-sm">
              <p className="font-semibold">{driver.factor}</p>
              <p className="text-xs capitalize text-black/55">{driver.impact?.toLowerCase?.() || "-"} impact</p>
            </div>
          )) : <p className="mt-3 text-sm text-black/50">No forecast drivers returned by the backend.</p>}
        </section>
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">Forecast Map</h2>
              <p className="text-xs text-black/55">Drought risk spread across the selected area of interest</p>
            </div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">{riskLabel}</span>
          </div>
          <div className="h-[390px]">
            <DroughtMap districtId={form.districtId} allLayers />
          </div>
        </section>
      </div>

    </section>
  );
}

function ForecastMetric({ title, value, subtext, icon: Icon, danger = false, warning = false }) {
  const tone = danger ? "bg-red-500 text-white" : warning ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700";
  return (
    <article className="flex min-h-24 items-center justify-between rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${danger ? "text-red-600" : ""}`}>{value}</p>
        <p className={`mt-1 text-xs ${danger ? "text-red-500" : warning ? "text-orange-700" : "text-emerald-700"}`}>{subtext}</p>
      </div>
      <span className={`grid h-14 w-14 place-items-center rounded-full ${tone}`}><Icon size={27} /></span>
    </article>
  );
}

function Summary({ label, value }) {
  return <div><p className="text-xs text-black/50">{label}</p><p className="font-bold">{value}</p></div>;
}
