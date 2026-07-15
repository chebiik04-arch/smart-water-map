import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, Pencil, Plus, Search, X } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Pagination, usePagination } from "../components/Pagination";
import { endpoints } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { asArray, featuresToProperties } from "../utils/apiData";
import { matchDistrictForAoi, useAoiSelection } from "../hooks/useAoiSelection";

const selectedDistrictStorageKey = "smart-water-map-selected-district";
const selectedDistrictEventName = "smart-water-map:district-change";
const emptyFeatureCollection = { type: "FeatureCollection", features: [] };

const sourceTypes = ["BOREHOLE", "WATER_POINT", "RIVER", "RESERVOIR"];
const sourceStatuses = ["ACTIVE", "DRY", "UNDER_REPAIR", "ABANDONED"];
const statusTone = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DRY: "bg-red-100 text-red-700",
  UNDER_REPAIR: "bg-amber-100 text-amber-700",
  ABANDONED: "bg-gray-100 text-gray-700"
};

const typeLabels = {
  BOREHOLE: "Borehole",
  WATER_POINT: "Water Point",
  RIVER: "River",
  RESERVOIR: "Reservoir"
};

export function WaterSources() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [selectedDistrictId, setSelectedDistrictId] = useState(() => localStorage.getItem(selectedDistrictStorageKey) || "");
  const { aois, selectedAoiId, selectedAoi, selectedAoiName, updateSelectedAoi } = useAoiSelection();
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [form, setForm] = useState(() => defaultForm(selectedDistrictId));
  const [formError, setFormError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const canAdd = ["admin", "field_agent"].includes(user?.role);

  const { data: districts = emptyFeatureCollection } = useQuery({
    queryKey: ["water-source-districts"],
    queryFn: () => endpoints.districts().then((res) => res.data)
  });
  const districtFeatures = asArray(districts.features);
  const districtId = matchDistrictForAoi(districtFeatures, selectedAoi, selectedDistrictId);

  useEffect(() => {
    if (selectedDistrictId || !districtFeatures.length) return;
    updateSelectedDistrict(districtFeatures[0].id);
  }, [districtFeatures, selectedDistrictId]);

  const selectedDistrict = districtFeatures.find((feature) => feature.id === districtId);
  const selectedDistrictName = selectedAoiName || selectedDistrict?.properties?.name || "Selected region";
  const selectedCenter = featureCenter(selectedDistrict);

  const { data, isLoading } = useQuery({
    queryKey: ["water-sources-page", districtId, filters.type, filters.status],
    queryFn: () => endpoints.waterSources({
      districtId,
      type: filters.type || undefined,
      status: filters.status || undefined
    }).then((res) => res.data),
    enabled: Boolean(districtId)
  });

  const rows = useMemo(() => {
    return featuresToProperties(data)
      .filter((source) => (source.name || "").toLowerCase().includes(filters.search.toLowerCase()));
  }, [data, filters.search]);

  const sourceRows = rows.filter((source) => source.type !== "WATER_POINT");
  const waterPointRows = rows.filter((source) => source.type === "WATER_POINT");
  const active = rows.filter((source) => source.status === "ACTIVE").length;
  const inactive = rows.filter((source) => ["DRY", "ABANDONED"].includes(source.status)).length;
  const maintenance = rows.filter((source) => source.status === "UNDER_REPAIR").length;
  const distribution = [
    { name: "Boreholes", value: rows.filter((source) => source.type === "BOREHOLE").length, color: "#16A34A" },
    { name: "Rivers", value: rows.filter((source) => source.type === "RIVER").length, color: "#2D8CFF" },
    { name: "Reservoirs", value: rows.filter((source) => source.type === "RESERVOIR").length, color: "#F59E0B" },
    { name: "Water Points", value: waterPointRows.length, color: "#8B5CF6" }
  ];

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const sourceRes = payload.id
        ? await endpoints.updateWaterSource(payload.id, payload.source)
        : await endpoints.createWaterSource(payload.source);
      if (payload.initialWaterLevel !== "") {
        await endpoints.createWaterSourceReading(payload.id || sourceRes.data.id, { waterLevel: Number(payload.initialWaterLevel) });
      }
      return sourceRes.data;
    },
    onSuccess: async (_saved, payload) => {
      await queryClient.invalidateQueries({ queryKey: ["water-sources-page"] });
      await queryClient.invalidateQueries({ queryKey: ["water-map-sources"] });
      setModalOpen(false);
      setEditingSource(null);
      setSelected(null);
      setForm(defaultForm(districtId, selectedCenter));
      setFormError("");
      setSaveStatus(`${payload.id ? "Updated" : "Added"} ${typeLabels[payload.source.type] || "water source"} successfully.`);
    },
    onError: (error) => {
      const message = error.response?.data?.error || "Unable to save water source.";
      setFormError(message);
      setSaveStatus(message);
    }
  });

  function updateSelectedDistrict(districtId) {
    setSelectedDistrictId(districtId);
    localStorage.setItem(selectedDistrictStorageKey, districtId);
    window.dispatchEvent(new CustomEvent(selectedDistrictEventName, { detail: { districtId } }));
    setSelected(null);
    setForm((current) => ({ ...current, districtId }));
    setSaveStatus("");
  }

  function openCreate(type = "BOREHOLE") {
    setEditingSource(null);
    setForm(defaultForm(districtId, selectedCenter, type));
    setFormError("");
    setSaveStatus("");
    setModalOpen(true);
  }

  function openEdit(source) {
    setSelected(source);
    setEditingSource(source);
    setForm(formFromSource(source, districtId));
    setFormError("");
    setSaveStatus("");
    setModalOpen(true);
  }

  function submitSource(event) {
    event.preventDefault();
    setFormError("");
    const source = {
      name: form.name.trim(),
      type: form.type,
      districtId: form.districtId,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      status: form.status,
      depth: form.depth === "" ? undefined : Number(form.depth),
      yield: form.yield === "" ? undefined : Number(form.yield),
      lastInspected: form.lastInspected ? new Date(form.lastInspected).toISOString() : undefined,
      inspectionNotes: form.inspectionNotes.trim()
    };
    if (!source.name || !source.districtId || !Number.isFinite(source.latitude) || !Number.isFinite(source.longitude)) {
      setFormError("Name, county, latitude, and longitude are required.");
      return;
    }
    const payloadSource = editingSource ? omit(source, ["districtId"]) : source;
    saveMutation.mutate({ id: editingSource?.id, source: payloadSource, initialWaterLevel: form.initialWaterLevel });
  }

  return (
    <section className="space-y-4 bg-[#F5F7F2] p-4 text-[#17201d] lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Water Sources</h1>
          <p className="mt-1 text-sm text-black/55">All water infrastructure - {selectedDistrictName}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block w-64 text-xs font-semibold text-black/60">
            Region or county
            <select className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black" value={selectedAoiId} onChange={(event) => updateSelectedAoi(event.target.value)}>
              {aois.map((aoi) => <option key={aoi.id} value={aoi.id}>{aoi.name}</option>)}
            </select>
          </label>
          {canAdd && <button type="button" onClick={() => openCreate("BOREHOLE")} className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={16} /> Add Source</button>}
        </div>
      </div>

      {saveStatus && (
        <div className={`rounded-md border px-4 py-3 text-sm font-medium ${saveStatus.startsWith("Unable") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {saveStatus}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard value={rows.length} label="Total Sources" tone="text-emerald-600" />
        <SummaryCard value={active} label="Active" tone="text-emerald-600" />
        <SummaryCard value={inactive} label="Inactive / Dry" tone="text-red-600" />
        <SummaryCard value={maintenance} label="Under Maintenance" tone="text-amber-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[19rem_1fr]">
        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">Source Distribution</h2>
          <div className="relative mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                  {distribution.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-black/60">
            {distribution.map((item) => <span key={item.name} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span>)}
          </div>
        </section>

        <SourceTable
          title="All Water Sources"
          rows={sourceRows}
          loading={isLoading}
          onSelect={setSelected}
          onEdit={canAdd ? openEdit : null}
          selected={selected}
          action={canAdd ? () => openCreate("BOREHOLE") : null}
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-4">
          <div className="flex items-center gap-2">
            <Droplet size={17} className="text-blue-600" />
            <h2 className="text-sm font-bold">All Water Points</h2>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <MiniStat value={waterPointRows.length} label="Total" />
            <MiniStat value={waterPointRows.filter((item) => item.status === "ACTIVE").length} label="Active" />
            <MiniStat value={waterPointRows.filter((item) => ["DRY", "ABANDONED"].includes(item.status)).length} label="Inactive" />
            <MiniStat value={waterPointRows.filter((item) => item.status === "UNDER_REPAIR").length} label="Maintenance" />
            {canAdd && <button type="button" onClick={() => openCreate("WATER_POINT")} className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus size={13} /> Add Water Point</button>}
          </div>
        </div>
        <WaterPointTable rows={waterPointRows} loading={isLoading} onSelect={setSelected} onEdit={canAdd ? openEdit : null} selected={selected} />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 text-black/35" size={16} />
            <input className="w-full rounded-md border border-black/10 pl-9 pr-3 py-2 text-sm" placeholder="Search sources or water points" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">All types</option>{sourceTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
          </select>
          <select className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option>{sourceStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </div>
      </section>

      {modalOpen && (
        <SourceModal
          form={form}
          setForm={setForm}
          districts={districtFeatures}
          mode={editingSource ? "edit" : "create"}
          error={formError}
          saving={saveMutation.isPending}
          onClose={() => {
            setModalOpen(false);
            setEditingSource(null);
          }}
          onSubmit={submitSource}
        />
      )}
    </section>
  );
}

function SourceTable({ title, rows, loading, selected, onSelect, onEdit, action }) {
  const pagination = usePagination(rows, 8);
  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 p-4">
        <div className="flex items-center gap-2">
          <Droplet size={17} className="text-emerald-600" />
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-black/50">
          <span>{rows.length} records</span>
          {action && <button type="button" onClick={action} className="font-semibold text-emerald-700">Add</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#F7FBF9] text-xs uppercase text-black/50"><tr><th className="p-3">ID</th><th>Name</th><th>Type</th><th>Location</th><th>Depth</th><th>Water Level</th><th>Yield</th><th>Inspection Notes</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {pagination.pageRows.map((source) => <SourceRow key={source.id || source.name} source={source} selected={selected?.id === source.id} onClick={() => onSelect(source)} onEdit={onEdit} />)}
            {!rows.length && <EmptyRow colSpan={10} message={loading ? "Loading water sources..." : "No water sources returned by the backend."} />}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} />
    </section>
  );
}

function WaterPointTable({ rows, loading, selected, onSelect, onEdit }) {
  const pagination = usePagination(rows, 8);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#F7FBF9] text-xs uppercase text-black/50"><tr><th className="p-3">ID</th><th>Name</th><th>Type</th><th>Location</th><th>Capacity</th><th>Water Level</th><th>Inspection Notes</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {pagination.pageRows.map((source) => (
              <tr key={source.id || source.name} onClick={() => onSelect(source)} className={`cursor-pointer border-t border-black/10 hover:bg-emerald-50/60 ${selected?.id === source.id ? "bg-emerald-50" : ""}`}>
                <td className="p-3 text-xs text-black/55">{shortId(source.id)}</td>
                <td className="font-semibold">{source.name}</td>
                <td>{typeLabels[source.type] || source.type}</td>
                <td>{source.districtName || "-"}</td>
                <td>{source.yield ? `${source.yield.toLocaleString()} L/hr` : "-"}</td>
                <td><WaterLevel value={source.latestLevel} /></td>
                <td className="max-w-56 truncate text-black/60">{source.inspectionNotes || "-"}</td>
                <td><StatusBadge status={source.status} /></td>
                <td>
                  {onEdit && <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(source); }} className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold hover:bg-black/5"><Pencil size={12} /> Edit</button>}
                </td>
              </tr>
            ))}
            {!rows.length && <EmptyRow colSpan={9} message={loading ? "Loading water points..." : "No water points returned by the backend."} />}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} />
    </>
  );
}

function SourceRow({ source, selected, onClick, onEdit }) {
  return (
    <tr onClick={onClick} className={`cursor-pointer border-t border-black/10 hover:bg-emerald-50/60 ${selected ? "bg-emerald-50" : ""}`}>
      <td className="p-3 text-xs text-black/55">{shortId(source.id)}</td>
      <td className="font-semibold">{source.name}</td>
      <td>{typeLabels[source.type] || source.type}</td>
      <td>{source.districtName || "-"}</td>
      <td>{source.depth ? `${source.depth}m` : "-"}</td>
      <td><WaterLevel value={source.latestLevel} /></td>
      <td>{source.yield ? `${source.yield.toLocaleString()} L/hr` : "-"}</td>
      <td className="max-w-56 truncate text-black/60">{source.inspectionNotes || "-"}</td>
      <td><StatusBadge status={source.status} /></td>
      <td>
        {onEdit && <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(source); }} className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs font-semibold hover:bg-black/5"><Pencil size={12} /> Edit</button>}
      </td>
    </tr>
  );
}

function SourceModal({ form, setForm, districts, mode, error, saving, onClose, onSubmit }) {
  const editing = mode === "edit";
  return (
    <div className="fixed inset-0 z-[800] grid place-items-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="font-bold">{editing ? "Update" : "Add"} {form.type === "WATER_POINT" ? "Water Point" : "Water Source"}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name"><input required className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Type"><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{sourceTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></Field>
          <Field label="County"><select className="input" value={form.districtId} onChange={(event) => setForm({ ...form, districtId: event.target.value })}>{districts.map((feature) => <option key={feature.id} value={feature.id}>{feature.properties?.name || feature.id}</option>)}</select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{sourceStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></Field>
          <Field label="Latitude"><input required className="input" type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></Field>
          <Field label="Longitude"><input required className="input" type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></Field>
          <Field label="Depth (m)"><input className="input" type="number" step="any" value={form.depth} onChange={(event) => setForm({ ...form, depth: event.target.value })} /></Field>
          <Field label="Yield / Capacity"><input className="input" type="number" step="any" value={form.yield} onChange={(event) => setForm({ ...form, yield: event.target.value })} /></Field>
          <Field label="Initial water level"><input className="input" type="number" step="any" value={form.initialWaterLevel} onChange={(event) => setForm({ ...form, initialWaterLevel: event.target.value })} /></Field>
          <Field label="Last inspected"><input className="input" type="datetime-local" value={form.lastInspected} onChange={(event) => setForm({ ...form, lastInspected: event.target.value })} /></Field>
          <label className="block text-sm font-semibold text-black/65 sm:col-span-2">
            Inspection notes
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-black/10 px-3 py-2 text-sm" value={form.inspectionNotes} onChange={(event) => setForm({ ...form, inspectionNotes: event.target.value })} placeholder="Add inspection findings, repairs needed, access notes, or field observations." />
          </label>
        </div>
        {error && <p className="px-5 pb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5">Cancel</button>
          <button disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? "Saving..." : editing ? "Update Source" : "Save Source"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block text-sm font-semibold text-black/65">{label}<div className="mt-1 [&_.input]:w-full [&_.input]:rounded-md [&_.input]:border [&_.input]:border-black/10 [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm">{children}</div></label>;
}

function SummaryCard({ value, label, tone }) {
  return <article className="rounded-lg border border-black/10 bg-white p-4 text-center shadow-sm"><p className={`text-2xl font-bold ${tone}`}>{value}</p><p className="mt-1 text-xs text-black/60">{label}</p></article>;
}

function MiniStat({ value, label }) {
  return <span className="text-center"><strong className="block text-sm">{value}</strong><span className="text-[11px] text-black/50">{label}</span></span>;
}

function WaterLevel({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = pct <= 20 ? "bg-red-500" : pct <= 50 ? "bg-amber-500" : "bg-emerald-500";
  return <span className="flex items-center gap-2"><span className="h-1.5 w-16 rounded bg-black/10"><span className={`block h-full rounded ${color}`} style={{ width: `${pct}%` }} /></span><span className="text-xs text-black/60">{Number.isFinite(pct) ? `${pct}%` : "-"}</span></span>;
}

function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[status] || statusTone.ACTIVE}`}>{statusLabel(status)}</span>;
}

function EmptyRow({ colSpan, message }) {
  return <tr><td colSpan={colSpan} className="p-6 text-center text-sm text-black/50">{message}</td></tr>;
}

function shortId(id) {
  return id ? `WS-${String(id).slice(0, 4).toUpperCase()}` : "-";
}

function statusLabel(status) {
  return String(status || "").replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function defaultForm(districtId, center = null, type = "BOREHOLE") {
  return {
    name: "",
    type,
    districtId: districtId || "",
    status: "ACTIVE",
    latitude: center?.[0] ? String(center[0].toFixed(5)) : "",
    longitude: center?.[1] ? String(center[1].toFixed(5)) : "",
    depth: "",
    yield: "",
    initialWaterLevel: "",
    lastInspected: "",
    inspectionNotes: ""
  };
}

function formFromSource(source, districtId) {
  const position = geoJsonPointToLatLng(source.geometry);
  return {
    name: source.name || "",
    type: source.type || "BOREHOLE",
    districtId: source.districtId || districtId || "",
    status: source.status || "ACTIVE",
    latitude: position?.[0] ? String(position[0]) : "",
    longitude: position?.[1] ? String(position[1]) : "",
    depth: source.depth ?? "",
    yield: source.yield ?? "",
    initialWaterLevel: "",
    lastInspected: toDateTimeLocal(source.lastInspected),
    inspectionNotes: source.inspectionNotes || ""
  };
}

function omit(source, keys) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
}

function geoJsonPointToLatLng(geometry) {
  if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  return [Number(geometry.coordinates[1]), Number(geometry.coordinates[0])];
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function featureCenter(feature) {
  const coordinates = feature?.geometry?.coordinates?.[0];
  if (!Array.isArray(coordinates) || !coordinates.length) return null;
  const totals = coordinates.reduce((acc, coordinate) => {
    acc.lng += Number(coordinate[0]) || 0;
    acc.lat += Number(coordinate[1]) || 0;
    return acc;
  }, { lat: 0, lng: 0 });
  return [totals.lat / coordinates.length, totals.lng / coordinates.length];
}
