import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Save } from "lucide-react";
import { endpoints } from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { asArray } from "../utils/apiData";

export function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: aois = [] } = useQuery({ queryKey: ["aois"], queryFn: () => endpoints.aois().then((res) => res.data) });
  const { data: summary } = useQuery({ queryKey: ["settings-summary"], queryFn: () => endpoints.dashboardSummary().then((res) => res.data) });
  const districtOptions = asArray(aois).map((aoi) => aoi.name).filter(Boolean);
  const [form, setForm] = useState({ organizationName: "", country: "", defaultDistrict: "", defaultZoom: "9", defaultBasemap: "OpenStreetMap", temperatureUnit: "Celsius" });

  useEffect(() => {
    if (!settings) return;
    setForm((current) => ({
      ...current,
      organizationName: settings.organizationName || current.organizationName,
      country: settings.country || current.country,
      defaultDistrict: settings.general.defaultDistrict || current.defaultDistrict,
      defaultZoom: settings.map.defaultZoom || current.defaultZoom,
      defaultBasemap: settings.map.defaultBasemap || current.defaultBasemap,
      temperatureUnit: settings.general.temperatureUnit || current.temperatureUnit
    }));
  }, [settings]);

  async function saveSettings(event) {
    event.preventDefault();
    await endpoints.updateCurrentSettings({
      organizationName: form.organizationName,
      country: form.country,
      general: { temperatureUnit: form.temperatureUnit, defaultDistrict: form.defaultDistrict },
      map: { defaultZoom: Number(form.defaultZoom), defaultBasemap: form.defaultBasemap }
    });
    await queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    setStatus("Settings saved.");
  }

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-black/55">{settings?.organizationName || "Platform"} configuration applied across maps, reports, weather, and navigation.</p>
      </div>

      <div className="flex gap-2 rounded-lg border border-black/10 bg-white p-1 shadow-sm">
        <Tab active={tab === "general"} onClick={() => setTab("general")}>General Settings</Tab>
        <Tab active={tab === "map"} onClick={() => setTab("map")}>Map Settings</Tab>
        <Tab active={tab === "notifications"} onClick={() => setTab("notifications")}>Notifications</Tab>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <form onSubmit={saveSettings} className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">{tab === "general" ? "General Settings" : tab === "map" ? "Map Settings" : "Notification Settings"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input label="Organization Name" value={form.organizationName} onChange={(organizationName) => setForm({ ...form, organizationName })} />
            <Input label="Country" value={form.country} onChange={(country) => setForm({ ...form, country })} />
            <label className="block text-sm">
              <span className="mb-1 block text-black/60">Default District</span>
              <select className="w-full rounded-md border border-black/15 px-3 py-2" value={form.defaultDistrict} onChange={(event) => setForm({ ...form, defaultDistrict: event.target.value })}>
                {districtOptions.length ? districtOptions.map((name) => <option key={name} value={name}>{name}</option>) : <option value="">No districts available</option>}
              </select>
            </label>
            <Input label="Default Map Zoom" value={form.defaultZoom} onChange={(defaultZoom) => setForm({ ...form, defaultZoom })} />
            <label className="block text-sm">
              <span className="mb-1 block text-black/60">Default Basemap</span>
              <select className="w-full rounded-md border border-black/15 px-3 py-2" value={form.defaultBasemap} onChange={(event) => setForm({ ...form, defaultBasemap: event.target.value })}>
                <option>OpenStreetMap</option>
                <option>Satellite</option>
                <option>Terrain</option>
                <option>Dark Map</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-black/60">Temperature Unit</span>
              <select className="w-full rounded-md border border-black/15 px-3 py-2" value={form.temperatureUnit} onChange={(event) => setForm({ ...form, temperatureUnit: event.target.value })}>
                <option>Celsius</option>
                <option>Fahrenheit</option>
              </select>
            </label>
          </div>
          {status && <p className="mt-4 text-sm text-emerald-700">{status}</p>}
          <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Save size={15} /> Save Changes</button>
        </form>

        <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold">System Information</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Info label="Platform Version" value={import.meta.env.VITE_APP_VERSION || "0.1.0"} ok />
            <Info label="Organization" value={settings?.organizationName || "-"} ok />
            <Info label="Default District" value={settings?.general?.defaultDistrict || "-"} />
            <Info label="Map Defaults" value={`${settings?.map?.defaultBasemap || "OpenStreetMap"} · Zoom ${settings?.map?.defaultZoom || 9}`} />
            <Info label="Temperature Unit" value={settings?.general?.temperatureUnit || "Celsius"} />
            <Info label="Water Sources" value={summary?.waterSources?.total ?? 0} ok />
            <Info label="Sensors Online" value={summary?.sensors?.online ?? 0} ok />
            <Info label="Active Alerts" value={summary?.activeAlerts ?? 0} />
            <Info label="Tenant Slug" value={settings?.slug || "-"} />
          </div>
        </section>
      </div>
    </section>
  );
}

function Tab({ active, onClick, children }) {
  return <button onClick={onClick} className={`rounded-md px-4 py-2 text-sm font-semibold ${active ? "bg-emerald-700 text-white" : "text-black/65 hover:bg-black/[0.03]"}`}>{children}</button>;
}

function Input({ label, value, onChange }) {
  return <label className="block text-sm"><span className="mb-1 block text-black/60">{label}</span><input className="w-full rounded-md border border-black/15 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Info({ label, value, ok = false }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-black/60">{label}</span><span className="inline-flex items-center gap-2 font-semibold">{ok && <CheckCircle size={14} className="text-emerald-600" />}{value}</span></div>;
}
