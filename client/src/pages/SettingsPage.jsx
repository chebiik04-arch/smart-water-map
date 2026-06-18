import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Save } from "lucide-react";
import { endpoints } from "../services/api";
import { asArray } from "../utils/apiData";

export function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [status, setStatus] = useState("");
  const { data: tenants, refetch: refetchTenants } = useQuery({ queryKey: ["settings-tenants"], queryFn: () => endpoints.tenants().then((res) => res.data) });
  const { data: districts } = useQuery({ queryKey: ["settings-districts"], queryFn: () => endpoints.districts().then((res) => res.data) });
  const { data: summary } = useQuery({ queryKey: ["settings-summary"], queryFn: () => endpoints.dashboardSummary().then((res) => res.data) });
  const tenant = asArray(tenants)[0];
  const district = asArray(districts?.features)[0];
  const [form, setForm] = useState({ organizationName: "", country: "", defaultDistrict: "", defaultZoom: "9", temperatureUnit: "Celsius" });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      organizationName: tenant?.name || current.organizationName,
      country: tenant?.country || current.country,
      defaultDistrict: district?.properties?.name || current.defaultDistrict,
      defaultZoom: tenant?.config?.map?.defaultZoom || current.defaultZoom,
      temperatureUnit: tenant?.config?.general?.temperatureUnit || current.temperatureUnit
    }));
  }, [tenant?.id, district?.id]);

  async function saveSettings(event) {
    event.preventDefault();
    if (tenant?.id) {
      await endpoints.updateTenant(tenant.id, {
        name: form.organizationName,
        country: form.country,
        config: {
          ...(tenant.config || {}),
          general: { ...((tenant.config || {}).general || {}), temperatureUnit: form.temperatureUnit, defaultDistrict: form.defaultDistrict },
          map: { ...((tenant.config || {}).map || {}), defaultZoom: Number(form.defaultZoom) }
        }
      });
      await refetchTenants();
    }
    setStatus("Settings saved.");
  }

  return (
    <section className="space-y-4 p-4 lg:p-5">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-black/55">{tenant?.name || "Platform"} configuration</p>
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
            <Input label="Default District" value={form.defaultDistrict} onChange={(defaultDistrict) => setForm({ ...form, defaultDistrict })} />
            <Input label="Default Map Zoom" value={form.defaultZoom} onChange={(defaultZoom) => setForm({ ...form, defaultZoom })} />
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
            <Info label="Default District" value={district?.properties?.name || "-"} />
            <Info label="Water Sources" value={summary?.waterSources?.total ?? 0} ok />
            <Info label="Sensors Online" value={summary?.sensors?.online ?? 0} ok />
            <Info label="Active Alerts" value={summary?.activeAlerts ?? 0} />
            <Info label="Tenant Slug" value={tenant?.slug || "-"} />
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
