import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Database, Globe2, HardDrive, Mail, Save, Shield, Smartphone, UserRound, Wifi } from "lucide-react";
import { endpoints } from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { useAuthStore } from "../stores/authStore";
import { useLanguageStore } from "../stores/languageStore";
import { languages } from "../i18n/translations";
import { asArray } from "../utils/apiData";

const preferenceStorageKey = "smart-water-map-user-settings";

const defaultPreferences = {
  fullName: "",
  email: "",
  phoneNumber: "",
  jobTitle: "",
  countyRegion: "",
  role: "",
  smsAlerts: true,
  emailAlerts: true,
  pushNotifications: false,
  droughtRiskThreshold: 70,
  lowRainfallThreshold: 20,
  autoBackup: true,
  publicMapAccess: false,
  offlineModeSupport: true
};

export function SettingsPage() {
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(defaultPreferences);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { language, setLanguage } = useLanguageStore();
  const { data: settings } = usePlatformSettings();
  const { data: aois = [] } = useQuery({ queryKey: ["aois"], queryFn: () => endpoints.aois().then((res) => res.data) });
  const districtOptions = asArray(aois).map((aoi) => aoi.name).filter(Boolean);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const saved = readPreferences(user?.id);
    setForm({
      ...defaultPreferences,
      ...saved,
      fullName: saved.fullName || user?.name || "",
      email: saved.email || user?.email || "",
      jobTitle: saved.jobTitle || roleLabel(user?.role),
      countyRegion: saved.countyRegion || user?.district || settings?.general?.defaultDistrict || "",
      role: saved.role || roleLabel(user?.role)
    });
  }, [settings?.general?.defaultDistrict, user]);

  async function saveSettings(event) {
    event.preventDefault();
    setStatus("");
    writePreferences(user?.id, form);
    setLanguage(language);

    if (isAdmin) {
      await endpoints.updateCurrentSettings({
        organizationName: settings?.organizationName || "Smart Water",
        country: settings?.country || "Kenya",
        general: {
          temperatureUnit: settings?.general?.temperatureUnit || "Celsius",
          defaultDistrict: form.countyRegion
        },
        map: {
          defaultZoom: Number(settings?.map?.defaultZoom || 9),
          defaultBasemap: settings?.map?.defaultBasemap || "OpenStreetMap"
        }
      });
      await queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    }

    setStatus(isAdmin ? "Settings saved." : "Personal settings saved.");
  }

  function resetForm() {
    localStorage.removeItem(storageKey(user?.id));
    setForm({
      ...defaultPreferences,
      fullName: user?.name || "",
      email: user?.email || "",
      jobTitle: roleLabel(user?.role),
      countyRegion: user?.district || settings?.general?.defaultDistrict || "",
      role: roleLabel(user?.role)
    });
    setStatus("");
  }

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-[#EFF4F1] px-4 py-5 text-[#26302d] sm:px-6 lg:px-8">
      <div className="max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-normal text-[#17201d]">Settings</h1>
          <p className="mt-1 text-sm font-medium text-black/50">Platform configuration - {settings?.organizationName || "Smart Water Intelligence Platform"}</p>
        </header>

        <form onSubmit={saveSettings} className="space-y-6">
          <SettingsPanel title="Profile & Account" icon={<Shield size={18} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Full Name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
              <TextInput label="Email Address" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              <TextInput label="Phone Number" value={form.phoneNumber} onChange={(phoneNumber) => setForm({ ...form, phoneNumber })} placeholder="+254 712 345 678" />
              <TextInput label="Job Title" value={form.jobTitle} onChange={(jobTitle) => setForm({ ...form, jobTitle })} />
              <SelectInput label="County / Region" value={form.countyRegion} onChange={(countyRegion) => setForm({ ...form, countyRegion })}>
                {districtOptions.length ? districtOptions.map((name) => <option key={name} value={name}>{name}</option>) : <option value={form.countyRegion}>{form.countyRegion || "Selected region"}</option>}
              </SelectInput>
              <SelectInput label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })}>
                <option>County Admin</option>
                <option>Field Agent</option>
                <option>Community User</option>
              </SelectInput>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Notifications" icon={<Bell size={18} />}>
            <div className="overflow-hidden rounded-md bg-white">
              <ToggleRow
                icon={<Smartphone size={17} />}
                title="SMS Alerts"
                description="Receive drought & water alerts via SMS"
                checked={form.smsAlerts}
                onChange={(smsAlerts) => setForm({ ...form, smsAlerts })}
              />
              <ToggleRow
                icon={<Mail size={17} />}
                title="Email Alerts"
                description="Receive daily reports and critical alerts by email"
                checked={form.emailAlerts}
                onChange={(emailAlerts) => setForm({ ...form, emailAlerts })}
              />
              <ToggleRow
                icon={<Bell size={17} />}
                title="Push Notifications"
                description="Browser push notifications for real-time updates"
                checked={form.pushNotifications}
                onChange={(pushNotifications) => setForm({ ...form, pushNotifications })}
                last
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="Alert Thresholds" icon={<Bell size={18} className="text-amber-500" />}>
            <div className="grid gap-6 md:grid-cols-2">
              <RangeControl
                label="Drought Risk Alert (%)"
                value={form.droughtRiskThreshold}
                min={40}
                max={95}
                accent="emerald"
                onChange={(droughtRiskThreshold) => setForm({ ...form, droughtRiskThreshold })}
              />
              <RangeControl
                label="Low Rainfall Alert (mm)"
                value={form.lowRainfallThreshold}
                min={5}
                max={60}
                accent="blue"
                onChange={(lowRainfallThreshold) => setForm({ ...form, lowRainfallThreshold })}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel title="System & Data" icon={<Globe2 size={18} />}>
            <div className="overflow-hidden rounded-md bg-white">
              <ToggleRow
                icon={<Database size={17} />}
                title="Auto Backup"
                description="Automatically back up sensor data every 6 hours"
                checked={form.autoBackup}
                onChange={(autoBackup) => setForm({ ...form, autoBackup })}
              />
              <ToggleRow
                icon={<Globe2 size={17} />}
                title="Public Map Access"
                description="Allow public read-only access to the county water map"
                checked={form.publicMapAccess}
                onChange={(publicMapAccess) => setForm({ ...form, publicMapAccess })}
              />
              <ToggleRow
                icon={<Wifi size={17} />}
                title="Offline Mode Support"
                description="Cache data for offline access in low-connectivity areas"
                checked={form.offlineModeSupport}
                onChange={(offlineModeSupport) => setForm({ ...form, offlineModeSupport })}
                last
              />
            </div>
            <label className="mt-4 block max-w-[9rem] text-xs font-extrabold uppercase tracking-wide text-black/50">
              Interface Language
              <select
                className="mt-2 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold normal-case text-[#26302d] shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
          </SettingsPanel>

          <div className="flex items-center justify-end gap-3 pb-4">
            {status && <p className="mr-auto text-sm font-semibold text-emerald-700">{status}</p>}
            <button type="button" onClick={resetForm} className="rounded-md border border-black/10 bg-white px-6 py-3 text-sm font-bold text-black/60 shadow-sm hover:bg-black/[0.02]">Cancel</button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-[#05B957] px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#05a94f]">
              <Save size={16} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function SettingsPanel({ title, icon, children }) {
  return (
    <section className="rounded-lg border border-black/5 bg-white p-5 shadow-[0_2px_8px_rgba(20,35,30,0.08)]">
      <div className="mb-4 flex items-center gap-2 text-[#2f3a36]">
        <span className="text-emerald-500">{icon}</span>
        <h2 className="text-base font-extrabold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-wide text-black/50">
      {label}
      <input
        className="mt-2 w-full rounded-md border border-black/10 bg-[#FBFCFC] px-4 py-3 text-sm font-semibold normal-case text-[#26302d] shadow-inner outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-wide text-black/50">
      {label}
      <select
        className="mt-2 w-full rounded-md border border-black/10 bg-[#FBFCFC] px-4 py-3 text-sm font-semibold normal-case text-[#26302d] shadow-inner outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ToggleRow({ icon, title, description, checked, onChange, last = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 bg-[#FEFFFF] px-3 py-4 ${last ? "" : "border-b border-black/[0.04]"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden text-black/45 sm:inline-flex">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-[#333d39]">{title}</span>
          <span className="mt-0.5 block text-xs font-medium text-black/45">{description}</span>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#05C85A]" : "bg-[#C6C9CF]"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function RangeControl({ label, value, min, max, accent, onChange }) {
  const color = accent === "blue" ? "#2E8BFF" : "#0FB85B";
  const unit = label.includes("mm") ? "mm" : "%";
  return (
    <div>
      <label className="text-xs font-extrabold uppercase tracking-wide text-black/50">
        {label}: <span style={{ color }}>{value}{unit}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-3 block h-2 w-full accent-[var(--range-color)]"
          style={{ "--range-color": color }}
        />
      </label>
      <div className="mt-2 flex justify-between text-xs font-bold text-black/35">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function roleLabel(role) {
  if (role === "admin") return "County Admin";
  if (role === "field_agent") return "Field Agent";
  if (role === "community_user") return "Community User";
  return "Platform User";
}

function storageKey(userId) {
  return `${preferenceStorageKey}:${userId || "anonymous"}`;
}

function readPreferences(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || "{}");
  } catch {
    return {};
  }
}

function writePreferences(userId, preferences) {
  localStorage.setItem(storageKey(userId), JSON.stringify(preferences));
}
