import { useEffect, useMemo, useState } from "react";
import { Award, Camera, CheckCircle, CloudOff, MapPin, RotateCw, Wifi } from "lucide-react";
import { endpoints } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { useLanguageStore } from "../stores/languageStore";
import { compressPhoto, getGpsPosition } from "../utils/photoEvidence";
import { getQueuedReports, queueReport, syncQueuedReports } from "../utils/offlineReports";

const initialForm = {
  districtId: "",
  latitude: "",
  longitude: "",
  waterLevel: "",
  description: "",
  photoUrl: "",
  gpsAccuracyMeters: "",
  photoMetadata: null
};

export function ReportsPage() {
  const { t } = useLanguageStore();
  const user = useAuthStore((state) => state.user);
  const [reports, setReports] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState("");

  const canVerify = useMemo(() => ["admin", "field_agent"].includes(user?.role), [user]);

  useEffect(() => {
    refreshData();
    refreshQueue();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function refreshData() {
    const [reportRes, leaderboardRes, districtRes] = await Promise.all([
      endpoints.communityReports(),
      endpoints.leaderboard(),
      endpoints.districts()
    ]);
    setReports(reportRes.data);
    setLeaderboard(leaderboardRes.data);
    setDistricts(districtRes.data.features.map((feature) => ({ id: feature.id, name: feature.properties.name })));
  }

  async function refreshQueue() {
    const queued = await getQueuedReports();
    setQueuedCount(queued.length);
  }

  async function captureGps() {
    const position = await getGpsPosition();
    setForm((current) => ({
      ...current,
      latitude: String(Number(position.coords.latitude.toFixed(6))),
      longitude: String(Number(position.coords.longitude.toFixed(6))),
      gpsAccuracyMeters: String(Math.round(position.coords.accuracy))
    }));
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const compressed = await compressPhoto(file);
    setForm((current) => ({
      ...current,
      photoUrl: compressed,
      photoMetadata: {
        originalName: file.name,
        originalBytes: file.size,
        compressedBytes: compressed.length,
        gpsTagged: Boolean(current.latitude && current.longitude),
        capturedAt: new Date().toISOString()
      }
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      districtId: form.districtId || undefined,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      waterLevel: Number(form.waterLevel),
      description: form.description,
      photoUrl: form.photoUrl || undefined,
      gpsAccuracyMeters: form.gpsAccuracyMeters ? Number(form.gpsAccuracyMeters) : undefined,
      photoMetadata: form.photoMetadata || undefined
    };

    try {
      if (navigator.onLine) {
        await endpoints.communityReport(payload);
        setStatus("Report submitted.");
        setForm(initialForm);
        await refreshData();
      } else {
        await queueReport(payload);
        setStatus("Report queued for sync.");
        setForm(initialForm);
        await refreshQueue();
      }
    } catch {
      await queueReport(payload);
      setStatus("Connection failed. Report saved offline.");
      await refreshQueue();
    }
  }

  async function handleSync() {
    try {
      const synced = await syncQueuedReports();
      if (synced.length) {
        setStatus(`${synced.length} report(s) synced.`);
        await refreshData();
      }
      await refreshQueue();
    } catch {
      setStatus("Sync is waiting for a stable connection.");
    }
  }

  async function verifyReport(id) {
    await endpoints.verifyReport(id);
    await refreshData();
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("reports")}</h1>
          <p className="text-sm text-black/60">{t("offlineReady")}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill online={isOnline} label={isOnline ? t("online") : t("offline")} />
          <button onClick={handleSync} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white">
            <RotateCw size={16} /> {t("syncQueued")} ({queuedCount})
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-black/10 bg-white p-4 shadow-panel">
          <select className="w-full rounded-md border border-black/15 px-3 py-2" value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })}>
            <option value="">District</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
            <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
          </div>
          <button type="button" onClick={captureGps} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm">
            <MapPin size={16} /> {t("gps")} {form.gpsAccuracyMeters && `±${form.gpsAccuracyMeters}m`}
          </button>
          <input className="w-full rounded-md border border-black/15 px-3 py-2" type="number" placeholder={t("waterLevel")} value={form.waterLevel} onChange={(e) => setForm({ ...form, waterLevel: e.target.value })} required />
          <textarea className="min-h-24 w-full rounded-md border border-black/15 px-3 py-2" placeholder={t("description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary">
            <Camera size={16} /> {t("capturePhoto")}
            <input className="hidden" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
          </label>
          {form.photoUrl && <img src={form.photoUrl} alt="Compressed evidence preview" className="h-36 w-full rounded-md object-cover" />}
          {status && <p className="text-sm text-primary">{status}</p>}
          <button className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white" type="submit">{t("submitReport")}</button>
        </form>

        <div className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2 text-primary"><Award size={18} /><h2 className="font-semibold">{t("leaderboard")}</h2></div>
            <div className="grid gap-2 md:grid-cols-3">
              {leaderboard.slice(0, 6).map((member, index) => (
                <div key={member.id} className="rounded-md bg-background p-3">
                  <p className="text-xs text-black/55">#{index + 1} · {member.role}</p>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-sm text-primary">{member.points} pts</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel">
            <table className="w-full text-left text-sm">
              <thead className="bg-background">
                <tr><th className="p-3">Reporter</th><th>{t("waterLevel")}</th><th>{t("source")}</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-t border-black/10">
                    <td className="p-3"><p className="font-medium">{report.userName || report.externalReporterPhone}</p><p className="text-xs text-black/55">{report.districtName}</p></td>
                    <td>{report.waterLevel}</td>
                    <td>{report.source}</td>
                    <td>{report.status}</td>
                    <td className="p-3 text-right">{canVerify && report.status !== "VERIFIED" && <button onClick={() => verifyReport(report.id)} className="inline-flex items-center gap-1 rounded-md bg-safe px-2 py-1 text-xs font-semibold text-white"><CheckCircle size={13} /> {t("verify")}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusPill({ online, label }) {
  const Icon = online ? Wifi : CloudOff;
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${online ? "bg-safe/15 text-safe" : "bg-danger/15 text-danger"}`}><Icon size={16} /> {label}</span>;
}
