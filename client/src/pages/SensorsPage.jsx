import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Download, Plus, X } from "lucide-react";
import { Pagination, usePagination } from "../components/Pagination";
import { ErrorState, EmptyState } from "../components/ApiState";
import { endpoints } from "../services/api";
import { apiErrorMessage, asArray } from "../utils/apiData";
import { useAuthStore } from "../stores/authStore";

const sensorTypes = ["Groundwater", "Soil Moisture", "Weather", "Rainfall"];
const statusOptions = ["Online", "Offline", "Maintenance"];
const statusTone = {
  Online: "bg-emerald-100 text-emerald-700",
  Offline: "bg-red-100 text-red-700",
  Maintenance: "bg-amber-100 text-amber-700"
};
const donutColors = ["#22C55E", "#EF4444", "#F59E0B"];

export function SensorsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState("");
  const canAdd = ["admin", "field_agent"].includes(user?.role);

  const { data: sensorsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sensors-page"],
    queryFn: () => endpoints.sensors().then((res) => res.data)
  });
  const { data: summaryData } = useQuery({
    queryKey: ["sensors-summary"],
    queryFn: () => endpoints.sensorSummary().then((res) => res.data)
  });

  const sensors = asArray(sensorsData);
  const sensorsPagination = usePagination(sensors, 8);
  const fallbackSummary = useMemo(() => {
    const total = sensors.length;
    const online = sensors.filter((sensor) => sensor.status === "Online").length;
    const offline = sensors.filter((sensor) => sensor.status === "Offline").length;
    const maintenance = sensors.filter((sensor) => sensor.status === "Maintenance").length;
    return { total, online, offline, maintenance, health_pct: total ? Math.round((online / total) * 100) : 0 };
  }, [sensors]);
  const summary = summaryData || fallbackSummary;
  const donut = [
    { name: "Online", value: summary.online || 0 },
    { name: "Offline", value: summary.offline || 0 },
    { name: "Maintenance", value: summary.maintenance || 0 }
  ];

  const createMutation = useMutation({
    mutationFn: (payload) => endpoints.createSensor(payload).then((res) => res.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sensors-page"] }),
        queryClient.invalidateQueries({ queryKey: ["sensors-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["sensors"] })
      ]);
      setModalOpen(false);
      setForm(defaultForm);
      setFormError("");
    },
    onError: (error) => setFormError(error.response?.data?.error || "Unable to add sensor.")
  });

  function submitSensor(event) {
    event.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.location.trim()) {
      setFormError("Name and location are required.");
      return;
    }
    createMutation.mutate({
      sensor_id: form.sensor_id.trim() || undefined,
      name: form.name.trim(),
      location: form.location.trim(),
      type: form.type,
      status: form.status,
      battery: Number(form.battery),
      signal: Number(form.signal),
      reading: form.reading === "" ? undefined : Number(form.reading)
    });
  }

  function exportSensors() {
    const headers = ["SENSOR ID", "NAME", "LOCATION", "TYPE", "BATTERY", "SIGNAL", "READING", "STATUS", "LAST UPDATED"];
    const lines = sensors.map((sensor) => [
      sensor.sensor_id,
      sensor.name,
      sensor.location,
      sensor.type,
      `${sensor.battery}%`,
      sensor.signal,
      sensor.reading,
      sensor.status,
      sensor.last_updated
    ]);
    const csv = [headers, ...lines].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sensors.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4 bg-[#F5F7F2] p-4 text-[#17201d] lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Sensors</h1>
          <p className="mt-1 text-sm text-black/55">IoT sensor network - Makueni County</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportSensors} className="inline-flex h-9 items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-sm font-semibold text-black/70 hover:bg-black/5">
            <Download size={15} /> Export
          </button>
          {canAdd && (
            <button type="button" onClick={() => { setForm(defaultForm); setFormError(""); setModalOpen(true); }} className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
              <Plus size={15} /> Add Sensor
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_19rem]">
        <StatCard value={summary.total || 0} label="Total Sensors" className="bg-white" />
        <StatCard value={summary.online || 0} label="Online" valueClass="text-emerald-600" className="bg-emerald-50" />
        <StatCard value={summary.offline || 0} label="Offline" valueClass="text-red-600" className="bg-red-50" />
        <StatCard value={summary.maintenance || 0} label="Maintenance" valueClass="text-amber-600" className="bg-amber-50" />
        <NetworkHealthCard summary={summary} donut={donut} />
      </div>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <h2 className="text-sm font-bold">All Sensors</h2>
          <span className="text-xs text-black/45">{summary.total || sensors.length} devices</span>
        </div>
        {isError && <div className="p-4"><ErrorState message={apiErrorMessage(error, "Unable to load sensors.")} onRetry={refetch} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#F7FBF9] text-xs uppercase text-black/50">
              <tr>
                <th className="p-3">Sensor ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Type</th>
                <th>Battery</th>
                <th>Signal</th>
                <th>Reading</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {sensorsPagination.pageRows.map((sensor) => (
                <tr key={sensor.id || sensor.sensor_id} className="border-t border-black/10 hover:bg-emerald-50/50">
                  <td className="p-3 font-mono text-xs font-semibold">{sensor.sensor_id}</td>
                  <td className="font-semibold">{sensor.name}</td>
                  <td>{sensor.location}</td>
                  <td>{sensor.type}</td>
                  <td><Battery value={sensor.battery} /></td>
                  <td><Signal value={sensor.signal} offline={sensor.status === "Offline"} /></td>
                  <td className="font-semibold">{sensor.reading || "-"}</td>
                  <td><StatusBadge status={sensor.status} /></td>
                  <td className="text-black/45">{relativeTime(sensor.last_updated)}</td>
                </tr>
              ))}
              {!sensors.length && !isError && (
                <tr>
                  <td colSpan={9} className="p-6">
                    {isLoading ? (
                      <div className="text-center text-sm text-black/50">Loading sensors...</div>
                    ) : (
                      <EmptyState title="No sensors" message="No sensors were returned for the current filters." />
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={sensorsPagination} />
      </section>

      {modalOpen && (
        <SensorModal
          form={form}
          setForm={setForm}
          error={formError}
          saving={createMutation.isPending}
          onClose={() => setModalOpen(false)}
          onSubmit={submitSensor}
        />
      )}
    </section>
  );
}

function NetworkHealthCard({ summary, donut }) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <h2 className="text-center text-xs font-bold text-black/60">Network Health</h2>
      <div className="relative mx-auto mt-1 h-32 max-w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={donut} innerRadius={42} outerRadius={58} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
              {donut.map((item, index) => <Cell key={item.name} fill={donutColors[index]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-bold text-emerald-600">{summary.health_pct || 0}%</p>
            <p className="text-[11px] text-black/55">Online</p>
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <Legend color="bg-emerald-500" label="Online" value={summary.online || 0} />
        <Legend color="bg-red-500" label="Offline" value={summary.offline || 0} />
        <Legend color="bg-amber-500" label="Maintenance" value={summary.maintenance || 0} />
      </div>
    </article>
  );
}

function SensorModal({ form, setForm, error, saving, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-[800] grid place-items-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="font-bold">Add Sensor</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Sensor ID"><input className="input" value={form.sensor_id} onChange={(event) => setForm({ ...form, sensor_id: event.target.value })} placeholder="Auto-generated" /></Field>
          <Field label="Name"><input required className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Location"><input required className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Wote" /></Field>
          <Field label="Type"><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{sensorTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
          <Field label="Battery (%)"><input className="input" type="number" min="0" max="100" value={form.battery} onChange={(event) => setForm({ ...form, battery: event.target.value })} /></Field>
          <Field label="Signal bars"><input className="input" type="number" min="0" max="4" value={form.signal} onChange={(event) => setForm({ ...form, signal: event.target.value })} /></Field>
          <Field label="Reading"><input className="input" type="number" step="any" value={form.reading} onChange={(event) => setForm({ ...form, reading: event.target.value })} /></Field>
        </div>
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5">Cancel</button>
          <button disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? "Saving..." : "Save Sensor"}</button>
        </div>
      </form>
    </div>
  );
}

function StatCard({ value, label, valueClass = "text-black", className = "bg-white" }) {
  return (
    <article className={`min-h-36 rounded-lg border border-black/10 p-4 text-center shadow-sm ${className}`}>
      <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-2 text-xs text-black/55">{label}</p>
    </article>
  );
}

function Battery({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  const color = pct < 20 ? "bg-red-500" : pct <= 50 ? "bg-amber-500" : "bg-emerald-500";
  const text = pct < 20 ? "text-red-600" : pct <= 50 ? "text-amber-600" : "text-black/70";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 rounded bg-black/10"><span className={`block h-full rounded ${color}`} style={{ width: `${pct}%` }} /></span>
      <span className={`text-xs font-semibold ${text}`}>{pct}%</span>
    </span>
  );
}

function Signal({ value, offline }) {
  const count = offline ? 0 : Math.max(0, Math.min(4, Number(value || 0)));
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-label={`${count} signal bars`}>
      {[1, 2, 3, 4].map((bar) => (
        <span key={bar} className={`w-1.5 rounded-sm ${bar <= count ? "bg-emerald-600" : "bg-black/15"}`} style={{ height: `${bar * 4}px` }} />
      ))}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[status] || statusTone.Online}`}>{status}</span>;
}

function Legend({ color, label, value }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span><strong>{value}</strong></div>;
}

function Field({ label, children }) {
  return <label className="block text-sm font-semibold text-black/65">{label}<div className="mt-1 [&_.input]:w-full [&_.input]:rounded-md [&_.input]:border [&_.input]:border-black/10 [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm">{children}</div></label>;
}

function relativeTime(value) {
  if (!value) return "-";
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return "-";
  const minutes = Math.max(0, Math.round(delta / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
}

const defaultForm = {
  sensor_id: "",
  name: "",
  location: "",
  type: "Groundwater",
  status: "Online",
  battery: "100",
  signal: "4",
  reading: ""
};
