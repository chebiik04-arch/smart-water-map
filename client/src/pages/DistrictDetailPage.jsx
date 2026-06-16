import { useParams } from "react-router-dom";
import { TimeSeriesChart } from "../components/TimeSeriesChart";

const demo = Array.from({ length: 12 }, (_, i) => ({ label: `D${i + 1}`, value: 60 - i * 2, average: 70 - i }));

export function DistrictDetailPage() {
  const { id } = useParams();
  return (
    <section className="space-y-4 p-4 lg:p-6">
      <h1 className="text-2xl font-semibold">District {id}</h1>
      <div className="grid gap-4 xl:grid-cols-3">
        <TimeSeriesChart data={demo} />
        <TimeSeriesChart data={demo} lines={[{ dataKey: "value", color: "#1B4D3E" }, { dataKey: "average", color: "#E07B00" }]} />
        <TimeSeriesChart data={demo.map((row) => ({ ...row, value: row.value / 100 }))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">Active alerts list</div>
        <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">Community reports feed</div>
      </div>
    </section>
  );
}

