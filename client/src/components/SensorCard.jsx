import { RadioTower } from "lucide-react";

export function SensorCard({ sensor }) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{sensor.type}</p>
          <p className="text-xs text-black/60">{sensor.districtName || sensor.district?.name}</p>
        </div>
        <RadioTower className={sensor.status === "ONLINE" ? "text-safe" : "text-danger"} size={20} />
      </div>
      <p className="mt-4 text-xs text-black/60">Last ping</p>
      <p className="text-sm">{sensor.lastPing ? new Date(sensor.lastPing).toLocaleString() : "No ping yet"}</p>
    </article>
  );
}

