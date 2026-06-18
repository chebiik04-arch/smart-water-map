import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle, MapPin, Plus, RotateCw, X } from "lucide-react";
import { DroughtMap } from "../components/map/DroughtMap";
import { endpoints } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { asArray } from "../utils/apiData";
import { compressPhoto, getGpsPosition } from "../utils/photoEvidence";
import { getQueuedReports, queueReport, syncQueuedReports } from "../utils/offlineReports";

const initialForm = { districtId: "", latitude: "", longitude: "", waterLevel: "", description: "", photoUrl: "", gpsAccuracyMeters: "", photoMetadata: null };

export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState("pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [queuedCount, setQueuedCount] = useState(0);
  const [status, setStatus] = useState("");
  const canVerify = useMemo(() => ["admin", "field_agent"].includes(user?.role), [user]);

  const { data: reportData, refetch: refetchReports } = useQuery({
    queryKey: ["community-reports-page"],
    queryFn: () => endpoints.communityReports({ limit: 100 }).then((res) => res.data)
  });
  const { data: districtData } = useQuery({
    queryKey: ["community-reports-districts"],
    queryFn: () => endpoints.districts().then((res) => res.data)
  });
  const { data: queueData } = useQuery({
    queryKey: ["community-report-queue-count"],
    queryFn: async () => {
      const queued = await getQueuedReports();
      setQueuedCount(queued.length);
      return queued;
    }
  });

  const reports = asArray(reportData);
  const districts = asArray(districtData?.features).map((feature) => ({ id: feature.id, name: feature.properties?.name }));
  const visibleReports = reports.filter((report) => tab === "pending" ? report.status !== "VERIFIED" : report.status === "VERIFIED");
  const stats = {
    total: reports.length,
    pending: reports.filter((report) => report.status !== "VERIFIED" && report.status !== "REJECTED").length,
    verified: reports.filter((report) => report.status === "VERIFIED").length,
    rejected: reports.filter((report) => report.status === "REJECTED").length
  };

  async function captureGps() {
    const position = await getGpsPosition();
    setForm((current) => ({ ...current, latitude: String(Number(position.coords.latitude.toFixed(6))), longitude: String(Number(position.coords.longitude.toFixed(6))), gpsAccuracyMeters: String(Math.round(position.coords.accuracy)) }));
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressPhoto(file);
    setForm((current) => ({ ...current, photoUrl: compressed, photoMetadata: { originalName: file.name, originalBytes: file.size, compressedBytes: compressed.length, gpsTagged: Boolean(current.latitude && current.longitude), capturedAt: new Date().toISOString() } }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = { districtId: form.districtId || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude), waterLevel: Number(form.waterLevel), description: form.description, photoUrl: form.photoUrl || undefined, gpsAccuracyMeters: form.gpsAccuracyMeters ? Number(form.gpsAccuracyMeters) : undefined, photoMetadata: form.photoMetadata || undefined };
    try {
      if (navigator.onLine) {
        await endpoints.communityReport(payload);
        setStatus("Report submitted.");
        await refetchReports();
      } else {
        await queueReport(payload);
        setStatus("Report queued for sync.");
      }
      setForm(initialForm);
      setShowForm(false);
      const queued = await getQueuedReports();
      setQueuedCount(queued.length);
    } catch {
      await queueReport(payload);
      setStatus("Connection failed. Report saved offline.");
      const queued = await getQueuedReports();
      setQueuedCount(queued.length);
    }
  }

  async function handleSync() {
    const synced = await syncQueuedReports();
    setStatus(synced.length ? `${synced.length} report(s) synced.` : "No queued reports to sync.");
    await refetchReports();
    const queued = await getQueuedReports();
    setQueuedCount(queued.length);
  }

  async function verifyReport(id) {
    await endpoints.verifyReport(id);
    await refetchReports();
  }

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Community Reports</h1>
          <p className="text-sm text-black/55">Field reports from communities and agents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSync} className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold"><RotateCw size={15} /> Sync Queue ({queuedCount || queueData?.length || 0})</button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add Report</button>
        </div>
      </div>

      <div className="flex gap-2 rounded-lg border border-black/10 bg-white p-1 shadow-sm">
        <Tab active={tab === "pending"} onClick={() => setTab("pending")}>Pending Review</Tab>
        <Tab active={tab === "verified"} onClick={() => setTab("verified")}>Verified Reports</Tab>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Total Reports" value={stats.total} />
        <Metric title="Pending" value={stats.pending} tone="text-amber-600" />
        <Metric title="Verified" value={stats.verified} tone="text-emerald-600" />
        <Metric title="Rejected" value={stats.rejected} tone="text-red-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 p-4"><h2 className="text-sm font-bold">Report List</h2></div>
          <div className="divide-y divide-black/10">
            {visibleReports.map((report) => <ReportRow key={report.id} report={report} canVerify={canVerify} onVerify={verifyReport} />)}
            {!visibleReports.length && <p className="p-6 text-center text-sm text-black/50">No reports returned by the backend for this view.</p>}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 p-4"><h2 className="text-sm font-bold">Report Locations</h2></div>
          <div className="h-[360px]"><DroughtMap showLayerPanel={false} showLegend /></div>
        </section>
      </div>

      {status && <p className="text-sm text-primary">{status}</p>}

      {showForm && (
        <div className="fixed inset-0 z-[900] grid place-items-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-lg bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between"><h2 className="font-bold">Add Community Report</h2><button type="button" onClick={() => setShowForm(false)}><X size={18} /></button></div>
            <select aria-label="Report district" className="w-full rounded-md border border-black/15 px-3 py-2" value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })}>
              <option value="">District</option>
              {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
              <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
            </div>
            <button type="button" onClick={captureGps} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm"><MapPin size={16} /> GPS {form.gpsAccuracyMeters && `+/-${form.gpsAccuracyMeters}m`}</button>
            <input className="w-full rounded-md border border-black/15 px-3 py-2" type="number" placeholder="Water level" value={form.waterLevel} onChange={(e) => setForm({ ...form, waterLevel: e.target.value })} required />
            <textarea className="min-h-24 w-full rounded-md border border-black/15 px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary"><Camera size={16} /> Capture Photo<input className="hidden" type="file" accept="image/*" capture="environment" onChange={handlePhoto} /></label>
            {form.photoUrl && <img src={form.photoUrl} alt="Compressed evidence preview" className="h-36 w-full rounded-md object-cover" />}
            <button className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white" type="submit">Submit Report</button>
          </form>
        </div>
      )}
    </section>
  );
}

function Tab({ active, onClick, children }) {
  return <button onClick={onClick} className={`rounded-md px-4 py-2 text-sm font-semibold ${active ? "bg-emerald-700 text-white" : "text-black/65 hover:bg-black/[0.03]"}`}>{children}</button>;
}

function Metric({ title, value, tone = "text-black" }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-black/55">{title}</p><p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p></article>;
}

function ReportRow({ report, canVerify, onVerify }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`h-3 w-3 rounded-full ${report.status === "VERIFIED" ? "bg-emerald-500" : report.status === "REJECTED" ? "bg-red-500" : "bg-amber-400"}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{report.description}</p>
        <p className="text-xs text-black/55">{report.districtName || report.district?.name || "Unknown district"} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : "-"}</p>
      </div>
      {canVerify && report.status !== "VERIFIED" && <button onClick={() => onVerify(report.id)} className="inline-flex items-center gap-1 rounded-md bg-safe px-2 py-1 text-xs font-semibold text-white"><CheckCircle size={13} /> Verify</button>}
    </div>
  );
}
