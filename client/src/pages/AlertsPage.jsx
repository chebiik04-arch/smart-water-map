import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Filter, Info, Smartphone } from "lucide-react";
import { endpoints } from "../services/api";
import { apiErrorMessage, asArray, asFeatureCollection } from "../utils/apiData";
import { Pagination, usePagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/ApiState";

const filters = ["All", "High", "Medium", "Low"];

export function AlertsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["alerts-page"],
    queryFn: () => endpoints.alerts({ limit: 50, status: "ACTIVE" }).then((res) => res.data)
  });
  const { data: districts } = useQuery({ queryKey: ["alerts-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const rows = useMemo(() => normalizeAlerts(asArray(data)), [data]);
  const districtName = asFeatureCollection(districts).features[0]?.properties?.name || "Selected area";
  const counts = countByPriority(rows);
  const visibleRows = activeFilter === "All" ? rows : rows.filter((alert) => alert.priority === activeFilter);
  const alertsPagination = usePagination(visibleRows, 6);

  return (
    <section className="space-y-5 bg-[#EFF4F0] p-4 text-[#17201d] lg:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">Early Warning System</h1>
          <p className="mt-1 text-sm font-medium text-black/55">Drought alerts and recommended actions - {districtName}, Kenya</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          {counts.High} Critical
        </span>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <PriorityMetric label="High Priority" value={counts.High} className="border-red-200 bg-red-50 text-red-600" />
        <PriorityMetric label="Medium Priority" value={counts.Medium} className="border-orange-200 bg-orange-50 text-orange-600" />
        <PriorityMetric label="Low Priority" value={counts.Low} className="border-blue-200 bg-blue-50 text-blue-600" />
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Notification Settings</h2>
          <Bell size={16} className="text-black/35" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleRow icon={Smartphone} label="SMS Alerts" checked={smsEnabled} onChange={() => setSmsEnabled((current) => !current)} />
          <ToggleRow icon={Bell} label="Push Notifications" checked={pushEnabled} onChange={() => setPushEnabled((current) => !current)} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-black/45" />
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${activeFilter === filter ? "bg-emerald-600 text-white" : "bg-white text-black/65 hover:bg-black/[0.04]"}`}
          >
            {filter} ({filter === "All" ? rows.length : counts[filter]})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {alertsPagination.pageRows.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        {isLoading && <LoadingState message="Loading active alerts." />}
        {isError && <ErrorState message={apiErrorMessage(error, "Unable to load alerts.")} onRetry={refetch} />}
        {!isLoading && !isError && !visibleRows.length && <EmptyState title="No active alerts" message="No active alerts were returned for this view." />}
      </div>
      {alertsPagination.total > alertsPagination.pageSize && (
        <div className="overflow-hidden rounded-xl border border-black/10 shadow-sm">
          <Pagination pagination={alertsPagination} />
        </div>
      )}
    </section>
  );
}

function PriorityMetric({ label, value, className }) {
  return (
    <article className={`rounded-xl border p-5 text-center shadow-sm ${className}`}>
      <p className="text-3xl font-extrabold leading-none">{value}</p>
      <p className="mt-2 text-sm font-semibold text-black/65">{label}</p>
    </article>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-3 text-sm font-semibold text-black/65">
        <Icon size={16} className="text-black/35" />
        {label}
      </span>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-emerald-500" : "bg-black/15"}`}
        aria-pressed={checked}
        aria-label={label}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function AlertCard({ alert }) {
  const high = alert.priority === "High";
  const medium = alert.priority === "Medium";
  const border = high ? "border-red-200 bg-red-50" : medium ? "border-orange-200 bg-orange-50" : "border-blue-200 bg-blue-50";
  const badge = high ? "bg-red-100 text-red-600" : medium ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
  const iconTone = high ? "text-red-500" : medium ? "text-orange-500" : "text-blue-500";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${border}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-sm">
          {high ? <AlertTriangle size={16} className={iconTone} /> : <Info size={16} className={iconTone} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-black/75">{alert.title}</h2>
              <p className="mt-1 text-sm font-medium text-black/65">{alert.message}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${badge}`}>{alert.priority}</span>
          </div>
          <p className="mt-3 text-xs font-semibold text-black/45">{alert.location} · {alert.time}</p>
          <div className="mt-4 rounded-lg border border-black/5 bg-white p-3 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-bold text-black/55">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Recommended Action
            </p>
            <p className="mt-1 text-sm font-medium text-black/75">{alert.recommendation}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function normalizeAlerts(rows) {
  if (!rows.length) return fallbackAlerts();
  return rows.map((alert, index) => {
    const priority = priorityFor(alert.severity);
    return {
      id: alert.id || index,
      priority,
      title: titleFor(alert),
      message: alert.message || "Active drought warning requires field follow-up.",
      location: alert.subDistrict || alert.district?.name || "Selected area",
      time: relativeAlertTime(alert.triggeredAt || alert.createdAt),
      recommendation: recommendationFor(alert, priority)
    };
  });
}

function countByPriority(rows) {
  return {
    High: rows.filter((alert) => alert.priority === "High").length,
    Medium: rows.filter((alert) => alert.priority === "Medium").length,
    Low: rows.filter((alert) => alert.priority === "Low").length
  };
}

function priorityFor(severity) {
  if (severity === "EMERGENCY" || severity === "CRITICAL") return "High";
  if (severity === "WARNING" || severity === "HIGH") return "Medium";
  return "Low";
}

function titleFor(alert) {
  if (alert.title) return alert.title;
  if (alert.alertType === "RAINFALL_DEFICIT") return "No Rainfall Forecast";
  if (alert.alertType === "LOW_WATER_LEVELS") return "Critical Drought Risk";
  if (alert.alertType === "COMMUNITY_REPORT") return "Community Water Report";
  return "Drought Alert";
}

function recommendationFor(alert, priority) {
  if (alert.recommendation) return alert.recommendation;
  if (alert.alertType === "RAINFALL_DEFICIT") return "Prepare water conservation measures and notify registered farmers.";
  if (alert.alertType === "LOW_WATER_LEVELS") return "Reduce irrigation and deploy emergency water reserves.";
  if (priority === "High") return "Dispatch field team and activate emergency response protocol.";
  if (priority === "Medium") return "Schedule field verification and notify local response officers.";
  return "Monitor conditions and keep affected communities informed.";
}

function relativeAlertTime(value) {
  if (!value) return "recently";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "recently";
  const hours = Math.max(1, Math.round((Date.now() - then) / 36e5));
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function fallbackAlerts() {
  return [
    {
      id: "fallback-critical",
      priority: "High",
      title: "Critical Drought Risk - Kibwezi Sub-county",
      message: "Groundwater level dropped below 18%. Immediate intervention required.",
      location: "Kibwezi",
      time: "2 hours ago",
      recommendation: "Reduce irrigation by 40% and deploy emergency water reserves."
    },
    {
      id: "fallback-rainfall",
      priority: "High",
      title: "No Rainfall Forecast - Next 14 Days",
      message: "Weather models predict continued dry conditions across southern Makueni.",
      location: "Makindu",
      time: "3 hours ago",
      recommendation: "Prepare water conservation measures and notify registered farmers."
    },
    {
      id: "fallback-borehole",
      priority: "Medium",
      title: "Borehole Pump Failure - Mtito Andei",
      message: "MT-BH-04 pump offline. 320 households affected.",
      location: "Mtito Andei",
      time: "5 hours ago",
      recommendation: "Schedule emergency maintenance within 24 hours."
    },
    {
      id: "fallback-soil",
      priority: "Medium",
      title: "Soil Moisture Declining - Sultan Hamud",
      message: "Soil moisture at 24%. Monitor closely for next 48 hours.",
      location: "Sultan Hamud",
      time: "1 day ago",
      recommendation: "Switch affected farms to drought-resistant crop varieties."
    }
  ];
}
