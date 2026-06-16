import { useEffect, useState } from "react";
import { endpoints } from "../services/api";

export function SensorsPage() {
  const [sensors, setSensors] = useState([]);
  useEffect(() => {
    endpoints.sensors().then(({ data }) => setSensors(data)).catch(() => {});
  }, []);
  return (
    <section className="p-4 lg:p-6">
      <h1 className="mb-4 text-2xl font-semibold">Sensors</h1>
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel">
        <table className="w-full text-left text-sm">
          <thead className="bg-background"><tr><th className="p-3">Type</th><th>Status</th><th>District</th><th>Last ping</th></tr></thead>
          <tbody>{sensors.map((s) => <tr key={s.id} className="border-t border-black/10"><td className="p-3">{s.type}</td><td>{s.status}</td><td>{s.districtName}</td><td>{s.lastPing ? new Date(s.lastPing).toLocaleString() : "Never"}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

