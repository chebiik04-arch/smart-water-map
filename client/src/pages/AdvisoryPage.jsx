import { useEffect, useState } from "react";
import { CalendarDays, Droplets, Sprout, TrendingUp, Waves } from "lucide-react";
import { endpoints } from "../services/api";

export function AdvisoryPage() {
  const [districts, setDistricts] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [cropName, setCropName] = useState("Sorghum");
  const [schedules, setSchedules] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [market, setMarket] = useState({ stored: [], external: [] });
  const [livestock, setLivestock] = useState({ waterPoints: [], pasture: [] });

  useEffect(() => {
    Promise.all([
      endpoints.districts(),
      endpoints.irrigationSchedules(),
      endpoints.marketPrices(),
      endpoints.livestockWaterStress()
    ]).then(([districtRes, scheduleRes, marketRes, livestockRes]) => {
      const options = districtRes.data.features.map((feature) => ({ id: feature.id, name: feature.properties.name }));
      setDistricts(options);
      setDistrictId(options[0]?.id || "");
      setSchedules(scheduleRes.data);
      setMarket(marketRes.data);
      setLivestock(livestockRes.data);
    });
  }, []);

  useEffect(() => {
    if (!districtId) return;
    endpoints.cropRecommendations(districtId).then(({ data }) => setRecommendations(data.recommendations));
  }, [districtId]);

  async function createSchedule(event) {
    event.preventDefault();
    const { data } = await endpoints.createIrrigationSchedule({ districtId, cropName });
    setSchedules((current) => [data, ...current]);
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Farmer Advisory</h1>
        <p className="text-sm text-black/60">Irrigation timing, drought-tolerant crops, market signals, and pastoral water stress</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={createSchedule} className="space-y-3 rounded-lg border border-black/10 bg-white p-4 shadow-panel">
          <div className="flex items-center gap-2 text-primary"><Droplets size={18} /><h2 className="font-semibold">Irrigation assistant</h2></div>
          <select className="w-full rounded-md border border-black/15 px-3 py-2" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <input className="w-full rounded-md border border-black/15 px-3 py-2" value={cropName} onChange={(e) => setCropName(e.target.value)} />
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-white"><CalendarDays size={16} /> Generate schedule</button>
        </form>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={Droplets} label="Water points stressed" value={livestock.waterPoints.filter((point) => point.status !== "RELIABLE").length} />
          <Metric icon={Sprout} label="Crop options" value={recommendations.length} />
          <Metric icon={TrendingUp} label="Market signals" value={market.stored.length + market.external.length} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Irrigation schedules">
          <div className="space-y-3 p-3">
            {schedules.map((schedule) => (
              <article key={schedule.id} className="rounded-md border border-black/10 p-3">
                <div className="flex items-center justify-between"><p className="font-semibold">{schedule.cropName}</p><span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold text-warning">{schedule.priority}</span></div>
                <p className="mt-2 text-sm">{schedule.rationale}</p>
                <p className="mt-2 text-sm text-primary">{schedule.waterMm} mm · {schedule.litersPerHectare.toLocaleString()} L/ha · {new Date(schedule.recommendedDate).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Drought-tolerant crop recommendations">
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {recommendations.map(({ variety, score, rationale }) => (
              <article key={variety.id} className="rounded-md border border-black/10 p-3">
                <p className="font-semibold">{variety.cropName} · {variety.varietyName}</p>
                <p className="text-sm text-primary">Fit score {score}/100</p>
                <p className="mt-2 text-sm text-black/65">{rationale}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Market price integration">
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Commodity</th><th>Market</th><th>Price</th><th>Decision hint</th></tr></thead>
            <tbody>{market.stored.map((item) => <tr key={item.id} className="border-t border-black/10"><td className="p-3">{item.commodity}</td><td>{item.marketName}</td><td>{item.currency} {item.price}/{item.unit}</td><td className="max-w-sm pr-3">{item.decisionHint}</td></tr>)}</tbody>
          </table>
        </Panel>

        <Panel title="Livestock water stress">
          <div className="space-y-3 p-3">
            {livestock.waterPoints.map((point) => (
              <article key={point.id} className="rounded-md border border-black/10 p-3">
                <div className="flex items-center justify-between"><p className="font-semibold">{point.name}</p><span className="rounded-full bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">{point.status}</span></div>
                <p className="mt-2 text-sm text-black/65">{point.districtName} · {point.supportedLivestock} livestock · {Number(point.daysRemaining).toFixed(1)} days remaining</p>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <article className="rounded-lg border border-black/10 bg-white p-5 shadow-panel"><Icon className="text-primary" size={22} /><p className="mt-4 text-3xl font-semibold">{value}</p><p className="text-sm text-black/60">{label}</p></article>;
}

function Panel({ title, children }) {
  return <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel"><h2 className="border-b border-black/10 p-4 font-semibold">{title}</h2>{children}</div>;
}
