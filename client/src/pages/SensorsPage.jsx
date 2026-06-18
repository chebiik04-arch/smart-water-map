import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { RadioTower, WifiOff, Wrench } from "lucide-react";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function SensorsPage() {
  const { data } = useQuery({
    queryKey: ["sensors-page"],
    queryFn: () => endpoints.sensors().then((res) => res.data)
  });
  const sensors = asArray(data);
  const total = sensors.length;
  const online = sensors.filter((sensor) => sensor.status === "ONLINE").length;
  const offline = sensors.filter((sensor) => sensor.status === "OFFLINE").length;
  const maintenance = sensors.filter((sensor) => sensor.status === "MAINTENANCE").length;
  const onlinePct = total ? Math.round((online / total) * 1000) / 10 : 0;
  const donut = [{ name: "Online", value: online }, { name: "Offline", value: offline }, { name: "Maintenance", value: maintenance }];

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Total Sensors" value={total} icon={RadioTower} />
        <Metric title="Online" value={online} tone="text-emerald-600" />
        <Metric title="Offline" value={offline} tone="text-red-600" icon={WifiOff} />
        <Metric title="Maintenance" value={maintenance} tone="text-amber-600" icon={Wrench} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Sensor Status</h2>
          <div className="relative mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} innerRadius={58} outerRadius={82} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#22C55E" />
                  <Cell fill="#EF4444" />
                  <Cell fill="#F59E0B" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div><p className="text-3xl font-bold">{onlinePct}%</p><p className="text-xs font-semibold text-emerald-600">Online</p></div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Legend color="bg-emerald-500" label="Online" value={`${online} (${onlinePct}%)`} />
            <Legend color="bg-red-500" label="Offline" value={`${offline} (${total ? Math.round((offline / total) * 1000) / 10 : 0}%)`} />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/10 p-4">
            <h2 className="text-sm font-bold">All Sensors</h2>
            <a href="/sensors" className="text-xs font-medium text-blue-600">View all sensors</a>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-background"><tr><th className="p-3">Sensor ID</th><th>Type</th><th>Location</th><th>Status</th><th>Last Reading</th><th>Battery</th></tr></thead>
            <tbody>
              {sensors.map((sensor, index) => (
                <tr key={sensor.id || index} className="border-t border-black/10">
                  <td className="p-3 font-medium">{sensor.id?.slice(0, 8) || `SEN-${String(index + 1).padStart(3, "0")}`}</td>
                  <td>{sensor.type}</td>
                  <td>{sensor.districtName || sensor.locationName}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${sensor.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{sensor.status}</span></td>
                  <td>{sensor.lastPing ? new Date(sensor.lastPing).toLocaleTimeString() : sensor.lastReading || "-"}</td>
                  <td>{sensor.battery || "-"}</td>
                </tr>
              ))}
              {!sensors.length && <tr><td colSpan={6} className="p-6 text-center text-sm text-black/50">No sensors returned by the backend.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

function Metric({ title, value, tone = "text-black", icon: Icon }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><p className="text-xs font-semibold">{title}</p><div className="mt-3 flex items-center justify-between"><p className={`text-3xl font-bold ${tone}`}>{value}</p>{Icon && <Icon size={25} className={tone} />}</div></article>;
}

function Legend({ color, label, value }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</span><strong>{value}</strong></div>;
}
