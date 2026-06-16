import { useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { endpoints } from "../services/api";

export function DeveloperPortalPage() {
  const [portal, setPortal] = useState(null);
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState([]);
  const [createdKey, setCreatedKey] = useState("");
  const [form, setForm] = useState({ name: "Research partner", ownerEmail: "researcher@example.org", quotaPerHour: 250 });

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const [portalRes, keysRes, usageRes] = await Promise.all([endpoints.developerPortal(), endpoints.apiKeys(), endpoints.apiUsage()]);
    setPortal(portalRes.data);
    setKeys(keysRes.data);
    setUsage(usageRes.data);
  }

  async function createKey(event) {
    event.preventDefault();
    const { data } = await endpoints.createApiKey({ ...form, quotaPerHour: Number(form.quotaPerHour) });
    setCreatedKey(data.key);
    await refresh();
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div><h1 className="text-2xl font-semibold">Developer Portal</h1><p className="text-sm text-black/60">Research API keys, quotas, and usage</p></div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={createKey} className="space-y-3 rounded-lg border border-black/10 bg-white p-4 shadow-panel">
          <div className="flex items-center gap-2 text-primary"><KeyRound size={18} /><h2 className="font-semibold">Issue API key</h2></div>
          <input className="w-full rounded-md border border-black/15 px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-md border border-black/15 px-3 py-2" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          <input type="number" className="w-full rounded-md border border-black/15 px-3 py-2" value={form.quotaPerHour} onChange={(e) => setForm({ ...form, quotaPerHour: e.target.value })} />
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-white"><Plus size={16} /> Create key</button>
          {createdKey && <code className="block break-all rounded-md bg-background p-3 text-xs">{createdKey}</code>}
        </form>
        <div className="space-y-4">
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
            <h2 className="font-semibold">{portal?.title}</h2>
            <p className="mt-1 text-sm text-black/60">{portal?.authentication}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">{portal?.endpoints?.map((endpoint) => <code key={endpoint} className="rounded-md bg-background p-2 text-xs">{endpoint}</code>)}</div>
          </div>
          <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-panel">
            <table className="w-full text-left text-sm"><thead className="bg-background"><tr><th className="p-3">Key</th><th>Owner</th><th>Quota/hr</th><th>Status</th></tr></thead><tbody>{keys.map((key) => <tr key={key.id} className="border-t border-black/10"><td className="p-3">{key.name} · {key.keyPrefix}</td><td>{key.ownerEmail}</td><td>{key.quotaPerHour}</td><td>{key.status}</td></tr>)}</tbody></table>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel">
            <h2 className="mb-2 font-semibold">Recent usage</h2>
            <div className="space-y-2">{usage.slice(0, 8).map((item) => <p key={item.id} className="text-sm"><span className="font-medium">{item.apiKey.name}</span> hit <code>{item.route}</code></p>)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
