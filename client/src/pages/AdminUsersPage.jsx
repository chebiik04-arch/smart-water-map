import { useEffect, useState } from "react";
import { Building2, Plus, Users } from "lucide-react";
import { endpoints } from "../services/api";

export function AdminUsersPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [users, setUsers] = useState([]);
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", country: "Kenya", billingPlan: "starter" });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "field_agent", district: "" });
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);

  useEffect(() => {
    refreshTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) refreshUsers(selectedTenantId);
  }, [selectedTenantId]);

  async function refreshTenants() {
    const { data } = await endpoints.tenants();
    setTenants(data);
    setSelectedTenantId((current) => current || data[0]?.id || "");
  }

  async function refreshUsers(tenantId) {
    const { data } = await endpoints.tenantUsers(tenantId);
    setUsers(data);
  }

  async function createTenant(event) {
    event.preventDefault();
    const { data } = await endpoints.createTenant({ ...tenantForm, config: {} });
    setTenants((current) => [data, ...current]);
    setSelectedTenantId(data.id);
    setTenantForm({ name: "", slug: "", country: "Kenya", billingPlan: "starter" });
  }

  async function createUser(event) {
    event.preventDefault();
    if (!selectedTenantId) return;
    await endpoints.createTenantUser(selectedTenantId, userForm);
    setUserForm({ name: "", email: "", password: "", role: "field_agent", district: "" });
    refreshUsers(selectedTenantId);
  }

  return (
    <section className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenant Administration</h1>
        <p className="text-sm text-black/60">Manage isolated NGO/country tenants, billing configuration, and tenant users.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel title="Tenants" icon={Building2}>
            <div className="space-y-2">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  className={`w-full rounded-md border px-3 py-2 text-left ${tenant.id === selectedTenantId ? "border-primary bg-primary/10" : "border-black/10 bg-white"}`}
                  onClick={() => setSelectedTenantId(tenant.id)}
                >
                  <p className="font-semibold">{tenant.name}</p>
                  <p className="text-xs text-black/60">{tenant.slug} · {tenant.country} · {tenant.billingPlan}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Create Tenant" icon={Plus}>
            <form className="space-y-3" onSubmit={createTenant}>
              <Input label="Name" value={tenantForm.name} onChange={(name) => setTenantForm({ ...tenantForm, name, slug: slugify(name) })} />
              <Input label="Slug" value={tenantForm.slug} onChange={(slug) => setTenantForm({ ...tenantForm, slug })} />
              <Input label="Country" value={tenantForm.country} onChange={(country) => setTenantForm({ ...tenantForm, country })} />
              <label className="block text-sm">
                <span className="mb-1 block text-black/70">Billing Plan</span>
                <select className="w-full rounded-md border border-black/15 px-3 py-2" value={tenantForm.billingPlan} onChange={(e) => setTenantForm({ ...tenantForm, billingPlan: e.target.value })}>
                  <option value="starter">Starter</option>
                  <option value="ngo">NGO</option>
                  <option value="country">Country</option>
                </select>
              </label>
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus size={16} /> Create</button>
            </form>
          </Panel>
        </div>

        <Panel title={selectedTenant ? `${selectedTenant.name} Users` : "Users"} icon={Users}>
          <form className="mb-4 grid gap-3 md:grid-cols-5" onSubmit={createUser}>
            <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <input className="rounded-md border border-black/15 px-3 py-2" placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            <select className="rounded-md border border-black/15 px-3 py-2" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="field_agent">Field Agent</option>
              <option value="community_user">Community User</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus size={16} /> Add User</button>
          </form>
          <div className="overflow-hidden rounded-md border border-black/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-background"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>District</th><th>Points</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-black/10">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.district || "-"}</td>
                    <td>{user.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, icon: Icon, children }) {
  return <div className="rounded-lg border border-black/10 bg-white p-4 shadow-panel"><div className="mb-3 flex items-center gap-2 text-primary"><Icon size={18} /><h2 className="font-semibold">{title}</h2></div>{children}</div>;
}

function Input({ label, value, onChange }) {
  return <label className="block text-sm"><span className="mb-1 block text-black/70">{label}</span><input className="w-full rounded-md border border-black/15 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
