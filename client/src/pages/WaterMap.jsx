import { useState } from "react";
import { DroughtMap } from "../components/map/DroughtMap";
import { TimeSeriesChart } from "../components/TimeSeriesChart";

export function WaterMap() {
  const [selectedSource, setSelectedSource] = useState(null);
  return (
    <section className="relative h-[calc(100vh-4rem)] bg-background">
      <DroughtMap allLayers expanded onWaterSourceClick={setSelectedSource} />
      {selectedSource && (
        <aside className="absolute right-0 top-0 z-[600] h-full w-96 max-w-full border-l border-black/10 bg-white p-4 shadow-panel">
          <button className="mb-4 text-sm text-black/60" onClick={() => setSelectedSource(null)}>Close</button>
          <h1 className="text-xl font-bold">{selectedSource.name}</h1>
          <p className="mt-1 text-sm text-black/60">{selectedSource.type} · {selectedSource.status}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Depth" value={selectedSource.depth ?? "n/a"} />
            <Metric label="Yield" value={selectedSource.yield ?? "n/a"} />
            <Metric label="Latest level" value={selectedSource.latestLevel ?? "n/a"} />
            <Metric label="Last inspected" value={selectedSource.lastInspected ? new Date(selectedSource.lastInspected).toLocaleDateString() : "n/a"} />
          </div>
          <div className="mt-4">
            <TimeSeriesChart data={[]} height={220} />
          </div>
          <button className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Edit source</button>
        </aside>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-md bg-background p-3"><p className="text-xs text-black/50">{label}</p><p className="font-semibold">{value}</p></div>;
}
