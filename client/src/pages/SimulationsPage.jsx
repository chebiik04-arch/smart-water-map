import { useEffect, useState } from "react";
import { Activity, TrendingDown } from "lucide-react";
import { endpoints } from "../services/api";

export function SimulationsPage() {
  const [districts, setDistricts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ districtId: "", scenarioName: "Rainfall drops 30% for 6 weeks", rainfallDropPercent: 30, durationWeeks: 6 });

  useEffect(() => {
    Promise.all([endpoints.districts(), endpoints.simulations()]).then(([districtRes, simRes]) => {
      const options = districtRes.data.features.map((feature) => ({ id: feature.id, name: feature.properties.name }));
      setDistricts(options);
      setRuns(simRes.data);
      setForm((current) => ({ ...current, districtId: current.districtId || options[0]?.id || "" }));
    });
  }, []);

  async function runSimulation(event) {
    event.preventDefault();
    const { data } = await endpoints.runGroundwaterSimulation({
      ...form,
      rainfallDropPercent: Number(form.rainfallDropPercent),
      durationWeeks: Number(form.durationWeeks)
    });
    setRuns((current) => [data, ...current]);
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Digital Twin Simulation</h1>
        <p className="text-sm text-black/60">Plan groundwater outcomes under rainfall stress scenarios</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={runSimulation} className="space-y-3 rounded-lg border border-black/10 bg-white p-4 shadow-panel">
          <input className="w-full rounded-md border border-black/15 px-3 py-2" value={form.scenarioName} onChange={(e) => setForm({ ...form, scenarioName: e.target.value })} />
          <select className="w-full rounded-md border border-black/15 px-3 py-2" value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })}>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <label className="block text-sm font-medium">Rainfall drop %
            <input type="number" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" value={form.rainfallDropPercent} onChange={(e) => setForm({ ...form, rainfallDropPercent: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">Duration weeks
            <input type="number" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} />
          </label>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-white"><Activity size={16} /> Run simulation</button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {runs.map((run) => (
            <article key={run.id} className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{run.scenarioName}</h2><TrendingDown className="text-warning" size={18} /></div>
              <p className="mt-3 text-sm text-black/60">Baseline groundwater</p><p className="text-2xl font-semibold">{run.baselineGroundwater.toFixed(1)}%</p>
              <p className="mt-3 text-sm text-black/60">Projected groundwater</p><p className="text-2xl font-semibold text-danger">{run.projectedGroundwater.toFixed(1)}%</p>
              <p className="mt-3 rounded-full bg-danger/10 px-3 py-1 text-sm font-semibold text-danger">{run.projectedRiskLevel} · score {run.projectedSeverityScore}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

